/**
 * PiStats — Context window attribution bar for Pi Agent.
 * Shows a color-coded stats bar in the TUI footer and
 * registers /pistats command for detailed breakdown.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { computeAttribution, type AttributionResult, type Usage } from "./attributor.js";
import { renderBar, renderInfoLine, renderLegend } from "./bar-renderer.js";
import { formatTokens, formatCost } from "./format.js";

const RENDER_THROTTLE_MS = 1000;

export default function (pi: ExtensionAPI) {
  let currentAttribution: AttributionResult | null = null;
  let enabled = false;
  let lastRenderTime = 0;

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
              return [theme.dim("PiStats: no data yet")];
            }
            const bar = renderBar(currentAttribution.segments, currentAttribution.freeTokens, w);
            const info = renderInfoLine(
              currentAttribution.totalInput,
              currentAttribution.totalOutput,
              currentAttribution.totalCost,
              currentAttribution.cacheReadPct,
              currentAttribution.turnCount,
              w,
            );
            return [...bar, info];
          } catch (e) {
            return [theme.dim("PiStats: error rendering")];
          }
        },
      };
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    currentAttribution = null;
    // Auto-enable on session start if not explicitly disabled
    if (!enabled) {
      enabled = true;
    }
    updateFooter(ctx);
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    currentAttribution = null;
  });

  pi.on("turn_end", async (_event, ctx) => {
    computeFromContext(ctx);
    updateFooter(ctx);
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
    computeFromContext(ctx);
    updateFooter(ctx);
  });

  pi.registerCommand("pistats", {
    description: "Show token attribution legend and detailed breakdown",
    handler: async (args, ctx) => {
      computeFromContext(ctx);

      if (!currentAttribution) {
        ctx.ui.notify("No attribution data yet — send a message first", "info");
        return;
      }

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

      // Show legend with current values
      const lines = renderLegend(
        currentAttribution.segments,
        currentAttribution.freeTokens,
        currentAttribution.contextWindow,
        currentAttribution.totalInput,
      );
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}