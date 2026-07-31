// GET /api/leaderboard?scope=all|day
const R = (...cmd) =>
  fetch(`${process.env.UPSTASH_REDIS_REST_URL}/${cmd.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  }).then(r => r.json());

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120');

  const { result } = await R('zrevrange', 'ledger', '0', '299');
  let entries = (result || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);

  if ((req.query?.scope || 'all') === 'day') {
    const cutoff = Date.now() - 864e5;
    entries = entries.filter(e => e.at > cutoff);
  }

  return res.status(200).json({ entries: entries.slice(0, 25) });
}
