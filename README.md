# Pẙxis

> **pýxis** (πυξίς) — a small box for keeping precious things. Also the Mariner's Compass constellation.
>
> The **ẙ** hides a **Pi** — the agent it was built for.

Context window attribution bar for the [Pi coding agent](https://github.com/mariozechner/pi-coding-agent). Shows a color-coded breakdown of what's eating your context — system prompt, memory, tools, conversation, thinking — right in the TUI footer. No cloud, no API keys, no setup.

![Pẙxis bar preview](docs/preview.png)

## What it does

- **Footer bar** — live color-coded segments showing token distribution across your context window
- **Token attribution** — breaks down system prompt, AGENTS.md, skills, file reads, bash, edits, browser, memory, web search, design tools, thinking, and user messages
- **Cost & cache tracking** — shows spend, cache hit percentage, and model info per turn
- **Session history** — SQLite-backed persistence of all sessions and turns
- **`/pẙxis` command** — detailed legend, `history`, `top`, `session <id>`, `on`/`off` subcommands

## Install

```bash
pi install GeneGulanesJr/Pẙxis
```

## Commands

| Command | What it does |
|---|---|
| `/pẙxis` | Show full legend with current token breakdown |
| `/pẙxis history` | Last 10 sessions with token counts and cost |
| `/pẙxis top` | Top 5 segments by average context consumption |
| `/pẙxis session <id>` | Turn-by-turn breakdown for a specific session |
| `/pẙxis off` | Disable the footer bar |
| `/pẙxis on` | Re-enable the footer bar |

## Segments

The bar breaks your context window into 15 color-coded segments:

| Color | Segment | What it tracks |
|---|---|---|
| 🔵 | System | System prompt overhead |
| 🟢 | AGENTS.md | Context files and agent instructions |
| 🔵 | Skills | SKILL.md and skill directory reads |
| 🟢 | File Reads | Source/code file reads via read tool |
| 🟡 | Bash Output | Shell command results |
| 🟠 | Edits | Edit/write tool results |
| 🟣 | Browser | browser_* tool results |
| 🩵 | Memory | memory_* tool results |
| 🔵 | Web Search | WEB_Search/WEB_Research results |
| 🟣 | Design | Design tool results |
| ⚪ | Other Tools | Unclassified tool output |
| 🔴 | Thinking | ThinkingContent blocks |
| 🟤 | Tool Call Args | Arguments the model sends to tools |
| 🔵 | User Messages | Your messages |
| 🟢 | Assistant Text | Model's text responses |

## Architecture

```
Pi Agent
  ├── Events (session_start, turn_end, message_update, model_select)
  │
  ├── Attributor ─── walks branch entries, estimates tokens per segment
  │   ├── classify.ts ─── maps tool calls to segment IDs
  │   └── segments.ts ─── segment definitions + ANSI colors
  │
  ├── Bar Renderer ─── renders proportional color bar + info line
  │
  └── DB (SQLite via sql.js) ─── persists sessions + turns
      ├── insertSession / updateSessionEnd
      ├── insertTurn
      ├── getRecentSessions
      └── getTopSegments
```

## Tech

- TypeScript, zero external deps beyond `sql.js`
- Token estimation via character-count heuristic, calibrated against actual API usage
- Throttled rendering (1s) to avoid TUI flicker
- Per-session SQLite persistence for history analytics

## License

MIT
