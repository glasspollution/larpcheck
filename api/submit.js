// POST /api/submit — accepts one winning prompt per audit.
// Zero dependencies. Storage: Upstash Redis REST (free tier is plenty).
// Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const R = (...cmd) =>
  fetch(`${process.env.UPSTASH_REDIS_REST_URL}/${cmd.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  }).then(r => r.json());

const CLEAN = /(sk-[a-z0-9]{16,}|ghp_[a-z0-9]{16,}|-----BEGIN|api[_-]?key\s*[:=]|password\s*[:=])/i;

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  const prompt = String(b.prompt || '').trim().replace(/\s+/g, ' ');
  const words = Math.floor(Number(b.words));
  const lines = Math.floor(Number(b.lines));
  const handle = String(b.handle || 'anonymous').trim().slice(0, 40) || 'anonymous';
  const rank = String(b.rank || '').trim().slice(0, 24);
  const agent = String(b.agent || 'unknown').trim().slice(0, 24);

  if (!prompt || prompt.length > 280) return res.status(400).json({ error: 'prompt must be 1–280 chars' });
  if (!(words >= 1 && words <= 500)) return res.status(400).json({ error: 'words out of range' });
  if (!(lines >= 1 && lines <= 2_000_000)) return res.status(400).json({ error: 'lines out of range' });
  if (CLEAN.test(prompt)) return res.status(400).json({ error: 'prompt looks like it contains a secret' });

  // 5 submissions per IP per hour
  const ip = (req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const key = `rl:${ip}:${Math.floor(Date.now() / 3.6e6)}`;
  const { result: hits } = await R('incr', key);
  if (hits === 1) await R('expire', key, '3600');
  if (hits > 5) return res.status(429).json({ error: 'slow down — 5 audits per hour' });

  const ratio = Math.round(lines / words); // computed server-side, never trusted from client
  const entry = { prompt, words, lines, ratio, handle, rank, agent, at: Date.now() };

  await R('zadd', 'ledger', String(ratio), JSON.stringify(entry));
  await R('zremrangebyrank', 'ledger', '0', '-2001'); // keep top 2000

  const { result: better } = await R('zcount', 'ledger', `(${ratio}`, '+inf');
  const { result: top } = await R('zrevrange', 'ledger', '0', '9');
  const ledger = (top || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);

  return res.status(200).json({ ok: true, ratio, position: Number(better) + 1, ledger });
}
