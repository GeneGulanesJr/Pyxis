/**
 * Pẙxis — Context window attribution bar for Pi Agent.
 * Shows a color-coded stats bar in the TUI footer and
 * registers /pẙxis command for detailed breakdown.
 *
 * pýxis (πυξίς) — a small box for keeping precious things.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { computeAttribution, type AttributionResult, type Usage } from "./attributor.js";
import { renderBar, renderInfoLine, renderLegend } from "./bar-renderer.js";
import { formatTokens, formatCost } from "./format.js";
import * as db from "./db.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { execSync } from "node:child_process";

const RENDER_THROTTLE_MS = 1000;

export default function (pi: ExtensionAPI) {
  let currentAttribution: AttributionResult | null = null;
  let enabled = false;
  let lastRenderTime = 0;
  let currentSessionId = "ephemeral";
  let thinkingLevel: string = "off";

  // Capture initial thinking level
  try {
    thinkingLevel = pi.getThinkingLevel?.() || "off";
  } catch {
    thinkingLevel = "off";
  }

  function getSessionId(ctx: any): string {
    try {
      return ctx.sessionManager?.getSessionFile?.() || "ephemeral";
    } catch {
      return "ephemeral";
    }
  }

  function computeFromContext(ctx: any): void {
    try {
      const branch = ctx.sessionManager.getBranch();
      const systemPrompt = typeof ctx.getSystemPrompt === "function" ? ctx.getSystemPrompt() : "";
      const model = ctx.model;
      const contextWindow = model?.contextWindow || 200000;

      // Get latest usage from branch
      let usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };
      for (const entry of branch) {
        if (entry.type === "message" && entry.message?.role === "assistant") {
          const m = entry.message as AssistantMessage;
          if (m.usage) {
            usage = {
              input: m.usage.input || 0,
              output: m.usage.output || 0,
              cacheRead: m.usage.cacheRead || 0,
              cacheWrite: m.usage.cacheWrite || 0,
              totalTokens: m.usage.totalTokens || 0,
              cost: m.usage.cost ? { total: m.usage.cost.total || 0 } : undefined,
            };
          }
        }
      }

      currentAttribution = computeAttribution(branch, systemPrompt, usage, contextWindow);
      const turnCount = branch.filter((e: any) => e.type === "message" && e.message?.role === "assistant").length;
      currentAttribution.turnCount = turnCount;
    } catch (e) {
      console.error("[PiStats] Error computing attribution:", e);
    }
  }

  function updateFooter(ctx: any): void {
    if (!enabled) return;

    ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
      const unsub = footerData.onBranchChange?.(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(w: number): string[] {
          try {
            computeFromContext(ctx);
            if (!currentAttribution) {
              return [theme?.dim?.("PiStats: no data yet") ?? "PiStats: no data yet"];
            }
            const bar = renderBar(currentAttribution.segments, currentAttribution.freeTokens, w, currentAttribution.totalInput, currentAttribution.contextWindow);
            const info = renderInfoLine(
              currentAttribution.totalInput,
              currentAttribution.totalOutput,
              currentAttribution.totalCost,
              currentAttribution.cacheReadPct,
              currentAttribution.turnCount,
              w,
              currentAttribution.contextWindow,
              ctx.model?.id,
              thinkingLevel,
            );
            return [...bar, info];
          } catch (e) {
            return [theme?.dim?.("PiStats: error rendering") ?? "PiStats: error rendering"];
          }
        },
      };
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    currentAttribution = null;
    if (!enabled) {
      enabled = true;
    }
    currentSessionId = getSessionId(ctx);

    // Record session start in DB
    try {
      await db.insertSession(
        currentSessionId,
        ctx.model?.id || "unknown",
        ctx.model?.contextWindow || 200000,
        ctx.cwd || process.cwd(),
      );
    } catch (e) {
      console.error("[PiStats] Failed to record session start:", e);
    }

    // Purge old content (30-day retention)
    try {
      await db.purgeOldContent();
    } catch (e) {
      console.error("[PiStats] Failed to purge old content:", e);
    }

    updateFooter(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    currentAttribution = null;

    try {
      await db.updateSessionEnd(currentSessionId);
      await db.closeDb();
    } catch (e) {
      console.error("[PiStats] Failed to record session end:", e);
    }
  });

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

  pi.on("message_update", async (_event, ctx) => {
    const now = Date.now();
    if (now - lastRenderTime < RENDER_THROTTLE_MS) return;
    lastRenderTime = now;
    computeFromContext(ctx);
    updateFooter(ctx);
  });

  pi.on("message_end", async (_event, ctx) => {
    computeFromContext(ctx);
    updateFooter(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    // Re-capture thinking level in case model change clamped it
    try {
      thinkingLevel = pi.getThinkingLevel?.() || thinkingLevel;
    } catch {}
    computeFromContext(ctx);
    updateFooter(ctx);
  });

  pi.on("thinking_level_select", async (_event, _ctx) => {
    try {
      thinkingLevel = pi.getThinkingLevel?.() || "off";
    } catch {}
    updateFooter(_ctx);
  });

  let dashboardServer: ReturnType<typeof createServer> | null = null;
  let dashboardPort: number = 0;

  function openDashboard(ctx: any): void {
    try {
      // Ensure DB is saved before serving
      db.flushDb();

      const dbPath = db.getDbPath();
      if (!existsSync(dbPath)) {
        ctx.ui.notify("No PiStats data yet — start a session first.", "info");
        return;
      }

      const extDir = import.meta.dirname;
      const searchPaths = [
        join(extDir, "..", "dashboard", "index.html"),
        join(extDir, "dashboard", "index.html"),
        join(extDir, "dashboard.html"),
      ];

      let html: string | undefined;
      for (const p of searchPaths) {
        try {
          html = readFileSync(p, "utf-8");
          break;
        } catch { /* try next */ }
      }

      if (!html) {
        ctx.ui.notify("Could not find dashboard HTML. Searched: " + searchPaths.join(", "), "info");
        return;
      }

      // Embed the DB directly into the HTML as base64 — no fetch, no race conditions
      const dbBuffer = readFileSync(dbPath);
      const dbBase64 = dbBuffer.toString('base64');

      const bridgeScript = `
<script>
window.addEventListener('DOMContentLoaded', function() {
  initSqlJs({ locateFile: function(f) { return 'https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/' + f; } }).then(function(SQL) {
    try {
      var raw = atob('${dbBase64}');
      var buf = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      db = new SQL.Database(buf);
      document.getElementById('dropzone').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      loadPricing().then(function() { showSessionDetail(${JSON.stringify(currentSessionId)}); });
    } catch(e) { console.error('PiStats auto-load failed:', e); }
  });
});
</script>`;
      html = html.replace('</head>', bridgeScript + '\n</head>');

      // Close existing server if running
      if (dashboardServer) {
        try { dashboardServer.close(); } catch {}
      }

      dashboardServer = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });

      // Find available port
      dashboardPort = 9832 + Math.floor(Math.random() * 100);
      dashboardServer.listen(dashboardPort, () => {
        const url = `http://localhost:${dashboardPort}`;
        ctx.ui.notify(`PiStats dashboard: ${url}`, "info");

        // Open in default browser
        try {
          if (process.platform === "darwin") {
            execSync(`open "${url}"`, { stdio: "ignore" });
          } else if (process.platform === "win32") {
            execSync(`start "" "${url}"`, { stdio: "ignore" });
          } else {
            execSync(`xdg-open "${url}" 2>/dev/null`, { stdio: "ignore" });
          }
        } catch (e) {
          // Fallback: show URL for manual open
          ctx.ui.notify(`Open in browser: ${url}`, "info");
        }
      });

      // Auto-close after 5 seconds — DB is embedded in HTML, pricing fetched by browser from OpenRouter
      // Server only needed for the initial page load
      setTimeout(() => {
        if (dashboardServer) {
          try { dashboardServer.close(); } catch {}
          dashboardServer = null;
        }
      }, 5000);

    } catch (e) {
      ctx.ui.notify("Failed to open dashboard: " + (e as Error).message, "info");
    }
  }

  pi.registerCommand("pistats", {
    description: "Open PiStats dashboard in browser",
    handler: async (args, ctx) => {
      const trimmedArgs = (args || "").trim();

      if (trimmedArgs === "off") {
        enabled = false;
        ctx.ui.setFooter(undefined);
        ctx.ui.notify("PiStats bar disabled", "info");
        return;
      }

      if (trimmedArgs === "on") {
        enabled = true;
        computeFromContext(ctx);
        updateFooter(ctx);
        ctx.ui.notify("PiStats bar enabled", "info");
        return;
      }

      if (trimmedArgs === "bar") {
        // Legacy: show TUI legend
        computeFromContext(ctx);
        if (!currentAttribution) {
          ctx.ui.notify("No attribution data yet — send a message first", "info");
          return;
        }
        const lines = renderLegend(
          currentAttribution.segments,
          currentAttribution.freeTokens,
          currentAttribution.contextWindow,
          currentAttribution.totalInput,
        );
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (trimmedArgs === "history") {
        try {
          const sessions = await db.getRecentSessions(10);
          if (sessions.length === 0) {
            ctx.ui.notify("No session history yet", "info");
            return;
          }
          const lines = sessions.map((s: any) => {
            const date = s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "?";
            return `${date} ${s.model}: ↑${formatTokens(s.totalInput || 0)} ↓${formatTokens(s.totalOutput || 0)} ${formatCost(s.totalCost || 0)}`;
          });
          ctx.ui.notify(lines.join("\n"), "info");
        } catch (e) {
          ctx.ui.notify("Error reading session history", "info");
        }
        return;
      }

      if (trimmedArgs === "top") {
        try {
          const segments = await db.getTopSegments(5);
          if (segments.length === 0) {
            ctx.ui.notify("No data yet — send a message first", "info");
            return;
          }
          const lines = segments.map((s: any) =>
            `${s.segment}: ${formatTokens(s.totalTokens)} avg ${Number(s.avgPct).toFixed(1)}%`
          );
          ctx.ui.notify(lines.join("\n"), "info");
        } catch (e) {
          ctx.ui.notify("Error reading segment data", "info");
        }
        return;
      }

      if (trimmedArgs.startsWith("session")) {
        const sessionId = trimmedArgs.slice(7).trim();
        if (!sessionId) {
          ctx.ui.notify(`Current session: ${currentSessionId}`, "info");
          return;
        }
        try {
          const turns = await db.getSessionTurns(sessionId);
          if (turns.length === 0) {
            ctx.ui.notify(`No turns found for session: ${sessionId}`, "info");
            return;
          }
          const lines = turns.map((t: any) =>
            `Turn ${t.turnIndex}: ↑${formatTokens(t.inputTokens)} ↓${formatTokens(t.outputTokens)} cache:${Math.round((t.cacheRead / Math.max(t.inputTokens, 1)) * 100)}% ${formatCost(t.costTotal)}`
          );
          ctx.ui.notify(lines.join("\n"), "info");
        } catch (e) {
          ctx.ui.notify(`Error reading session: ${sessionId}`, "info");
        }
        return;
      }

      // Default: open dashboard in browser
      openDashboard(ctx);
    },
  });
}