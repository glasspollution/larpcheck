# larpcheck

An audit of how much of your codebase you actually wrote. Installs as a skill
into Claude Code / Codex / Cursor, reads that agent's own local transcripts, and
computes your **LARP Ratio** — lines shipped per word typed.

```
╭─ larpcheck v0.1  ·  claude-code ─────────────────────────────────────╮
│  LARP RATIO                │ Read 12 sessions scoped to this repo.   │
│  ╭────────╮                │ Only your winning prompt ever leaves    │
│  │ 51 : 1 │                │ this machine, and only if you say so.   │
│  ╰────────╯                │                                         │
│  WEEKEND LARPER            │                                         │
├──────────────────────────────────────────────────────────────────────┤
│  VAGUENESS    ██████████░░░░░░  13  you said "just" 22 times         │
│  BLIND FAITH  ██████████████░░  17  2 of 31 edits ever opened        │
├──────────────────────────────────────────────────────────────────────┤
│  BEST PERFORMANCE                                         3,133 : 1  │
│  "fix the thing"                                                     │
╰──────────────────────────────────────────────────────────────────────╯
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

# 3. open Claude Code or Codex in a repo you've used the agent on, then:
/larpcheck
```

If the skill can't find `render.mjs`, it curls it from this repo's `main` branch
— so **push before you test**, or the fallback 404s.

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
