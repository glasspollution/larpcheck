#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// larpcheck card renderer.
// Usage:  node render.mjs '<json>'   |   echo '<json>' | node render.mjs
// The agent must never hand-draw this card — box alignment breaks the moment a
// number changes width. Pass JSON, get identical output every run.

const W = 72;                 // total card width, safe inside an 80-col terminal
const IN = W - 2;             // inner width

const NC = process.env.NO_COLOR || process.env.TERM === 'dumb' || process.argv.includes('--no-color');
const c = (code, s) => (NC ? String(s) : `\x1b[${code}m${s}\x1b[0m`);
const dim = s => c('2', s), bold = s => c('1', s), b_dim = s => c('1;2', s);

const TIERS = [
  { max: 49,     name: 'CIVILIAN',       color: '32', note: 'appears to type their own code' },
  { max: 199,    name: 'WEEKEND LARPER', color: '36', note: 'still reads the diffs. on weekdays' },
  { max: 799,    name: 'METHOD ACTOR',   color: '35', note: 'has started saying "we" about the agent' },
  { max: 1999,   name: 'FULL COSTUME',   color: '33', note: 'owns a mechanical keyboard, uses four keys' },
  { max: 4999,   name: 'THOUGHT LEADER', color: '38;5;208', note: 'ships more per word than any writer alive' },
  { max: Infinity, name: 'FOUNDER',      color: '1;31', note: 'has not written code since 2024' }
];
const tierFor = r => TIERS.find(t => r <= t.max);

// --- width-aware layout helpers -------------------------------------------
const bare = s => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const len = s => bare(s).length;
const num = n => Number(n).toLocaleString('en-US');

// Truncate to w visible chars, preserving escape sequences and closing them.
function cut(s, w) {
  s = String(s);
  if (len(s) <= w) return s;
  let out = '', vis = 0, i = 0, sawEsc = false;
  while (i < s.length && vis < w) {
    if (s[i] === '\x1b') {
      const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
      if (m) { out += m[0]; i += m[0].length; sawEsc = true; continue; }
    }
    out += s[i++]; vis++;
  }
  return (vis >= w ? out.slice(0, -1) + '…' : out) + (sawEsc ? '\x1b[0m' : '');
}

const pad = (s, w) => cut(s, w) + ' '.repeat(Math.max(0, w - len(s)));

const line   = (l, fill, r) => l + fill.repeat(IN) + r;
const row    = s => dim('│') + pad(s, IN) + dim('│');  // pad() now truncates too
const top    = t => dim('╭─ ') + bold(t) + dim(' ' + '─'.repeat(Math.max(0, IN - len(t) - 3)) + '╮');
const rule   = () => dim(line('├', '─', '┤'));
const bottom = () => dim(line('╰', '─', '╯'));

function wrap(text, w) {
  const out = [];
  let cur = '';
  for (const word of String(text).split(/\s+/)) {
    if (!cur.length) cur = word;
    else if (cur.length + 1 + word.length <= w) cur += ' ' + word;
    else { out.push(cur); cur = word; }
  }
  if (cur) out.push(cur);
  return out;
}

function bar(score, color) {
  const cells = 16;
  const on = Math.max(0, Math.min(cells, Math.round((score / 20) * cells)));
  return c(color, '█'.repeat(on)) + dim('░'.repeat(cells - on));
}

// --- the card --------------------------------------------------------------
export function card(d) {
  const ratio = d.ratio ?? Math.round(d.lines / Math.max(d.words, 1));
  const tier  = tierFor(ratio);
  const badge = ` ${num(ratio)} : 1 `;
  const bw    = badge.length;

  const L = 26;                       // left column width
  const R = IN - L - 4;               // right column, minus gutter + divider

  const right = wrap(d.summary || '', R);
  const left = [
    dim('LARP RATIO'),
    dim('╭' + '─'.repeat(bw) + '╮'),
    dim('│') + c(tier.color, bold(badge)) + dim('│'),
    dim('╰' + '─'.repeat(bw) + '╯'),
    c(tier.color, bold(tier.name)),
    '',
    dim(`${num(d.words)} words typed`),
    dim(`${num(d.lines)} lines shipped`),
    dim(`${num(d.sessions ?? 0)} sessions read`)
  ];

  const out = [];
  out.push(top(`larpcheck v0.1  ·  ${d.agent || 'agent'}`));
  out.push(row(''));
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    out.push(row('  ' + pad(left[i] ?? '', L) + dim('│ ') + (right[i] ?? '')));
  }
  out.push(row(''));

  if (d.stats?.length) {
    out.push(rule());
    for (const s of d.stats) {
      const label = pad(bold(s.name.toUpperCase()), 13);
      const score = pad(String(s.score), 4);
      const noteW = IN - 2 - 13 - 16 - 2 - 4;
      const note  = dim(pad(String(s.note || '').trim(), noteW));
      out.push(row('  ' + label + bar(s.score, tier.color) + '  ' + score + note));
    }
  }

  if (d.best) {
    const head = 'BEST PERFORMANCE';
    const tag  = `${num(d.best.ratio ?? Math.round(d.best.lines / Math.max(d.best.words, 1)))} : 1`;
    out.push(rule());
    out.push(row('  ' + b_dim(head) + pad('', IN - head.length - tag.length - 4) + c(tier.color, bold(tag))));
    out.push(row('  ' + bold(`"${d.best.prompt}"`)));
    out.push(row('  ' + dim(`${num(d.best.words)} words → ${num(d.best.lines)} lines`)));
  }

  out.push(bottom());
  if (tier.note) out.push('  ' + dim(tier.note));
  return out.join('\n');
}

// --- ledger ---------------------------------------------------------------
export function ledger(entries, mine) {
  const out = [];
  const head = '  ' + dim(pad('RANK', 7) + pad('RATIO', 12) + pad('TIER', 17) + 'PROMPT');
  out.push('');
  out.push('  ' + b_dim('THE LEDGER') + dim(`   live · ${num(entries.length)} audits`));
  out.push(head);
  entries.slice(0, 10).forEach((e, i) => {
    const t = tierFor(e.ratio);
    const you = mine && e.prompt === mine;
    const mark = you ? c(t.color, '▸ ') : '  ';
    const p = e.prompt.length > 30 ? e.prompt.slice(0, 29) + '…' : e.prompt;
    out.push(
      mark + pad(dim('#' + (i + 1)), 5)
      + pad(c(t.color, bold(num(e.ratio) + ' : 1')), 12)
      + pad(dim(t.name.toLowerCase()), 17)
      + (you ? bold(`"${p}"`) + c(t.color, '  ← you') : dim(`"${p}"`))
    );
  });
  return out.join('\n');
}

// --- cli ------------------------------------------------------------------
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
  ledger: [
    { prompt: 'fix', ratio: 8102 }, { prompt: 'make it prettier', ratio: 4412 },
    { prompt: 'you know what I mean', ratio: 3378 }, { prompt: 'just make it work', ratio: 1470 }
  ]
};

// argv[1] keeps the symlink path while import.meta.url is already resolved, and
// `file://` + a Windows path is malformed — so realpath both sides.
const isMain = (() => {
  try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; }
  catch { return false; }
})();

if (isMain && process.argv.includes('--demo')) {
  console.log(card(DEMO));
  console.log(ledger(DEMO.ledger, DEMO.best.prompt));
} else if (isMain) {
  const arg = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');
  const read = arg
    ? Promise.resolve(arg)
    : new Promise(res => { let s = ''; process.stdin.on('data', d => s += d).on('end', () => res(s)); });

  read.then(raw => {
    let d;
    try { d = JSON.parse(raw); }
    catch { console.error('larpcheck: expected JSON on argv or stdin'); process.exit(1); }
    console.log(card(d));
    if (d.ledger?.length) console.log(ledger(d.ledger, d.best?.prompt));
  });
}
