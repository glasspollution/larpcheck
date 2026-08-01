# larpcheck

An audit of how much of your codebase you actually wrote. Installs as a skill
into Claude Code / Codex / Cursor, reads that agent's own local transcripts, and
computes your **LARP Ratio** — lines shipped per word typed.

```
╭─ larpcheck v0.1  ·  claude-code ─────────────────────────────────╮
│  LARP RATIO              │ Read 47 sessions. Counted every word  │
│  ╭───────────╮           │ you typed and every line I shipped.   │
│  │ 1,204 : 1 │           │ Only your winning prompt ever leaves  │
│  ╰───────────╯           │ this machine, and only if you say so. │
│  FULL COSTUME            │                                       │
├──────────────────────────────────────────────────────────────────┤
│  VAGUENESS    ━━━━━━━━━━━━━───  16  you said "just" 41 times     │
│  BLIND FAITH  ━━━━━━━━━━━━━━──  18  0 files opened after an edit │
├──────────────────────────────────────────────────────────────────┤
│  BEST PERFORMANCE                                     4,412 : 1  │
│  "make it prettier"                                              │
╰──────────────────────────────────────────────────────────────────╯
  owns a mechanical keyboard, uses four keys

  YOUR TOP PERFORMANCES   this machine only
  RANK RATIO       TIER             PROMPT
▸ #1   4,412 : 1   thought leader   "make it prettier"  ← you
  #2   4,102 : 1   thought leader   "fix"
```

## Why it travels

The data lives on your machine and nobody has ever seen it. You can't get your
LARP Ratio from a website, only from inside the agent — so the install *is* the
share. And the leaderboard rewards typing less, which means gaming it requires
performing the exact behaviour it's mocking.

## Test it in 60 seconds

No backend needed. `config.json` ships with an empty endpoint, so the skill runs
local-only and skips the posting step entirely.

```bash
# 1. see the card without auditing anything
npm run demo

# 2. install into your agents
npx skills add glasspollution/larpcheck --agent claude-code codex cursor --global --yes

# 3. open the agent in a repo you've actually used it on, then invoke it:
#    Claude Code -> /larpcheck
#    Codex       -> $larpcheck        (NOT /larpcheck - see below)
#    Cursor      -> just ask: "how much am I larping"
```

### Invocation differs per agent

Only Claude Code turns a skill's `name` into a slash command. Codex does not:
`/skills` opens a picker, and `$larpcheck` invokes it directly. In any agent you
can also just ask -- "how much of this code did I actually write" -- and the
`description` frontmatter triggers it.

If it doesn't show up in Codex, check where the files actually landed:

```bash
ls -la ~/.codex/skills/ ~/.agents/skills/ .agents/skills/ .codex/skills/ 2>/dev/null
```

Codex's skills directory has moved between versions. Whichever of those holds
`larpcheck/SKILL.md` is the live one; the skill's own `find -L` covers all of
them. Confirm Codex sees it at all with `/skills`.

If the skill can't find `render.mjs`, it curls it from this repo's `main` branch
— so **push before you test**, or the fallback 404s.

### If the card looks wrong in your agent

```bash
node <skill-dir>/render.mjs --demo --width 60   # narrower, restacks the layout
node <skill-dir>/render.mjs --demo --plain      # ASCII, for terminals that
                                                # mangle box-drawing glyphs
```

Default width is 68, not 72: agent tool-output panes are narrower than a bare
terminal, and one wrapped line destroys the card. Verified aligned at every
width from 52 to 100 in both charsets.

## Deploy the ledger (optional, later)

```bash
# free Redis at upstash.com, copy the two REST values
npx vercel --prod
npx vercel env add UPSTASH_REDIS_REST_URL
npx vercel env add UPSTASH_REDIS_REST_TOKEN
```

Then set `endpoint` in `skills/larpcheck/config.json` to your deployed URL and
push. Until you do, nothing is ever uploaded.

## Files

| | |
|---|---|
| `skills/larpcheck/SKILL.md` | The audit instructions. The product. |
| `skills/larpcheck/render.mjs` | Draws the terminal card. Zero deps. `--demo` to preview. |
| `skills/larpcheck/config.json` | Empty endpoint = local-only mode. |
| `index.html` | Landing page + live ledger. Static, no build step. |
| `api/submit.js` | Accepts one prompt per audit. Rate limited, secret-screened. |
| `api/leaderboard.js` | Returns the top 25. |

## Notes for whoever maintains this

- **The model must never draw the card.** `render.mjs` does. LLMs miscount
  column widths, so hand-drawn borders come out ragged and different every run.
  The agent produces JSON; the renderer owns every character.
- **Symlinks bite twice.** `npx skills` symlinks by default. `find` needs `-L`
  to follow it, and `import.meta.url === 'file://' + argv[1]` is false under a
  symlink because Node resolves one side and not the other — that check has to
  `realpathSync` both. Both bugs were silent: the second printed nothing at all.
- **The table renders with no backend.** The renderer shows the public ledger
  when the payload has `ledger`, and otherwise falls back to the user's own
  `top` prompts. An audit that prints a bare card looks broken, and local-only
  is the default state, so `top` is required in the payload — not optional.
- **Bars are `━`/`─`, not `█`/`░`.** The shade glyphs dither on Windows and the
  filled and empty halves blend into one solid block. Borders are also not
  `dim`; at dim they vanish against most terminal themes.
- **Colour is not gated behind `isTTY`.** When an agent runs the script its
  stdout is a pipe, so a TTY check would strip colour exactly when you want it.
  `NO_COLOR=1` still works and the card reads fine in monochrome.
- **Cursor stores history in SQLite** (`state.vscdb`), not JSONL. It's the
  likeliest of the three to come back empty. Test it last.

## Before you launch

- **Run it on yourself first.** Your own score is the launch post. If it's
  boring, the numbers need re-weighting, not the copy.
- **Seed the ledger.** Get five friends to run it the day before. An empty
  leaderboard reads as abandoned.
- The ledger is public and user-submitted. Keep the moderation path short — a
  `zrem` on a bad entry, and a way for people to ask for one.

## Launch post that isn't a launch post

Post your own character sheet. Rank, ratio, and the four-word prompt that
shipped nine thousand lines. One line of setup, the install command in the first
comment, nothing else. Let people ask what it is.

Do not write "excited to announce." You are a Full Costume. Act like it.

MIT