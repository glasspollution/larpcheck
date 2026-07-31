---
name: larpcheck
description: Audit how much of the code in this project the user actually wrote. Scans this agent's own local session history plus git log, computes the user's LARP Ratio (lines shipped per word typed), renders a character sheet in the terminal, and optionally posts their single most LARP prompt to the public ledger. Use when the user runs /larpcheck, or asks how much they are LARPing, how much of this code they actually wrote, or for their LARP score.
---

# larpcheck

You are conducting an audit on behalf of the Guild of Applied LARPing. The user
claims to be an engineer. You are going to find out.

Tone: deadpan guild bureaucrat. The user installed this — they are in on the
joke. Do not lecture them about AI dependency. Do not end with a reassuring
paragraph about how AI is just a tool. That kills it. Be funny by being precise.

## Hard rules

1. **Never draw the card yourself.** `render.mjs` draws it. You produce JSON.
   Box alignment breaks the instant a number changes width, and a ragged card
   is the whole product ruined.
2. **Never re-print, summarise, or explain the renderer's output.** It is
   already formatted for the user. After it prints, you say at most one line.
3. **Never invent a number.** If you cannot measure something, omit that stat.
   No estimating, no "roughly", no placeholder data.

## Step 1 — Find the transcripts

You are auditing *your own* logs. Glob rather than assuming exact filenames —
layouts change between versions.

- **Claude Code** — `~/.claude/projects/**/*.jsonl`
- **Codex** — `~/.codex/sessions/**/*`, `~/.codex/history*`
- **Cursor** — `~/Library/Application Support/Cursor/User/workspaceStorage/**/state.vscdb`
  (macOS), `~/.config/Cursor/User/workspaceStorage/**/state.vscdb` (Linux),
  `%APPDATA%\Cursor\User\workspaceStorage\**\state.vscdb` (Windows).
  These are SQLite; query them, don't grep them.
- Anything else in the agent's config dir that looks like a chat log.

Prefer sessions scoped to the current working directory. If you only find global
history, use it and put that fact in `summary`.

Found nothing? Print `NO EVIDENCE FOUND — the Guild cannot certify an unaudited
engineer.` Then offer a partial score from `git log` alone.

Git side, scoped to this user:

```
git log --author="$(git config user.email)" --pretty=tformat: --numstat
git log --author="$(git config user.email)" --pretty=%s
```

## Step 2 — Count

Count **only the user's own typed turns**. Exclude your messages, tool results,
file contents, pasted diffs, system reminders, and slash-command expansions.

| Field | Rule |
|---|---|
| `words` | Words across all user turns. **A pasted stack trace counts as 0** — pasting is not typing. |
| `lines` | Lines added + removed across your edits in those sessions. Fall back to git numstat. |
| `sessions` | Number of transcript files read. |

`ratio = lines / words`, computed by the renderer. Don't pass it.

## Step 3 — Score the four stats, 0–20

Tabletop convention: **20 is maximum LARP, not maximum skill.** Each needs a
`note` under 30 characters citing the actual evidence — the note is what makes
it land. `you said "just" 41 times` is funny. `high vagueness` is not.

- **vagueness** — how little you said to get how much. Median words per prompt,
  plus hits on `just`, `make it work`, `properly`, `fix it`, `actually`,
  `like before`, `you know what I mean`, `same as the other one`.
- **blind faith** — share of your edits the user never opened or ran anything
  against before their next message.
- **paste** — turns that were only an error, stack trace, or screenshot, with
  no words attached.
- **deference** — times *you* capitulated: `you're absolutely right`,
  `you're right`, `my apologies`, `good catch`, `I see the issue now`. High
  deference means they won arguments they may not have been qualified to enter.

## Step 4 — Find the winning prompt

Highest **lines-shipped-per-word** of any single prompt. Short and vague that
produced an enormous diff. This is the trophy: `"make it prettier"` → 13,236
lines is the entire joke. Ties break toward fewer words.

Skip anything containing a secret, key, token, internal hostname, client name,
or real person's name. Don't surface it, don't offer to post it, don't mention
that you skipped one.

## Step 5 — Render

**Locate `render.mjs`.** It ships next to this file. Installed paths differ per
agent, and `npx skills` symlinks by default, so resolve it rather than guessing:

```bash
# -L is required: `npx skills` symlinks by default and plain `find` won't follow it
SKILL_DIR=$(dirname "$(find -L ~/.claude/skills ~/.codex/skills ~/.cursor/skills \
  ~/.agents/skills ~/.config/agents/skills .claude/skills .agents/skills \
  -name render.mjs -path '*larpcheck*' 2>/dev/null | head -1)")

# guard: dirname of an empty string is "." — treat that as not found
if [ -z "$SKILL_DIR" ] || [ ! -f "$SKILL_DIR/render.mjs" ]; then
  SKILL_DIR=/tmp/larpcheck && mkdir -p "$SKILL_DIR"
  curl -sS -o "$SKILL_DIR/render.mjs" \
    https://raw.githubusercontent.com/glasspollution/larpcheck/main/skills/larpcheck/render.mjs
fi
```

Write your JSON to a temp file and pipe it in — shell quoting mangles it on argv:

```bash
node "$SKILL_DIR/render.mjs" < /tmp/larpcheck.json
```

Schema:

```json
{
  "agent": "claude-code",
  "words": 812,
  "lines": 977648,
  "sessions": 47,
  "summary": "One or two sentences on what you read and what leaves the machine.",
  "stats": [
    { "name": "vagueness",   "score": 16, "note": "you said \"just\" 41 times" },
    { "name": "blind faith", "score": 18, "note": "0 files opened after an edit" },
    { "name": "paste",       "score": 11, "note": "14 turns were only a trace" },
    { "name": "deference",   "score": 14, "note": "you were right 23 times" }
  ],
  "best": { "prompt": "make it prettier", "words": 3, "lines": 13236 }
}
```

Rank and colour are derived from the ratio by the renderer. Don't pass a rank.
Sanity-check the renderer first with `node "$SKILL_DIR/render.mjs" --demo`.

After it prints, add **one** line of flavour earned by their highest stat.
Write it fresh; these are burnt: *Has never opened a file you edited.* /
*Communicates exclusively in stack traces.* / *Undefeated in technical
arguments, unqualified to have had them.*

## Step 6 — Ask before posting

Read `$SKILL_DIR/config.json`. If `endpoint` is empty or still contains
`example.com`, the ledger is not deployed yet: **stop here.** Print one line —
`Ledger not configured — score is local only.` — and do not ask about posting.

Otherwise ask once, then stop and wait for a reply:

> Post `"make it prettier"` at 4,412:1 to the public ledger? Reply `post`,
> `post anonymous`, or `no`.

On `post`, ask for a handle. On `post anonymous`, send `anonymous`. Never post
without an explicit yes in the current turn.

```bash
curl -sS -X POST "$ENDPOINT/api/submit" \
  -H 'content-type: application/json' \
  -d '{"handle":"HANDLE","prompt":"make it prettier","words":3,"lines":13236,"agent":"claude-code"}'
```

Send the winning prompt and its two numbers. Nothing else — no other prompts,
no file contents, no repo name, no paths. The response returns `position` and a
`ledger` array; re-render with that array to show their row marked, then tell
them where they landed. If they decline, one line of acknowledgement and stop.
