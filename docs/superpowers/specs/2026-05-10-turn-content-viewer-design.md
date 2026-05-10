# Turn Content Viewer

## Summary

Store message content (user + assistant) for each turn in the PiStats database, show a 100-char preview in the turns table, and display full content in a modal when a turn row is clicked. Full content auto-purges after 30 days, leaving only the truncated preview.

## Schema Changes

Add two columns to the existing `turns` table in `src/db.ts` — **one row per turn stays unchanged**:

- `user_content TEXT` — full user message text
- `assistant_content TEXT` — full assistant response text

**Migration**: Two ALTER TABLE statements:
```sql
ALTER TABLE turns ADD COLUMN user_content TEXT;
ALTER TABLE turns ADD COLUMN assistant_content TEXT;
```

Existing rows get NULL for both columns. No unique constraint changes. No existing queries break.

## Data Capture

In `src/index.ts`, the `turn_end` hook already accesses `ctx.sessionManager.getBranch()`. At turn end:

1. Find the latest assistant message (already done)
2. Find the preceding user message in the same turn
3. Pass both contents to `insertTurn` which stores them in `user_content` and `assistant_content` on the same row

### Content extraction

Branch entries have structure: `{ type: "message", message: { role: "user"|"assistant", content: string } }`. Content may be a string or an array of content blocks (text, tool_use, tool_result). For arrays, concatenate text blocks and skip tool-related blocks with a `[tool call]` / `[tool result]` placeholder.

## Retention

On `session_start`, run cleanup:

```sql
UPDATE turns SET
  user_content = CASE WHEN length(user_content) > 100 THEN SUBSTR(user_content, 1, 100) || '...' ELSE user_content END,
  assistant_content = CASE WHEN length(assistant_content) > 100 THEN SUBSTR(assistant_content, 1, 100) || '...' ELSE assistant_content END
WHERE timestamp < datetime('now', '-30 days')
  AND (length(user_content) > 100 OR length(assistant_content) > 100);
```

This keeps the row and its token data forever, but replaces full content with a 100-char truncated version after 30 days.

## Dashboard Changes

### Turn rows — 100-char preview

Each turn row in the turns table gets a muted subtitle line below the existing token data. Shows two lines:
- `👤 <user_content preview>` (first 100 chars)
- `🤖 <assistant_content preview>` (first 100 chars)

Skip a line if the content is NULL.

### Modal on click

Clicking any turn row opens a centered modal:

- **Header**: Turn index + two tabs or toggle to switch between User / Assistant content
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
| `src/db.ts` | Schema migration (add `user_content` + `assistant_content` columns) |
| `src/db.ts` | `insertTurn` now takes `userContent` + `assistantContent` params |
| `src/db.ts` | New `purgeOldContent()` function for 30-day cleanup |
| `src/index.ts` | `turn_end` hook: extract user + assistant content, pass to insertTurn |
| `src/index.ts` | `session_start` hook: call `purgeOldContent()` |
| `dashboard/index.html` | CSS: modal overlay + content styling |
| `dashboard/index.html` | JS: modal open/close logic, content rendering in turn rows |

## Edge Cases

- **Tool calls**: Content arrays with non-text blocks → show `[tool call]` / `[tool result]` placeholder
- **Very long content**: Modal body is scrollable, max-height capped
- **Empty content**: Skip the preview line, modal shows "(empty)"
- **Backward compat**: Old rows without content still render fine, just no preview/modal
- **DB migration**: ALTER TABLE is additive, existing data preserved
