import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeAttribution } from "../src/attributor.js";

describe("computeAttribution", () => {
  it("returns zero tokens for empty entries", () => {
    const result = computeAttribution([], "", { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, 200000);
    const totalTokens = result.segments.reduce((sum, s) => sum + s.tokens, 0);
    assert.equal(totalTokens, 0);
    assert.equal(result.freeTokens, 200000);
  });

  it("estimates system prompt tokens", () => {
    const systemPrompt = "You are a helpful assistant. ".repeat(50); // ~1400 chars
    const result = computeAttribution([], systemPrompt, { input: 350, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 350 }, 200000);
    assert.ok(result.segmentMap.get("system")!.tokens > 0);
    assert.equal(result.totalInput, 350);
  });

  it("calibrates segments to sum to usage.input", () => {
    const entries = [
      { type: "message", id: "e1", parentId: null, timestamp: "2024-01-01T00:00:00Z",
        message: { role: "user", content: [{ type: "text", text: "hello world" }] } },
    ];
    const systemPrompt = "system prompt";
    const result = computeAttribution(entries, systemPrompt, { input: 100, output: 50, cacheRead: 20, cacheWrite: 0, totalTokens: 150 }, 200000);
    const totalEstimated = result.segments.reduce((sum, s) => sum + s.tokens, 0);
    assert.equal(totalEstimated, 100);
    assert.equal(result.freeTokens, 199900);
  });

  it("uses tokensBefore for compaction entries", () => {
    const entries = [
      { type: "compaction", id: "c1", parentId: null, timestamp: "2024-01-01T00:00:00Z",
        summary: "compacted", firstKeptEntryId: "e5", tokensBefore: 50000 },
    ];
    const result = computeAttribution(entries, "", { input: 50000, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 50000 }, 200000);
    assert.equal(result.segmentMap.get("compaction")!.tokens, 50000);
  });

  it("estimates 1500 tokens per image", () => {
    const entries = [
      { type: "message", id: "e1", parentId: null, timestamp: "2024-01-01T00:00:00Z",
        message: { role: "user", content: [
          { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
        ]}},
    ];
    const result = computeAttribution(entries, "", { input: 1500, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 1500 }, 200000);
    assert.equal(result.segmentMap.get("images")!.tokens, 1500);
  });

  it("classifies tool results by toolName", () => {
    const entries = [
      // Need assistant first with tool calls for lookup
      { type: "message", id: "a1", parentId: null, timestamp: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: [
          { type: "toolCall", id: "tc1", name: "read", arguments: { path: "/src/main.ts" } },
        ]}},
      { type: "message", id: "e1", parentId: null, timestamp: "2024-01-01T00:00:00Z",
        message: { role: "toolResult", toolCallId: "tc1", toolName: "read", content: [{ type: "text", text: "file content here" }] } },
    ];
    const result = computeAttribution(entries, "", { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150 }, 200000);
    assert.ok(result.segmentMap.get("fileReads")!.tokens > 0);
  });

  it("computes cache read percentage", () => {
    const result = computeAttribution([], "", { input: 1000, output: 0, cacheRead: 620, cacheWrite: 0, totalTokens: 1000 }, 200000);
    assert.ok(result.cacheReadPct >= 61);
    assert.ok(result.cacheReadPct <= 63);
  });
});