/**
 * PiStats token attribution engine.
 * Walks branch entries, estimates tokens per segment, calibrates against actual usage.
 */

import { SEGMENTS, SEGMENT_IDS, SEGMENT_MAP, IMAGE_TOKEN_ESTIMATE } from "./segments.js";
import type { SegmentId } from "./segments.js";
import { buildToolCallLookup } from "./classify.js";
import { estimateTokens } from "./format.js";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost?: { total: number };
}

export interface SegmentTokens {
  segmentId: string;
  name: string;
  tokens: number;
  percentage: number;
}

export interface AttributionResult {
  segments: SegmentTokens[];
  segmentMap: Map<string, SegmentTokens>;
  totalInput: number;
  totalOutput: number;
  cacheReadPct: number;
  totalCost: number;
  freeTokens: number;
  contextWindow: number;
  turnCount: number;
}

/** Get text length from content blocks */
function getContentLength(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;

  let totalLength = 0;
  for (const block of content) {
    if (typeof block === "string") { totalLength += block.length; continue; }
    if (block && typeof block === "object") {
      if ("text" in block && typeof block.text === "string") totalLength += block.text.length;
      if ("thinking" in block && typeof block.thinking === "string") totalLength += block.thinking.length;
      if ("arguments" in block && typeof block.arguments === "object") totalLength += JSON.stringify(block.arguments).length;
      if ("output" in block && typeof block.output === "string") totalLength += block.output.length;
      if ("command" in block && typeof block.command === "string") totalLength += block.command.length;
    }
  }
  return totalLength;
}

/** Count images in user message content */
function countImages(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.filter((b: any) => b?.type === "image").length;
}

/** Classify a toolResult message to a segment id */
function classifyToolResult(msg: any, toolCallLookup: Map<string, Record<string, unknown>>): SegmentId {
  const toolName = msg.toolName || "";
  const toolCallId = msg.toolCallId || "";
  const args = toolCallLookup.get(toolCallId);

  if (toolName === "read" && args?.path) {
    const path = String(args.path);
    if (path.includes("AGENTS.md")) return "agentsMd";
    if (path.includes("SKILL.md") || path.includes("/skills/")) return "skills";
    return "fileReads";
  }
  if (toolName === "bash") return "bash";
  if (toolName === "edit" || toolName === "write") return "edits";
  if (toolName.startsWith("browser")) return "browser";
  if (toolName.startsWith("memory")) return "memory";
  if (toolName === "WEB_Search" || toolName === "WEB_Research") return "webSearch";
  if (["apply_design", "lint_design", "export_design", "diff_design"].includes(toolName)) return "design";

  return "otherTools";
}

/** Compute token attribution for a branch of entries */
export function computeAttribution(
  entries: any[],
  systemPrompt: string,
  usage: Usage,
  contextWindow: number,
): AttributionResult {
  const segmentEstimates = new Map<SegmentId, number>();
  for (const id of SEGMENT_IDS) {
    segmentEstimates.set(id as SegmentId, 0);
  }

  // System prompt
  segmentEstimates.set("system", estimateTokens(systemPrompt));

  // Build tool call lookup (Pass 1)
  const toolCallLookup = buildToolCallLookup(entries);

  // Walk entries and estimate tokens (Pass 2)
  let imageCount = 0;

  for (const entry of entries) {
    if (entry.type === "compaction") {
      const current = segmentEstimates.get("compaction")!;
      segmentEstimates.set("compaction", current + (entry.tokensBefore || 0));
      continue;
    }

    if (entry.type !== "message" || !entry.message) continue;
    const msg = entry.message;

    if (msg.role === "user") {
      const imgs = countImages(msg.content);
      if (imgs > 0) {
        imageCount += imgs;
        segmentEstimates.set("images", segmentEstimates.get("images")! + imgs * IMAGE_TOKEN_ESTIMATE);
      }
      const textLen = getContentLength(msg.content);
      if (textLen > 0) {
        segmentEstimates.set("userMsgs", segmentEstimates.get("userMsgs")! + estimateTokens(" ".repeat(textLen)));
      }
      continue;
    }

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "thinking") {
          const len = typeof block.thinking === "string" ? block.thinking.length : 0;
          segmentEstimates.set("thinking", segmentEstimates.get("thinking")! + estimateTokens(" ".repeat(len)));
        } else if (block.type === "toolCall") {
          const len = JSON.stringify(block.arguments || {}).length;
          segmentEstimates.set("toolCallArgs", segmentEstimates.get("toolCallArgs")! + estimateTokens(" ".repeat(len), true));
        } else if (block.type === "text") {
          const len = typeof block.text === "string" ? block.text.length : 0;
          segmentEstimates.set("asstText", segmentEstimates.get("asstText")! + estimateTokens(" ".repeat(len)));
        }
      }
      continue;
    }

    if (msg.role === "toolResult") {
      const segmentId = classifyToolResult(msg, toolCallLookup);
      const len = getContentLength(msg.content);
      segmentEstimates.set(segmentId, segmentEstimates.get(segmentId)! + estimateTokens(" ".repeat(len), true));
      if (msg.details && typeof msg.details === "object") {
        segmentEstimates.set(segmentId, segmentEstimates.get(segmentId)! + estimateTokens(JSON.stringify(msg.details), true));
      }
      continue;
    }

    if (msg.role === "bashExecution") {
      const len = (msg.output?.length || 0) + (msg.command?.length || 0);
      segmentEstimates.set("bash", segmentEstimates.get("bash")! + estimateTokens(" ".repeat(len), true));
      continue;
    }

    if (msg.role === "custom") {
      const len = typeof msg.content === "string" ? msg.content.length : getContentLength(msg.content);
      segmentEstimates.set("extMsgs", segmentEstimates.get("extMsgs")! + estimateTokens(" ".repeat(len)));
      continue;
    }

    if (msg.role === "branchSummary") {
      const len = msg.summary?.length || 0;
      segmentEstimates.set("branchSummary", segmentEstimates.get("branchSummary")! + estimateTokens(" ".repeat(len)));
      continue;
    }

    if (msg.role === "compactionSummary") {
      segmentEstimates.set("compaction", segmentEstimates.get("compaction")! + estimateTokens(" ".repeat(msg.summary?.length || 0)));
      continue;
    }
  }

  // Calibrate: scale estimates proportionally to match total input (cached + non-cached)
  const totalEstimate = Array.from(segmentEstimates.values()).reduce((a, b) => a + b, 0);

  // Total input includes both non-cached and cache-read tokens.
  // Some providers (e.g. Anthropic) report cacheRead separately from input,
  // so usage.input alone is only the non-cached portion.
  const totalInput = (usage.input + usage.cacheRead) || totalEstimate || 0;
  if (totalInput > 0 && totalEstimate > 0) {
    const scale = totalInput / totalEstimate;
    for (const [id, est] of segmentEstimates) {
      segmentEstimates.set(id, Math.round(est * scale));
    }
  }
  const segmentResult: SegmentTokens[] = [];
  const segmentMap = new Map<string, SegmentTokens>();

  for (const id of SEGMENT_IDS) {
    const tokens = segmentEstimates.get(id as SegmentId) || 0;
    const pct = totalInput > 0 ? (tokens / totalInput) * 100 : 0;
    const def = SEGMENT_MAP.get(id as SegmentId)!;
    const st: SegmentTokens = {
      segmentId: id,
      name: def.name,
      tokens,
      percentage: Math.round(pct * 10) / 10,
    };
    segmentResult.push(st);
    segmentMap.set(id, st);
  }

  const freeTokens = Math.max(0, contextWindow - totalInput);
  const cacheReadPct = totalInput > 0 ? (usage.cacheRead / totalInput) * 100 : 0;

  return {
    segments: segmentResult,
    segmentMap,
    totalInput,
    totalOutput: usage.output,
    cacheReadPct,
    totalCost: usage.cost?.total ?? 0,
    freeTokens,
    contextWindow,
    turnCount: 0,
  };
}