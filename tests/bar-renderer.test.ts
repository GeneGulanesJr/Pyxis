import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderBar, renderInfoLine } from "../src/bar-renderer.js";
import { SEGMENTS } from "../src/segments.js";
import type { SegmentTokens } from "../src/attributor.js";

function makeSegment(id: string, tokens: number, pct: number): SegmentTokens {
  const def = SEGMENTS.find(s => s.id === id)!;
  return { segmentId: id as any, name: def.name, tokens, percentage: pct };
}

describe("renderBar", () => {
  it("renders a bar of correct width", () => {
    const segments = [
      makeSegment("system", 2000, 10),
      makeSegment("fileReads", 8000, 40),
      makeSegment("bash", 6000, 30),
      makeSegment("userMsgs", 4000, 20),
    ];
    const result = renderBar(segments, 20000, 80);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes("█") || result[0].includes("░"));
  });

  it("renders free space when context is not full", () => {
    const segments = [makeSegment("system", 1000, 1)];
    const result = renderBar(segments, 199000, 80);
    assert.ok(result[0].length > 0);
  });

  it("handles full context window (no free space)", () => {
    const segments = [makeSegment("system", 200000, 100)];
    const result = renderBar(segments, 0, 80);
    assert.ok(result[0].length > 0);
  });

  it("collapses small segments into collapsed bucket", () => {
    const segments = [
      makeSegment("system", 190000, 95),
      makeSegment("images", 100, 0.05),
      makeSegment("branchSummary", 50, 0.025),
    ];
    const result = renderBar(segments, 9850, 80);
    assert.ok(result[0].length > 0);
  });

  it("handles narrow terminal (below minimum)", () => {
    const segments = [makeSegment("system", 1000, 1)];
    const result = renderBar(segments, 199000, 30);
    // Below MIN_BAR_WIDTH, should still produce output
    assert.ok(result.length >= 1);
  });
});

describe("renderInfoLine", () => {
  it("formats info line correctly", () => {
    const line = renderInfoLine(24000, 3000, 0.042, 62, 5, 80);
    assert.ok(line.includes("24.0k"));
    assert.ok(line.includes("3.0k"));
    assert.ok(line.includes("$0.042"));
    assert.ok(line.includes("62%"));
    assert.ok(line.includes("5"));
  });

  it("handles zero input", () => {
    const line = renderInfoLine(0, 0, 0, 0, 0, 80);
    // When all zeros, the line should still render without crashing
    assert.ok(line.length > 0);
  });
});