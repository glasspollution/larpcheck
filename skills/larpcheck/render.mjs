#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// larpcheck card renderer.
//   node render.mjs < payload.json      node render.mjs --demo
//   --width N   --plain (ascii)   --no-color
//
// The agent must never hand-draw this card: box alignment breaks the moment a
// number changes width. Pass JSON, get identical output every run.

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };

// 68 default, not 72: agent tool-output panes are narrower than a bare terminal
// and a single wrapped line destroys the whole card.
const W = Math.max(52, Math.min(100, Number(opt('width')) || 68));
const IN = W - 2;
const ASCII = flag('plain');
const NC = process.env.NO_COLOR || process.env.TERM === 'dumb' || flag('no-color');

const G = ASCII
  ? { tl:'+', tr:'+', bl:'+', br:'+', h:'-', v:'|', ml:'+', mr:'+', on:'#', off:'.', q:'"' }
  : { tl:'╭', tr:'╮', bl:'╰', br:'╯', h:'─', v:'│', ml:'├', mr:'┤', on:'━', off:'─', q:'"' };

const c = (code, s) => (NC ? String(s) : `\x1b[${code}m${s}\x1b[0m`);
const dim = s => c('2', s), bold = s => c('1', s);

const TIERS = [
  { max: 49,       name: 'CIVILIAN',       color: '32',       note: 'appears to type their own code' },
  { max: 199,      name: 'WEEKEND LARPER', color: '36',       note: 'still reads the diffs. on weekdays' },
  { max: 799,      name: 'METHOD ACTOR',   color: '35',       note: 'has started saying "we" about the agent' },
  { max: 1999,     name: 'FULL COSTUME',   color: '33',       note: 'owns a mechanical keyboard, uses four keys' },
  { max: 4999,     name: 'THOUGHT LEADER', color: '38;5;208', note: 'ships more per word than any writer alive' },
  { max: Infinity, name: 'FOUNDER',        color: '1;31',     note: 'has not written code since 2024' }
];
const tierFor = r => TIERS.find(t => r <= t.max);
const ratioOf = e => e.ratio ?? Math.round(e.lines / Math.max(e.words, 1));

// --- width-aware helpers ---------------------------------------------------
const bare = s => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const len = s => bare(s).length;
const num = n => Number(n).toLocaleString('en-US');

function cut(s, w) {
  s = String(s);
  if (len(s) <= w) return s;
  let out = '', vis = 0, i = 0, esc = false;
  while (i < s.length && vis < w) {
    if (s[i] === '\x1b') {
      const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
      if (m) { out += m[0]; i += m[0].length; esc = true; continue; }
    }
    out += s[i++]; vis++;
  }
  return (vis >= w ? out.slice(0, -1) + (ASCII ? '~' : '…') : out) + (esc ? '\x1b[0m' : '');
}
const pad = (s, w) => cut(s, w) + ' '.repeat(Math.max(0, w - len(s)));

// Borders are NOT dim — at dim they disappear against most terminal themes.
const row = s => G.v + pad(s, IN) + G.v;
const top = t => G.tl + G.h + ' ' + bold(t) + ' ' + G.h.repeat(Math.max(0, IN - len(t) - 3)) + G.tr;
const rule = () => G.ml + G.h.repeat(IN) + G.mr;
const bottom = () => G.bl + G.h.repeat(IN) + G.br;

function wrap(text, w) {
  const out = []; let cur = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= w) cur += ' ' + word;
    else { out.push(cur); cur = word; }
  }
  if (cur) out.push(cur);
  return out;
}

// Heavy vs light rule, not █ vs ░ — the shade glyphs dither on Windows and the
// filled and empty halves blend into one block.
function bar(score, color, cells) {
  const on = Math.max(0, Math.min(cells, Math.round((score / 20) * cells)));
  return c(color, G.on.repeat(on)) + dim(G.off.repeat(cells - on));
}

// --- card ------------------------------------------------------------------
export function card(d) {
  const ratio = ratioOf(d);
  const tier = tierFor(ratio);
  const badge = ` ${num(ratio)} : 1 `;
  const bw = badge.length;
  const out = [];

  out.push(top(`larpcheck v0.1  ${ASCII ? '-' : '·'}  ${d.agent || 'agent'}`));
  out.push(row(''));

  const block = [
    dim('LARP RATIO'),
    dim(G.tl + G.h.repeat(bw) + G.tr),
    dim(G.v) + c(tier.color, bold(badge)) + dim(G.v),
    dim(G.bl + G.h.repeat(bw) + G.br),
    c(tier.color, bold(tier.name)),
    '',
    dim(`${num(d.words)} words typed`),
    dim(`${num(d.lines)} lines shipped`),
    dim(`${num(d.sessions ?? 0)} sessions read`)
  ];

  const L = 24;
  const R = IN - L - 4;
  if (R >= 30 && d.summary) {                     // side by side only if it fits
    const right = wrap(d.summary, R);
    for (let i = 0; i < Math.max(block.length, right.length); i++)
      out.push(row('  ' + pad(block[i] ?? '', L) + dim(G.v + ' ') + (right[i] ?? '')));
  } else {
    for (const l of block) out.push(row('  ' + l));
    if (d.summary) {
      out.push(row(''));
      for (const l of wrap(d.summary, IN - 4)) out.push(row('  ' + dim(l)));
    }
  }
  out.push(row(''));

  if (d.stats?.length) {
    const cells = IN >= 62 ? 16 : 12;
    const noteW = IN - 2 - 13 - cells - 2 - 4;
    out.push(rule());
    for (const s of d.stats) {
      out.push(row('  ' + pad(bold(s.name.toUpperCase()), 13) + bar(s.score, tier.color, cells)
        + '  ' + pad(String(s.score), 4) + (noteW > 6 ? dim(pad(String(s.note || '').trim(), noteW)) : '')));
    }
  }

  if (d.best) {
    const head = 'BEST PERFORMANCE', tag = `${num(ratioOf(d.best))} : 1`;
    out.push(rule());
    out.push(row('  ' + dim(bold(head)) + ' '.repeat(Math.max(1, IN - head.length - tag.length - 4)) + c(tier.color, bold(tag))));
    out.push(row('  ' + bold(`${G.q}${cut(d.best.prompt, IN - 6)}${G.q}`)));
    out.push(row('  ' + dim(`${num(d.best.words)} words ${ASCII ? '->' : '→'} ${num(d.best.lines)} lines`)));
  }

  out.push(bottom());
  if (tier.note) out.push('  ' + dim(cut(tier.note, IN)));
  return out.join('\n');
}

// --- table -----------------------------------------------------------------
// Renders whether or not a public ledger exists. With `entries` from the API it
// is the global ledger; otherwise it lists the user's own runners-up, so the
// output is never bare in local-only mode.
export function table(entries, { title, meta, mine } = {}) {
  const out = ['', '  ' + bold(title) + (meta ? dim('   ' + meta) : '')];
  const rankW = 5, ratioW = 12, tierW = IN >= 62 ? 17 : 0;
  out.push('  ' + dim(pad('RANK', rankW) + pad('RATIO', ratioW) + (tierW ? pad('TIER', tierW) : '') + 'PROMPT'));

  entries.slice(0, 10).forEach((e, i) => {
    const r = ratioOf(e), t = tierFor(r);
    const you = mine != null && e.prompt === mine;
    const promptW = IN - rankW - ratioW - tierW - (you ? 9 : 2);
    const p = `${G.q}${cut(e.prompt, promptW)}${G.q}`;
    out.push(
      (you ? c(t.color, ASCII ? '> ' : '▸ ') : '  ')
      + pad(dim('#' + (i + 1)), rankW)
      + pad(c(t.color, bold(num(r) + ' : 1')), ratioW)
      + (tierW ? pad(dim(t.name.toLowerCase()), tierW) : '')
      + (you ? bold(p) + c(t.color, ASCII ? '  <- you' : '  ← you') : dim(p))
    );
  });
  return out.join('\n');
}

export function render(d) {
  const parts = [card(d)];
  if (d.ledger?.length) {
    parts.push(table(d.ledger, {
      title: 'THE LEDGER',
      meta: `live ${ASCII ? '-' : '·'} ${num(d.audits ?? d.ledger.length)} audits`,
      mine: d.best?.prompt
    }));
  } else if (d.top?.length > 1) {
    parts.push(table(d.top, {
      title: 'YOUR TOP PERFORMANCES',
      meta: 'this machine only',
      mine: d.best?.prompt
    }));
  }
  return parts.join('\n');
}

// --- cli -------------------------------------------------------------------
const DEMO = {
  agent: 'claude-code', words: 812, lines: 977648, sessions: 47,
  summary: 'Read 47 sessions. Counted every word you typed and every line I shipped. Only your winning prompt ever leaves this machine, and only if you say so.',
  stats: [
    { name: 'vagueness',   score: 16, note: 'you said "just" 41 times' },
    { name: 'blind faith', score: 18, note: '0 files opened after an edit' },
    { name: 'paste',       score: 11, note: '14 turns were only a trace' },
    { name: 'deference',   score: 14, note: 'you were right 23 times' }
  ],
  best: { prompt: 'make it prettier', words: 3, lines: 13236 },
  top: [
    { prompt: 'make it prettier', words: 3, lines: 13236 },
    { prompt: 'fix', words: 1, lines: 4102 },
    { prompt: 'you know what I mean', words: 5, lines: 16890 },
    { prompt: 'same as the other one', words: 5, lines: 14220 },
    { prompt: 'just make it work properly this time', words: 7, lines: 9880 }
  ]
};

const isMain = (() => {
  try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; }
  catch { return false; }
})();

if (isMain && flag('demo')) {
  console.log(render(DEMO));
} else if (isMain) {
  const arg = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--width').join(' ');
  const read = arg
    ? Promise.resolve(arg)
    : new Promise(res => { let s = ''; process.stdin.on('data', d => s += d).on('end', () => res(s)); });

  read.then(raw => {
    let d;
    try { d = JSON.parse(raw); }
    catch { console.error('larpcheck: expected JSON on stdin or argv'); process.exit(1); }
    console.log(render(d));
  });
}
