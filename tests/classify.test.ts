import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildToolCallLookup, classifyEntry } from "../src/classify.js";

describe("buildToolCallLookup", () => {
  it("extracts toolCall id → arguments from assistant messages", () => {
    const entries = [
      { type: "message", id: "a1", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "assistant", content: [
        { type: "toolCall", id: "tc1", name: "read", arguments: { path: "/path/to/AGENTS.md" } },
        { type: "toolCall", id: "tc2", name: "bash", arguments: { command: "ls" } },
      ]}},
    ];
    const lookup = buildToolCallLookup(entries);
    assert.equal(lookup.get("tc1")!.path, "/path/to/AGENTS.md");
    assert.equal(lookup.get("tc2")!.command, "ls");
  });

  it("returns empty map for entries without toolCalls", () => {
    const entries = [
      { type: "message", id: "a1", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "user", content: "hello" } },
    ];
    const lookup = buildToolCallLookup(entries);
    assert.equal(lookup.size, 0);
  });
});

describe("classifyEntry", () => {
  const toolCallLookup = new Map([
    ["tc1", { path: "/home/user/.pi/agent/AGENTS.md" }],
    ["tc2", { path: "/home/user/.pi/agent/skills/brainstorming/SKILL.md" }],
    ["tc3", { path: "/home/user/project/src/main.ts" }],
  ]);

  it("classifies user messages", () => {
    const entry = { type: "message", id: "e1", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "user", content: [{ type: "text", text: "hello" }] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "userMsgs");
  });

  it("classifies user messages with images", () => {
    const entry = { type: "message", id: "e2", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "user", content: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "images");
  });

  it("classifies assistant thinking", () => {
    const entry = { type: "message", id: "e3", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "assistant", content: [{ type: "thinking", thinking: "hmm..." }] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "thinking");
  });

  it("classifies assistant text", () => {
    const entry = { type: "message", id: "e4", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "assistant", content: [{ type: "text", text: "response" }] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "asstText");
  });

  it("classifies read tool on AGENTS.md", () => {
    const entry = { type: "message", id: "e5", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "tc1", toolName: "read", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "agentsMd");
  });

  it("classifies read tool on SKILL.md", () => {
    const entry = { type: "message", id: "e6", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "tc2", toolName: "read", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "skills");
  });

  it("classifies read tool on source file", () => {
    const entry = { type: "message", id: "e7", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "tc3", toolName: "read", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "fileReads");
  });

  it("classifies bash tool", () => {
    const entry = { type: "message", id: "e8", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc1", toolName: "bash", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "bash");
  });

  it("classifies edit tool", () => {
    const entry = { type: "message", id: "e9", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc2", toolName: "edit", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "edits");
  });

  it("classifies browser tool", () => {
    const entry = { type: "message", id: "e10", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc3", toolName: "browser_fetch", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "browser");
  });

  it("classifies memory tool", () => {
    const entry = { type: "message", id: "e11", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc4", toolName: "memory_search", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "memory");
  });

  it("classifies WEB_Search", () => {
    const entry = { type: "message", id: "e12", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc5", toolName: "WEB_Search", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "webSearch");
  });

  it("classifies design tools", () => {
    const entry = { type: "message", id: "e13", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc6", toolName: "apply_design", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "design");
  });

  it("classifies unknown tool as otherTools", () => {
    const entry = { type: "message", id: "e14", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "toolResult", toolCallId: "bc7", toolName: "some_custom_tool", content: [] } };
    assert.equal(classifyEntry(entry, toolCallLookup), "otherTools");
  });

  it("classifies bashExecution role", () => {
    const entry = { type: "message", id: "e15", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "bashExecution", command: "ls", output: "files...", exitCode: 0, cancelled: false, truncated: false } };
    assert.equal(classifyEntry(entry, toolCallLookup), "bash");
  });

  it("classifies custom role", () => {
    const entry = { type: "message", id: "e16", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "custom", customType: "memory-layer", content: "injected context", display: false } };
    assert.equal(classifyEntry(entry, toolCallLookup), "extMsgs");
  });

  it("classifies branchSummary role", () => {
    const entry = { type: "message", id: "e17", parentId: null, timestamp: "2024-01-01T00:00:00Z", message: { role: "branchSummary", summary: "previous context...", fromId: "prev1" } };
    assert.equal(classifyEntry(entry, toolCallLookup), "branchSummary");
  });

  it("classifies compaction entry", () => {
    const entry = { type: "compaction", id: "c1", parentId: "e10", timestamp: "2024-01-01T00:00:00Z", summary: "compacted...", firstKeptEntryId: "e5", tokensBefore: 50000 };
    assert.equal(classifyEntry(entry, toolCallLookup), "compaction");
  });
});