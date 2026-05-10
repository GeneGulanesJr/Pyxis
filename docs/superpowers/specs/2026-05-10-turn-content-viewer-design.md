# Turn Content Viewer

## Summary

Store message content (user + assistant) for each turn in the PiStats database, show a 100-char preview in the turns table, and display full content in a modal when a turn row is clicked. Full content auto-purges after 30 days, leaving only the truncated preview.

## Schema Changes

Add to `turns` table in `src/db.ts`:

- `role TEXT NOT NULL` — `"user"` or `"assistant"`
- `content TEXT` — full message text (nullable for backward compat)

**Migration**: `ALTER TABLE turns ADD COLUMN role TEXT NOT NULL DEFAULT 'assistant'` and `ALTER TABLE turns ADD COLUMN content TEXT`. Existing rows get `role='assistant'` and `content=NULL`.

## Data Capture

In `src/index.ts`, the `turn_end` hook already accesses `ctx.sessionManager.getBranch()`. At turn end:

1. Find the latest assistant message (already done)
2. Find the preceding user message in the same turn
3. Insert **two rows** into `turns` — one with `role='user'`, one with `role='assistant'`, both sharing the same `turn_index`
4. Each row gets its respective `content`

The `turn_index` + `role` combo becomes unique (replace `UNIQUE(session_id, turn_index)` with `UNIQUE(session_id, turn_index, role)`).

### Content extraction

Branch entries have structure: `{ type: "message", message: { role: "user"|"assistant", content: string } }`. Content may be a string or an array of content blocks (text, tool_use, tool_result). For arrays, concatenate text blocks and skip tool-related blocks with a `[tool call]` / `[tool result]` placeholder.

## Retention

On `session_start`, run cleanup:

```sql
UPDATE turns SET content = SUBSTR(content, 1, 100) || '...'
WHERE timestamp < datetime('now', '-30 days')
  AND length(content) > 100;
```

This keeps the row and its token data forever, but replaces full content with a 100-char truncated version after 30 days.

## Dashboard Changes

### Turn rows — 100-char preview

Each turn row in the turns table gets a muted subtitle line below the existing token columns showing the 100-char truncated content. User rows get a dim user icon, assistant rows get a dim assistant icon.

### Modal on click

Clicking any turn row opens a centered modal:

- **Header**: Role badge ("User" / "Assistant") + turn index
- **Body**: Full content, scrollable. Code blocks rendered in monospace.
- **Footer**: Close button
- **Dismiss**: Click outside modal, press Escape, or click close button

### Warp styling

Modal uses existing design tokens:
- Background: `var(--surface-solid)` (#1a1a1a)
- Border: `var(--border)` (rgba(226,226,226,0.35))
- Text: `var(--text)` (#faf9f6)
- Dim text: `var(--text-dim)` (#868584)
- Border radius: `var(--radius-lg)` (12px)
- No animations, no glassmorphism — calm and instant like the rest of the Warp design

## Files Changed

| File | Change |
|------|--------|
| `src/db.ts` | Schema migration (add role + content columns, change unique constraint) |
| `src/db.ts` | `insertTurn` now takes role + content params |
| `src/db.ts` | New `purgeOldContent()` function for 30-day cleanup |
| `src/index.ts` | `turn_end` hook: extract user + assistant content, insert two rows |
| `src/index.ts` | `session_start` hook: call `purgeOldContent()` |
| `dashboard/index.html` | CSS: modal overlay + content styling |
| `dashboard/index.html` | JS: modal open/close logic, content rendering in turn rows |

## Edge Cases

- **Tool calls**: Content arrays with non-text blocks → show `[tool call]` / `[tool result]` placeholder
- **Very long content**: Modal body is scrollable, max-height capped
- **Empty content**: Skip the preview line, modal shows "(empty)"
- **Backward compat**: Old rows without content still render fine, just no preview/modal
- **DB migration**: ALTER TABLE is additive, existing data preserved
