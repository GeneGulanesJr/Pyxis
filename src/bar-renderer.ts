/**
 * PiStats bar renderer.
 * Renders the color-coded stats bar and info line for ctx.ui.setFooter().
 */

import { SEGMENTS, SEGMENT_FREE, SEGMENT_COLLAPSED, SEGMENT_MAP } from "./segments.js";
import type { SegmentId } from "./segments.js";
import type { SegmentTokens } from "./attributor.js";
import { formatTokens, formatCost } from "./format.js";

const MIN_BAR_WIDTH = 40;
const MAX_VISIBLE_SEGMENTS = 10;
const NARROW_MAX_SEGMENTS = 7;
const COLLAPSED_MIN_WIDTH = 60;
const MIN_BAR_LABEL_WIDTH = 24;

/** ANSI 256-color foreground code */
function ansi256(code: number, text: string): string {
  return `\x1b[38;5;${code}m${text}\x1b[0m`;
}

/** ANSI dim text */
function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

/** Render the color-coded bar with optional centered label */
export function renderBar(
  segments: SegmentTokens[],
  freeTokens: number,
  width: number,
  totalInput: number = 0,
  contextWindow: number = 0,
): string[] {
  if (width < MIN_BAR_WIDTH) {
    return [ansi256(SEGMENT_FREE.ansi, "░".repeat(width))];
  }

  const maxVisible = width < COLLAPSED_MIN_WIDTH ? NARROW_MAX_SEGMENTS : MAX_VISIBLE_SEGMENTS;

  const sorted = [...segments]
    .filter(s => s.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);

  const topCount = maxVisible - 1;
  const top = sorted.slice(0, topCount);
  const collapsedEntries = sorted.slice(topCount);
  const collapsedTokens = collapsedEntries.reduce((sum, s) => sum + s.tokens, 0);

  const totalTokens = segments.reduce((sum, s) => sum + s.tokens, 0) + freeTokens;
  if (totalTokens === 0) {
    return [ansi256(SEGMENT_FREE.ansi, "░".repeat(width))];
  }

  // Build the visible-bar parts: each has {color, char, count}
  const parts: Array<{ ansi: number; char: string; count: number }> = [];

  for (const s of top) {
    const def = SEGMENT_MAP.get(s.segmentId as SegmentId);
    if (def) {
      parts.push({ ansi: def.ansi, char: "█", count: s.tokens });
    }
  }
  if (collapsedTokens > 0) {
    parts.push({ ansi: SEGMENT_COLLAPSED.ansi, char: "█", count: collapsedTokens });
  }
  if (freeTokens > 0) {
    parts.push({ ansi: SEGMENT_FREE.ansi, char: "░", count: freeTokens });
  }

  // Allocate character positions proportionally
  const total = parts.reduce((sum, p) => sum + p.count, 0);
  const allocated: Array<{ ansi: number; char: string; width: number }> = [];
  let remaining = width;

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    let w: number;
    if (isLast) {
      w = remaining;
    } else {
      w = Math.max(1, Math.round((parts[i].count / total) * width));
      w = Math.min(w, remaining);
    }
    allocated.push({ ansi: parts[i].ansi, char: parts[i].char, width: w });
    remaining -= w;
  }

  // Build a flat array: position → {ansi, char}
  const cells: Array<{ ansi: number; char: string }> = [];
  for (const a of allocated) {
    for (let i = 0; i < a.width; i++) {
      cells.push({ ansi: a.ansi, char: a.char });
    }
  }
  // Ensure cells length matches width (pad or trim)
  while (cells.length < width) cells.push({ ansi: SEGMENT_FREE.ansi, char: "░" });
  if (cells.length > width) cells.length = width;

  // Compute label
  let label = "";
  if (totalInput > 0 && contextWindow > 0 && width >= MIN_BAR_LABEL_WIDTH) {
    const pct = Math.round((totalInput / contextWindow) * 100);
    const candidate = `[${formatTokens(totalInput)}/${formatTokens(contextWindow)} ${pct}%]`;
    if (candidate.length <= width - 4) {
      label = candidate;
    }
  }

  // Stamp label into center of cells
  if (label) {
    const start = Math.floor((width - label.length) / 2);
    for (let i = 0; i < label.length; i++) {
      cells[start + i] = { ansi: -1, char: label[i] }; // -1 = label (bold white)
    }
  }

  // Render cells to ANSI string
  let result = "";
  let currentAnsi = -2; // -2 = no current color
  for (const cell of cells) {
    if (cell.ansi !== currentAnsi) {
      if (currentAnsi === -1) {
        result += "\x1b[0m"; // end bold white
      } else if (currentAnsi >= 0) {
        result += "\x1b[0m"; // end 256-color
      }
      if (cell.ansi === -1) {
        result += "\x1b[1m\x1b[37m"; // bold white
      } else {
        result += `\x1b[38;5;${cell.ansi}m`;
      }
      currentAnsi = cell.ansi;
    }
    result += cell.char;
  }
  if (currentAnsi >= -1) {
    result += "\x1b[0m";
  }

  return [result];
}

/** Render the compact info line */
export function renderInfoLine(
  totalInput: number,
  totalOutput: number,
  totalCost: number,
  cacheReadPct: number,
  turnCount: number,
  width: number,
  contextWindow: number = 0,
  model?: string,
  thinkingLevel?: string,
): string {
  const up = `↑${formatTokens(totalInput)}`;
  const down = `↓${formatTokens(totalOutput)}`;
  const cost = formatCost(totalCost);
  const cache = `cache:${Math.round(cacheReadPct)}%`;
  const turn = `turn ${turnCount}`;

  // Usage ratio in Pi's format: X.X/Yk(auto)
  const usageRatio = contextWindow > 0
    ? `${formatTokens(totalInput)}/${formatTokens(contextWindow)}(auto)`
    : formatTokens(totalInput);

  const left = `${up} ${down} ${cost}`;
  const rightParts = [cache, turn, usageRatio];
  if (thinkingLevel && thinkingLevel !== "off") rightParts.push(`think:${thinkingLevel}`);
  if (model) rightParts.push(model);
  const right = rightParts.join(" · ");

  const leftVisible = left.length;
  const rightVisible = right.length;
  const padLen = Math.max(1, width - leftVisible - rightVisible);

  return `${dim(left)}${" ".repeat(padLen)}${dim(right)}`;
}

/** Render the /pistats command output (legend + numbers) */
export function renderLegend(segments: SegmentTokens[], freeTokens: number, contextWindow: number, totalInput: number): string[] {
  const lines: string[] = [];
  const maxNameLen = Math.max(...SEGMENTS.map(s => s.name.length), SEGMENT_FREE.name.length);
  const allSegments = [...segments];
  if (freeTokens > 0) {
    allSegments.push({ segmentId: "free", name: SEGMENT_FREE.name, tokens: freeTokens, percentage: contextWindow > 0 ? (freeTokens / contextWindow) * 100 : 0 });
  }

  let line = "";
  for (const s of allSegments) {
    const def = s.segmentId === "free" ? SEGMENT_FREE : SEGMENT_MAP.get(s.segmentId as SegmentId);
    if (!def) continue;
    const block = ansi256(def.ansi, "█");
    const name = s.name.padEnd(maxNameLen);
    const tokens = formatTokens(s.tokens).padStart(6);
    const pct = `(${s.percentage.toFixed(1)}%)`.padStart(7);
    const entry = `${block} ${name} ${tokens} ${pct}`;

    if (line.length > 0 && line.length + entry.length + 2 > 80) {
      lines.push(line.trimEnd());
      line = "";
    }
    line += entry + "  ";
  }
  if (line.trim()) lines.push(line.trimEnd());

  lines.push("");
  lines.push(dim(`                                     Total: ${formatTokens(totalInput)}/${formatTokens(contextWindow)}`));

  return lines;
}