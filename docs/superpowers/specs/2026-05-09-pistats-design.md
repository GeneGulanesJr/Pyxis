# PiStats Design Spec

## Overview

PiStats is a Pi Agent extension that adds a color-coded stats bar to the Pi TUI footer, showing real-time context window attribution. It also persists session data to SQLite for historical analysis.

The bar is a single row of colored blocks — no labels, no text in the bar itself — with a compact info line beneath. A `/pistats` command shows the full legend and numeric breakdown.

## Architecture

PiStats is a **Pi extension** (`~/.pi/agent/extensions/pistats/index.ts`) that:

1. Hooks into Pi lifecycle events to track token attribution
2. Renders a color-coded bar via `ctx.ui.setFooter()`
3. Persists data to a local SQLite database
4. Registers `/pistats` command for detailed breakdown

### Components

```
pistats/
├── index.ts              # Extension entry point, event hooks
├── attributor.ts          # Walks branch entries, attributes tokens per segment
├── bar-renderer.ts        # Renders the color-coded footer bar
├── db.ts                 # SQLite schema, writes, queries
├── segments.ts           # Segment definitions, colors, classification logic
└── package.json          # Dependencies (better-sqlite3)
```

## Segment Definitions

21 segments + "Free" (dim). Each segment has a fixed ANSI color. Segments are attributed by walking the branch and classifying entries.

### Color Palette

Each segment gets a visually distinct ANSI 256-color code:

| # | Segment | ANSI Code | Hex Ref | Description |
|---|---------|-----------|---------|-------------|
| 1 | System | 33 | #0087ff | System prompt overhead |
| 2 | AGENTS.md | 28 | #008700 | AGENTS.md context files |
| 3 | Skills | 34 | #0087af | SKILL.md and skill directory reads |
| 4 | File Reads | 70 | #5f8700 | Read tool on source/code files |
| 5 | Bash Output | 136 | #af8700 | BashExecutionMessage + bash tool results |
| 6 | Edits | 166 | #d75f00 | edit/write tool results |
| 7 | Browser | 170 | #d75faf | browser_* tool results |
| 8 | Memory | 73 | #5fafaf | memory_* tool results |
| 9 | WEB_Search | 111 | #8fafaf | WEB_Search results |
| 10 | Design | 139 | #af5faf | apply/lint/export/diff_design results |
| 11 | Other Tools | 245 | #8a8a8a | Any tool results not matched above |
| 12 | Thinking | 127 | #af005f | ThinkingContent blocks |
| 13 | Tool Call Args | 130 | #af5f00 | ToolCall blocks (arguments model sends) |
| 14 | User Messages | 153 | #afd7ff | UserMessage entries |
| 15 | Assistant Text | 183 | #d7d7ff | TextContent blocks in assistant messages |
| 16 | Images | 204 | #ff5f5f | Image attachments in user messages |
| 17 | Compaction | 179 | #d7afd7 | CompactionSummaryMessage entries |
| 18 | Branch Summary | 188 | #d7afaf | BranchSummaryMessage entries |
| 19 | Extension Msgs | 216 | #ffd7af | CustomMessage entries |
| 20 | Cache Hit | 51 | #00ffff | Overlaid pattern — usage.cacheRead (not additive) |
| — | Free | 235 | #585858 | Remaining context window |

### Classification Logic

Each branch entry is classified into exactly one segment:

```
Walk ctx.sessionManager.getBranch() entries:

entry.type === "message":
  message.role === "user":
    Has ImageContent? → segment 16 (Images)
    Has TextContent? → segment 14 (User Messages)
  message.role === "assistant":
    Iterate content blocks and split tokens across them:
      ThinkingContent → segment 12 (Thinking)
      ToolCall → segment 13 (Tool Call Args)
      TextContent → segment 15 (Assistant Text)
  message.role === "toolResult":
    message.toolName === "read" → classify by path (from args):
      path matches */AGENTS.md* → segment 2
      path matches *SKILL.md* or */skills/* → segment 3
      else → segment 4 (File Reads)
    message.toolName === "bash" → segment 5 (Bash Output)
    message.toolName starts with "edit" or "write" → segment 6 (Edits)
    message.toolName starts with "browser" → segment 7 (Browser)
    message.toolName starts with "memory" → segment 8 (Memory)
    message.toolName === "WEB_Search" or "WEB_Research" → segment 9
    message.toolName matches "apply_design","lint_design","export_design","diff_design" → segment 10
    else → segment 11 (Other Tools)
  message.role === "bashExecution" → segment 5 (Bash Output)
  message.role === "custom" → segment 19 (Extension Msgs)

entry.type === "compaction":
  → segment 17 (Compaction)
  Note: compaction entries have .summary (text), .tokensBefore (number), and .firstKeptEntryId.
  Use .tokensBefore as the token count for this entry (not content length estimation).
```

### Token Estimation & Calibration

1. Walk the branch and estimate each entry's token count from content length (chars / 4 for English, chars / 3 for code-heavy content)
2. Sum all estimates per segment
3. Get actual `usage.input` from the latest assistant message
4. Scale all estimates proportionally: `segment.tokens = (estimate / totalEstimate) × usage.input`
5. Free = `contextWindow - usage.input` (exact, no estimation)

This calibration ensures segments always sum to `usage.input` exactly, and only the *proportions* between segments rely on estimation.

### Cache Hit Overlay

Cache hit is not an additive segment — it represents how much of the total input was served from cache. It's rendered as a patterned overlay (e.g., `░░` fill pattern inside the segments that were cached) or as a count in the info line: `cache:62%`.

## Bar Rendering

### Footer Layout

The bar replaces Pi's default footer via `ctx.ui.setFooter()`. Two lines:

```
Line 1: [████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░]
Line 2: ↑24k ↓3k $0.042 · cache:62% · turn 5
```

**Line 1 — The Bar:**
- Width: full terminal width
- Each segment rendered as `█` characters in its ANSI color
- Proportional width based on token count
- Segments under 1 character wide get a minimum of 1 character
- Free space rendered in dim `░` characters (ANSI 235)
- Cache hit overlay: segments that were cached get striped pattern or distinct rendering (segment color on `░` background)

**Line 2 — Compact Info:**
- `↑{input}` — total input tokens
- `↓{output}` — total output tokens
- `${cost}` — running cost
- `cache:{pct}%` — percentage of input that was cache hit
- `turn {n}` — current turn number

### Smart Bar Segments

The bar shows at most 10 segments: the top 9 by size plus "Free". Smaller segments are folded into "Other Tools" (segment 11). When the bar width is narrow (< 60 chars), fold to top 6 + Free.

**Minimum widths:**
- Any visible segment: minimum 1 character wide
- If bar would overflow, fold smallest segments into "Other"

### Rendering Trigger

The bar updates on these events:
- `message_end` (streaming token update)
- `turn_end` (final token counts for the turn)
- `model_select` (context window size may change)
- `session_start` (new session, reset)

An internal throttle prevents rendering more than once per second during streaming.

## /pistats Command

Registered via `pi.registerCommand("pistats", ...)`.

Displays the full legend with current values:

```
█ System     2.1k ( 4%)   █ AGENTS.md  800 ( 1%)   █ Skills    1.2k ( 2%)
█ Reads     12k  (24%)   █ Bash      8.4k (17%)   █ Edits     400 ( 1%)
█ Browser   2.3k ( 5%)   █ Memory    600 ( 1%)    █ WEB       1.1k ( 2%)
█ Design    300  ( 1%)    █ Other     200 ( 0%)    █ Thinking  3k  ( 6%)
█ ToolArgs  1.8k ( 4%)   █ User      2k  ( 4%)    █ AsstText  1.5k ( 3%)
█ Images    4k   ( 8%)   █ Compact    0  ( 0%)    █ Branch     0  ( 0%)
█ ExtMsgs    0   ( 0%)   ░ Free    10.5k(21%)
                                            Total: 50k/200k
```

Uses the same ANSI colors as the bar segment blocks. Shows `↑↓$` summary at bottom.

Accepts optional args:
- `/pistats` — current session breakdown
- `/pistats history` — last 10 sessions summary from SQLite
- `/pistats top` — top 5 segment bloaters across all sessions
- `/pistats session <id>` — specific session breakdown

## SQLite Database

### Location

`~/.pi/agent/pistats.db` — alongside Pi's existing session data.

### Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- session file UUID
  model TEXT NOT NULL,            -- model identifier
  context_window INTEGER NOT NULL,-- max context tokens
  cwd TEXT,                       -- working directory
  started_at TEXT NOT NULL,      -- ISO timestamp
  ended_at TEXT                   -- NULL if active
);

CREATE TABLE turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_index INTEGER NOT NULL,   -- 0-based turn number
  entry_id TEXT,                  -- JSONL entry ID
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read INTEGER NOT NULL DEFAULT 0,
  cache_write INTEGER NOT NULL DEFAULT 0,
  cost_total REAL NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  UNIQUE(session_id, turn_index)
);

CREATE TABLE segment_breakdown (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_id INTEGER NOT NULL REFERENCES turns(id),
  segment TEXT NOT NULL,          -- segment name (e.g., "system", "skills", "bash")
  tokens INTEGER NOT NULL DEFAULT 0,
  percentage REAL NOT NULL DEFAULT 0,
  UNIQUE(turn_id, segment)
);

CREATE INDEX idx_turns_session ON turns(session_id);
CREATE INDEX idx_segments_turn ON segment_breakdown(turn_id);
CREATE INDEX idx_sessions_time ON sessions(started_at);
```

### Write Timing

- **sessions**: Insert on `session_start`, update `ended_at` on `session_shutdown`
- **turns**: Insert on `turn_end` with final `usage` data
- **segment_breakdown**: Insert alongside each turn, computed by the attributor

All writes are batched in a single transaction per turn to minimize I/O.

## Event Hooks

```typescript
// Session lifecycle
pi.on("session_start", (event, ctx) => { /* create session row, init bar */ });
pi.on("session_shutdown", (event, ctx) => { /* update ended_at */ });

// Per-turn tracking
pi.on("turn_end", (event, ctx) => { /* compute attribution, write to DB, update bar */ });
pi.on("message_end", (event, ctx) => { /* update bar (throttled) */ });

// Model change (may change context window size)
pi.on("model_select", (event, ctx) => { /* update context window, re-render bar */ });

// Command registration
pi.registerCommand("pistats", { /* ... */ });
```

## Error Handling

- **No model loaded yet** (session_start before model_select): Bar shows empty, no percentages
- **No usage data yet** (first turn): Bar shows system prompt estimate only, segments start populating from turn 1
- **SQLite failure**: Falls back to in-memory tracking, retries DB open on next turn
- **Terminal too narrow** (< 40 chars): Hide bar, show only the info line
- **Zero-division protection**: If `usage.input === 0`, show empty bar

## Dependencies

- `better-sqlite3` — SQLite3 for Node.js (compiled native addon)
- `@earendil-works/pi-coding-agent` — Pi extension types (already available)
- `@earendil-works/pi-tui` — TUI rendering utilities (already available)

## Implementation Phases

### Phase 1: Core Extension + Bar
- Extension skeleton with event hooks
- Attributor that walks branch entries and classifies segments
- Bar renderer with proportional color blocks
- Calibration against actual `usage.input`
- `/pistats` command with legend

### Phase 2: SQLite Persistence
- Database schema and connection management
- Write turns and segment breakdowns on `turn_end`
- History and analytics commands

### Phase 3: Analytics & Polish
- `/pistats history` — cross-session summaries
- `/pistats top` — identify bloat sources
- Cache hit overlay rendering
- Narrow terminal graceful degradation