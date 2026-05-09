/**
 * PiStats classification logic.
 * Two-pass approach:
 *   Pass 1: Build toolCallId → arguments lookup from assistant messages.
 *   Pass 2: Classify each entry into a segment id.
 */

import type { SegmentId } from "./segments.js";

/** Loose entry type — we only read specific fields from Pi's session entries */
interface AnyEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  message?: {
    role: string;
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
  };
  tokensBefore?: number;
  [key: string]: unknown;
}

/** Build a map from toolCallId to the arguments object for all toolCalls in the branch */
export function buildToolCallLookup(entries: AnyEntry[]): Map<string, Record<string, unknown>> {
  const lookup = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    if (entry.message?.role !== "assistant") continue;
    const content = entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        block.type === "toolCall" &&
        "id" in block &&
        "arguments" in block
      ) {
        lookup.set(String(block.id), block.arguments as Record<string, unknown>);
      }
    }
  }
  return lookup;
}

/** Classify a single entry into a segment id (simple, whole-entry classification) */
export function classifyEntry(entry: AnyEntry, toolCallLookup: Map<string, Record<string, unknown>>): SegmentId {
  if (entry.type === "compaction") {
    return "compaction";
  }

  if (entry.type !== "message" || !entry.message) {
    return "otherTools";
  }

  const msg = entry.message;

  switch (msg.role) {
    case "user": {
      const content = msg.content;
      if (Array.isArray(content) && content.some((b: any) => b?.type === "image")) {
        return "images";
      }
      return "userMsgs";
    }

    case "assistant": {
      const content = msg.content;
      if (!Array.isArray(content) || content.length === 0) {
        return "asstText";
      }
      // Return the primary content block type
      if (content.some((b: any) => b?.type === "thinking")) {
        return "thinking";
      }
      if (content.some((b: any) => b?.type === "toolCall")) {
        return "toolCallArgs";
      }
      return "asstText";
    }

    case "toolResult": {
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

    case "bashExecution":
      return "bash";

    case "custom":
      return "extMsgs";

    case "branchSummary":
      return "branchSummary";

    case "compactionSummary":
      return "compaction";

    default:
      return "otherTools";
  }
}