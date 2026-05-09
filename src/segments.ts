/**
 * PiStats segment definitions.
 * Each segment has a fixed ANSI 256-color code, a name, and a description.
 * Used for both bar rendering and /pistats legend output.
 */

export interface SegmentDef {
  id: string;
  name: string;
  ansi: number;
  /** Hex reference for documentation, not used in rendering */
  hex: string;
  description: string;
}

export const SEGMENTS: readonly SegmentDef[] = [
  { id: "system",       name: "System",        ansi: 33,  hex: "#0087ff", description: "System prompt overhead" },
  { id: "agentsMd",     name: "AGENTS.md",     ansi: 28,  hex: "#008700", description: "AGENTS.md context files" },
  { id: "skills",       name: "Skills",        ansi: 34,  hex: "#0087af", description: "SKILL.md and skill directory reads" },
  { id: "fileReads",    name: "File Reads",    ansi: 70,  hex: "#5f8700", description: "Read tool on source/code files" },
  { id: "bash",         name: "Bash Output",   ansi: 136, hex: "#af8700", description: "BashExecutionMessage + bash tool results" },
  { id: "edits",        name: "Edits",         ansi: 166, hex: "#d75f00", description: "edit/write tool results" },
  { id: "browser",      name: "Browser",       ansi: 170, hex: "#d75faf", description: "browser_* tool results" },
  { id: "memory",       name: "Memory",        ansi: 73,  hex: "#5fafaf", description: "memory_* tool results" },
  { id: "webSearch",    name: "WEB_Search",    ansi: 111, hex: "#8fafaf", description: "WEB_Search/WEB_Research results" },
  { id: "design",       name: "Design",        ansi: 139, hex: "#af5faf", description: "apply/lint/export/diff_design results" },
  { id: "otherTools",   name: "Other Tools",   ansi: 245, hex: "#8a8a8a", description: "Unclassified tool results" },
  { id: "thinking",     name: "Thinking",      ansi: 127, hex: "#af005f", description: "ThinkingContent blocks" },
  { id: "toolCallArgs", name: "Tool Call Args", ansi: 130, hex: "#af5f00", description: "ToolCall blocks (arguments model sends)" },
  { id: "userMsgs",     name: "User Messages",  ansi: 153, hex: "#afd7ff", description: "UserMessage entries" },
  { id: "asstText",     name: "Asst Text",     ansi: 183, hex: "#d7d7ff", description: "TextContent blocks in assistant messages" },
  { id: "images",       name: "Images",        ansi: 204, hex: "#ff5f5f", description: "Image attachments in user messages" },
  { id: "compaction",   name: "Compaction",    ansi: 179, hex: "#d7afd7", description: "Compaction entries (summarized context)" },
  { id: "branchSummary",name: "Branch Summary", ansi: 188, hex: "#d7afaf", description: "BranchSummaryMessage entries" },
  { id: "extMsgs",      name: "Extension Msgs", ansi: 216, hex: "#ffd7af", description: "CustomMessage entries" },
] as const;

export const SEGMENT_FREE: SegmentDef = {
  id: "free", name: "Free", ansi: 235, hex: "#585858", description: "Remaining context window",
};

export const SEGMENT_COLLAPSED: SegmentDef = {
  id: "collapsed", name: "Collapsed", ansi: 242, hex: "#6c6c6c", description: "Display-only bucket for segments too small to show",
};

/** Map from segment id to SegmentDef for O(1) lookup */
export const SEGMENT_MAP = new Map(SEGMENTS.map(s => [s.id, s]));

/** All segment ids in order */
export const SEGMENT_IDS: string[] = SEGMENTS.map(s => s.id);

/** Union type of all attribution segment ids */
export type SegmentId = typeof SEGMENTS[number]["id"];

/** Token estimate for images (fixed, based on typical screenshot resolution) */
export const IMAGE_TOKEN_ESTIMATE = 1500;

/** Char-to-token ratio for English text */
export const CHAR_RATIO_EN = 4;

/** Char-to-token ratio for code-heavy content */
export const CHAR_RATIO_CODE = 3;