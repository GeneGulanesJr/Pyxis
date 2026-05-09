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

/** ANSI 256-color foreground code */
function ansi256(code: number, text: string): string {
  return `\x1b[38;5;${code}m${text}\x1b[0m`;
}

/** ANSI dim text */
function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

/** ANSI bold bright white text */
function bold(text: string): string {
  return `\x1b[1m\x1b[37m${text}\x1b[0m`;
}

/** Overlay centered text on a bar string */
function overlayText(bar: string, text: string, width: number): string {
  const textLen = text.length;
  if (textLen >= width - 4) return bar; // Not enough room
  const start = Math.floor((width - textLen) / 2);
  // Strip ANSI codes to get visible chars, then rebuild
  const visible = bar.replace(/\x1b\[[0-9;]*m/g, "");
  // Build: bar left | centered text | bar right
  // We need to split the visible string and re-apply coloring
  const visibleLeft = visible.slice(0, start);
  const visibleRight = visible.slice(start + textLen);
  // Find the ANSI sequences at the split points
  let result = "";
  let vi = 0; // visible index
  let bi = 0; // bar (with ANSI) index
  let inBar = true;
  // Reconstruct left part with its ANSI codes
  let leftBar = "";
  let currentAnsi = "";
  let visibleCounted = 0;
  while (bi < bar.length && visibleCounted < start) {
    if (bar[bi] === "\x1b") {
      // ANSI escape sequence
      const end = bar.indexOf("m", bi) + 1;
      currentAnsi = bar.slice(bi, end);
      leftBar += currentAnsi;
      bi = end;
    } else {
      leftBar += bar[bi];
      visibleCounted++;
      bi++;
    }
  }
  // Close any open ANSI on left
  leftBar += "\x1b[0m";

  let rightBar = "";
  visibleCounted = 0;
  let targetVisible = start + textLen;
  // Skip characters up to targetVisible
  bi = 0;
  let pendingAnsi = "";
  visibleCounted = 0;
  while (bi < bar.length) {
    if (bar[bi] === "\x1b") {
      const end = bar.indexOf("m", bi) + 1;
      pendingAnsi = bar.slice(bi, end);
      bi = end;
    } else {
      if (visibleCounted >= targetVisible) break;
      visibleCounted++;
      bi++;
    }
  }
  // rightBar starts with whatever ANSI was pending, then rest of bar
  rightBar = pendingAnsi + bar.slice(bi);

  return leftBar + bold(text) + rightBar;
}

/** Render the color-coded bar */
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

  // Sort segments by tokens (descending), keep top N-1, collapse rest
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

  const parts: Array<{ id: string; tokens: number; ansi: number }> = [];

  for (const s of top) {
    const def = SEGMENT_MAP.get(s.segmentId as SegmentId);
    if (def) {
      parts.push({ id: s.segmentId, tokens: s.tokens, ansi: def.ansi });
    }
  }

  if (collapsedTokens > 0) {
    parts.push({ id: "collapsed", tokens: collapsedTokens, ansi: SEGMENT_COLLAPSED.ansi });
  }

  if (freeTokens > 0) {
    parts.push({ id: "free", tokens: freeTokens, ansi: SEGMENT_FREE.ansi });
  }

  // Compute character widths
  const barParts: string[] = [];
  let remainingWidth = width;

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const proportion = parts[i].tokens / totalTokens;
    let charWidth: number;

    if (isLast) {
      charWidth = remainingWidth;
    } else {
      charWidth = Math.max(1, Math.round(proportion * width));
    }

    charWidth = Math.min(charWidth, remainingWidth);
    remainingWidth -= charWidth;

    if (charWidth <= 0) continue;

    const fillChar = parts[i].id === "free" ? "░" : "█";
    barParts.push(ansi256(parts[i].ansi, fillChar.repeat(charWidth)));
  }

  const rawBar = barParts.join("");

  // Overlay usage text centered inside the bar if wide enough
  const minOverlayWidth = 30; // Need at least 30 chars to show "Xk/Yk"
  if (totalInput > 0 && contextWindow > 0 && width >= minOverlayWidth) {
    const pct = Math.round((totalInput / contextWindow) * 100);
    const label = `${formatTokens(totalInput)}/${formatTokens(contextWindow)} ${pct}%`;
    if (label.length + 4 <= width) {
      return [overlayText(rawBar, label, width)];
    }
  }

  return [rawBar];
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

  // Calculate visible widths (excluding ANSI codes)
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

  // Render 3 columns per row
  const colWidth = 28;
  const cols = 3;

  let line = "";
  for (const s of allSegments) {
    const def = s.segmentId === "free" ? SEGMENT_FREE : SEGMENT_MAP.get(s.segmentId as SegmentId);
    if (!def) continue;
    const block = ansi256(def.ansi, "█");
    const name = s.name.padEnd(maxNameLen);
    const tokens = formatTokens(s.tokens).padStart(6);
    const pct = `(${s.percentage.toFixed(1)}%)`.padStart(7);
    const entry = `${block} ${name} ${tokens} ${pct}`;

    if (line.length > 0 && line.length + entry.length + 2 > cols * colWidth) {
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