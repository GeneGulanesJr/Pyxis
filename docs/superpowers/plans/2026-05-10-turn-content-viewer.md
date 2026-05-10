# Turn Content Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Use Sequential mode for planned tasks or Direct mode if subagents aren't available. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store user+assistant message content per turn, show 100-char previews in the turns table, display full content in a modal on click, auto-purge full content after 30 days.

**Architecture:** Add `user_content` and `assistant_content` columns to the existing `turns` table. Capture content in the `turn_end` hook from Pi's branch entries. Dashboard shows truncated previews and opens a modal on click. 30-day cleanup runs on session start.

**Tech Stack:** TypeScript (extension), SQLite via sql.js, vanilla HTML/CSS/JS (dashboard)

---

### Task 1: Schema Migration — Add content columns to turns table

**Files:**
- Modify: `src/db.ts:41-55` (CREATE TABLE turns)
- Modify: `src/db.ts:62-64` (after indexes)

- [ ] **Step 1: Add columns to CREATE TABLE statement**

In `src/db.ts`, add `user_content TEXT` and `assistant_content TEXT` to the turns CREATE TABLE block (after `timestamp TEXT NOT NULL,`):

```typescript
      timestamp TEXT NOT NULL,
      user_content TEXT,
      assistant_content TEXT,
      UNIQUE(session_id, turn_index)
```

- [ ] **Step 2: Add migration for existing databases**

After the CREATE INDEX lines (around line 64), add migration logic that alters existing tables:

```typescript
  // Migrate: add content columns if they don't exist (existing DBs)
  try {
    const cols = db.exec("PRAGMA table_info(turns)");
    const colNames = cols[0]?.values?.map((r: any) => r[1]) || [];
    if (!colNames.includes('user_content')) {
      db.run('ALTER TABLE turns ADD COLUMN user_content TEXT');
    }
    if (!colNames.includes('assistant_content')) {
      db.run('ALTER TABLE turns ADD COLUMN assistant_content TEXT');
    }
  } catch {
    // Table doesn't exist yet — CREATE TABLE handles it
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd src && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/db.ts
git commit -m "feat(db): add user_content and assistant_content columns to turns table"
```

---

### Task 2: Update insertTurn to accept and store content

**Files:**
- Modify: `src/db.ts:131-169` (insertTurn function)

- [ ] **Step 1: Update insertTurn signature and SQL**

Replace the `insertTurn` function signature and SQL to include content params:

```typescript
export async function insertTurn(
  sessionId: string,
  turnIndex: number,
  entryId: string | null,
  attribution: AttributionResult,
  userContent: string | null = null,
  assistantContent: string | null = null,
): Promise<void> {
  try {
    const database = await getDb();
    const timestamp = new Date().toISOString();
    const cacheRead = attribution.cacheReadPct > 0
      ? Math.round(attribution.totalInput * attribution.cacheReadPct / 100)
      : 0;

    database.run(
      `INSERT OR REPLACE INTO turns (session_id, turn_index, entry_id, input_tokens, output_tokens, cache_read, cache_write, cost_total, timestamp, user_content, assistant_content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, turnIndex, entryId, attribution.totalInput, attribution.totalOutput,
       cacheRead, 0, attribution.totalCost, timestamp, userContent, assistantContent]
    );
```

Keep the rest of the function (segment breakdown insertion) unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd src && npx tsc --noEmit`
Expected: No errors (the existing call sites pass fewer args, but the new params have defaults)

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat(db): insertTurn accepts userContent and assistantContent params"
```

---

### Task 3: Add 30-day content purge function

**Files:**
- Modify: `src/db.ts` (add new exported function after `closeDb`)

- [ ] **Step 1: Add purgeOldContent function**

Add after the `closeDb` function (around line 105):

```typescript
/** Purge full content from turns older than 30 days, keeping 100-char preview */
export async function purgeOldContent(): Promise<void> {
  try {
    const database = await getDb();
    database.run(`
      UPDATE turns SET
        user_content = CASE WHEN length(user_content) > 100 THEN SUBSTR(user_content, 1, 100) || '...' ELSE user_content END,
        assistant_content = CASE WHEN length(assistant_content) > 100 THEN SUBSTR(assistant_content, 1, 100) || '...' ELSE assistant_content END
      WHERE timestamp < datetime('now', '-30 days')
        AND (length(user_content) > 100 OR length(assistant_content) > 100)
    `);
    saveDb();
  } catch (e) {
    console.error("[PiStats] Failed to purge old content:", e);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd src && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat(db): add purgeOldContent for 30-day content retention"
```

---

### Task 4: Capture content in turn_end hook

**Files:**
- Modify: `src/index.ts:148-160` (turn_end handler)

- [ ] **Step 1: Add content extraction helper**

Add a helper function before the `pi.on("turn_end", ...)` block (around line 145):

```typescript
  function extractContent(message: any): string | null {
    if (!message?.content) return null;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((block: any) => {
        if (block.type === 'text') return block.text;
        if (block.type === 'tool_use') return '[tool call]';
        if (block.type === 'tool_result') return '[tool result]';
        return '';
      }).filter(Boolean).join('\n');
    }
    return null;
  }
```

- [ ] **Step 2: Update turn_end handler to extract and pass content**

Replace the turn_end handler's DB insertion block:

```typescript
  pi.on("turn_end", async (_event, ctx) => {
    computeFromContext(ctx);
    updateFooter(ctx);

    if (currentAttribution) {
      try {
        const branch = ctx.sessionManager.getBranch();
        const latestAssistant = branch.findLast((e: any) => e.type === "message" && e.message?.role === "assistant");
        const latestUser = branch.findLast((e: any) => e.type === "message" && e.message?.role === "user");
        const userContent = latestUser ? extractContent(latestUser.message) : null;
        const assistantContent = latestAssistant ? extractContent(latestAssistant.message) : null;
        await db.insertTurn(
          currentSessionId,
          currentAttribution.turnCount,
          latestAssistant?.id || null,
          currentAttribution,
          userContent,
          assistantContent,
        );
      } catch (e) {
        console.error("[PiStats] Failed to record turn:", e);
      }
    }
  });
```

- [ ] **Step 3: Add purge call to session_start**

In the `session_start` handler (around line 120), after the existing `db.insertSession` call, add:

```typescript
    try {
      await db.purgeOldContent();
    } catch (e) {
      console.error("[PiStats] Failed to purge old content:", e);
    }
```

Place it after the `db.insertSession` try/catch block, inside the `session_start` handler.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd src && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: capture user+assistant content in turn_end, purge on session_start"
```

---

### Task 5: Dashboard — Add content preview to turn rows

**Files:**
- Modify: `dashboard/index.html:718-745` (renderTurnsTable function)

- [ ] **Step 1: Update renderTurnsTable to show content previews**

Replace the `return \`<tr>...</tr>\`` block to add a second row with content previews below each turn:

Find this exact block in `renderTurnsTable`:
```
    return `<tr>
      <td style="font-weight:500">T${t.turn_index}</td>
      <td class="mono">${fmtTokens(inp)}</td>
      <td class="mono" style="color:var(--text-secondary)">${fmtTokens(newT)}</td>
      <td class="mono" style="color:var(--success)">${fmtTokens(cached)}</td>
      <td><div class="cache-bar"><div class="cb-cached" style="width:${cpct}%"></div><div class="cb-new" style="width:${npct}%"></div></div> <span style="font-size:0.75rem;color:var(--text-dim)">${fmtPct(cpct)}</span></td>
      <td>${deltaHtml}</td>
      <td class="mono">${fmtTokens(t.output_tokens)}</td>
      <td class="mono">${fmtCost(calcCost(model,inp,t.output_tokens||0,t.cache_read||0,0))}</td>
      <td class="mono" style="color:var(--text-dim)">${fmtTime(t.timestamp)}</td>
    </tr>`;
```

Replace with:
```
    const previewStyle='font-size:0.72rem;color:var(--text-dim);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    let previewHtml='';
    if(t.user_content||t.assistant_content){
      const lines=[];
      if(t.user_content) lines.push(`<span style="${previewStyle}">👤 ${escHtml(t.user_content.substring(0,100))}</span>`);
      if(t.assistant_content) lines.push(`<span style="${previewStyle}">🤖 ${escHtml(t.assistant_content.substring(0,100))}</span>`);
      previewHtml=`<div style="margin-top:4px;display:flex;flex-direction:column;gap:1px">${lines.join('')}</div>`;
    }
    return `<tr class="turn-row" data-turn="${t.turn_index}" style="cursor:pointer">
      <td style="font-weight:500">T${t.turn_index}</td>
      <td class="mono">${fmtTokens(inp)}</td>
      <td class="mono" style="color:var(--text-secondary)">${fmtTokens(newT)}</td>
      <td class="mono" style="color:var(--success)">${fmtTokens(cached)}</td>
      <td><div class="cache-bar"><div class="cb-cached" style="width:${cpct}%"></div><div class="cb-new" style="width:${npct}%"></div></div> <span style="font-size:0.75rem;color:var(--text-dim)">${fmtPct(cpct)}</span></td>
      <td>${deltaHtml}</td>
      <td class="mono">${fmtTokens(t.output_tokens)}</td>
      <td class="mono">${fmtCost(calcCost(model,inp,t.output_tokens||0,t.cache_read||0,0))}</td>
      <td class="mono" style="color:var(--text-dim)">${fmtTime(t.timestamp)}</td>
    </tr>${previewHtml?'<tr><td colspan="9" style="padding:0 0.75rem 0.5rem 0.75rem;border-top:none">'+previewHtml+'</td></tr>':''}`;
```

- [ ] **Step 2: Add escHtml helper**

Add this helper function before `renderTurnsTable` (around line 716):

```javascript
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node -e "const fs=require('fs'); const html=fs.readFileSync('dashboard/index.html','utf8'); const scripts=html.match(/<script>([\\s\\S]*?)<\\/script>/g)||[]; const main=scripts[scripts.length-1].replace(/<script>|<\\/script>/g,''); require('fs').writeFileSync('/tmp/ts5.js',main);" && node --check /tmp/ts5.js && echo 'OK'`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add dashboard/index.html
git commit -m "feat(dashboard): show content preview under each turn row"
```

---

### Task 6: Dashboard — Add modal CSS and HTML

**Files:**
- Modify: `dashboard/index.html` (CSS section + HTML body)

- [ ] **Step 1: Add modal CSS**

Add before the closing `</style>` tag:

```css
/* Turn content modal */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;}
.modal-overlay.active{display:flex;}
.modal{background:var(--surface-solid);border:1px solid var(--border);border-radius:var(--radius-lg);width:90%;max-width:720px;max-height:80vh;display:flex;flex-direction:column;}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border);}
.modal-header h3{font-size:0.85rem;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;}
.modal-tabs{display:flex;gap:0.5rem;}
.modal-tab{padding:0.3rem 0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:0.78rem;cursor:pointer;font-family:inherit;}
.modal-tab.active{background:var(--text);color:var(--bg);border-color:var(--text);}
.modal-close{background:none;border:none;color:var(--text-dim);font-size:1.2rem;cursor:pointer;padding:0.25rem;line-height:1;}
.modal-close:hover{color:var(--text);}
.modal-body{padding:1.25rem;overflow-y:auto;flex:1;font-size:0.88rem;line-height:1.7;color:var(--text);white-space:pre-wrap;word-break:break-word;}
.modal-body code,.modal-body pre{font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.06);padding:0.15em 0.4em;border-radius:4px;font-size:0.82em;}
.modal-body pre{padding:0.75rem 1rem;overflow-x:auto;}
```

- [ ] **Step 2: Add modal HTML**

Add before `</body>`:

```html
<div class="modal-overlay" id="turnModal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="modalTitle">Turn</h3>
      <div class="modal-tabs">
        <button class="modal-tab active" data-role="user">User</button>
        <button class="modal-tab" data-role="assistant">Assistant</button>
      </div>
      <button class="modal-close" id="modalClose">&times;</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node -e "const fs=require('fs'); const html=fs.readFileSync('dashboard/index.html','utf8'); const scripts=html.match(/<script>([\\s\\S]*?)<\\/script>/g)||[]; const main=scripts[scripts.length-1].replace(/<script>|<\\/script>/g,''); require('fs').writeFileSync('/tmp/ts6.js',main);" && node --check /tmp/ts6.js && echo 'OK'`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add dashboard/index.html
git commit -m "feat(dashboard): add turn content modal CSS and HTML structure"
```

---

### Task 7: Dashboard — Add modal open/close JavaScript

**Files:**
- Modify: `dashboard/index.html` (script section)

- [ ] **Step 1: Add modal JS logic**

Add before the event listener block at the end of the script (before `document.getElementById('dropArea')`):

```javascript
// Turn content modal
let currentModalTurn=null;
function openTurnModal(turn){
  currentModalTurn=turn;
  const modal=document.getElementById('turnModal');
  document.getElementById('modalTitle').textContent='Turn '+turn.turn_index;
  // Default to user tab if content exists, else assistant
  const hasUser=!!turn.user_content;
  const hasAssistant=!!turn.assistant_content;
  document.querySelectorAll('.modal-tab').forEach(tab=>{
    const role=tab.dataset.role;
    tab.classList.toggle('active',role==='user'?hasUser:!hasUser&&role==='assistant');
  });
  showModalContent(turn,'user');
  if(!hasUser&&hasAssistant) showModalContent(turn,'assistant');
  modal.classList.add('active');
  document.addEventListener('keydown',closeModalOnEsc);
}
function showModalContent(turn,role){
  const body=document.getElementById('modalBody');
  const content=role==='user'?turn.user_content:turn.assistant_content;
  body.textContent=content||'(empty)';
}
function closeTurnModal(){
  document.getElementById('turnModal').classList.remove('active');
  document.removeEventListener('keydown',closeModalOnEsc);
  currentModalTurn=null;
}
function closeModalOnEsc(e){if(e.key==='Escape')closeTurnModal();}

document.getElementById('modalClose').addEventListener('click',closeTurnModal);
document.getElementById('turnModal').addEventListener('click',e=>{if(e.target.id==='turnModal')closeTurnModal();});
document.querySelectorAll('.modal-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    if(currentModalTurn) showModalContent(currentModalTurn,tab.dataset.role);
  });
});

// Click handler for turn rows — delegated
document.getElementById('turnsTable').addEventListener('click',e=>{
  const row=e.target.closest('tr.turn-row');
  if(!row) return;
  const idx=parseInt(row.dataset.turn);
  const turn=allTurns.find(t=>t.turn_index===idx);
  if(turn&&(turn.user_content||turn.assistant_content)) openTurnModal(turn);
});
```

- [ ] **Step 2: Expose turns data for click handler**

In `renderTurnsTable`, add a line at the top to store the turns array globally:

Change:
```javascript
function renderTurnsTable(turns,model){
  let prevNew=null;
```

To:
```javascript
let allTurns=[];
function renderTurnsTable(turns,model){
  allTurns=turns;
  let prevNew=null;
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node -e "const fs=require('fs'); const html=fs.readFileSync('dashboard/index.html','utf8'); const scripts=html.match(/<script>([\\s\\S]*?)<\\/script>/g)||[]; const main=scripts[scripts.length-1].replace(/<script>|<\\/script>/g,''); require('fs').writeFileSync('/tmp/ts7.js',main);" && node --check /tmp/ts7.js && echo 'OK'`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add dashboard/index.html
git commit -m "feat(dashboard): modal open/close with user/assistant tab toggle"
```

---

### Task 8: Build, verify, push

**Files:** None (verification only)

- [ ] **Step 1: Compile TypeScript**

Run: `cd src && npx tsc`
Expected: Clean compilation

- [ ] **Step 2: Full syntax check on dashboard**

Run: `node -e "const fs=require('fs'); const html=fs.readFileSync('dashboard/index.html','utf8'); const scripts=html.match(/<script>([\\s\\S]*?)<\\/script>/g)||[]; const main=scripts[scripts.length-1].replace(/<script>|<\\/script>/g,''); require('fs').writeFileSync('/tmp/ts8.js',main);" && node --check /tmp/ts8.js && echo 'OK'`
Expected: `OK`

- [ ] **Step 3: Push all commits**

```bash
git push origin main
```

Expected: All commits pushed successfully
