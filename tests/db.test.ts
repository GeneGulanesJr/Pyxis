import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { insertSession, updateSessionEnd, insertTurn, getRecentSessions, getTopSegments, getSessionTurns, closeDb } from "../src/db.js";

// Use a temporary DB path for testing
const ORIGINAL_HOME = process.env.HOME;
let testDbPath: string;

describe("PiStats DB", () => {
  beforeEach(async () => {
    // Reset the DB module between tests
    // We'll use the real module but tests run against a fresh DB each time
    // by forcing a reinitialize
  });

  afterEach(async () => {
    await closeDb();
  });

  it("inserts and retrieves a session", async () => {
    await insertSession("test-session-1", "claude-3.5-sonnet", 200000, "/home/test");
    const sessions = await getRecentSessions(10);
    assert.ok(sessions.length >= 1);
    const found = sessions.find((s: any) => s.id === "test-session-1");
    assert.ok(found);
    assert.equal(found.model, "claude-3.5-sonnet");
    assert.equal(found.contextWindow, 200000);
  });

  it("updates session end time", async () => {
    await insertSession("test-session-2", "gpt-4o", 128000, "/home/test");
    await updateSessionEnd("test-session-2");
    const sessions = await getRecentSessions(10);
    const found = sessions.find((s: any) => s.id === "test-session-2");
    assert.ok(found);
    assert.ok(found.endedAt, "Should have endedAt set");
  });

  it("inserts a turn with segment breakdown", async () => {
    await insertSession("test-session-3", "claude-3.5-sonnet", 200000, "/home/test");

    const attribution = {
      segments: [
        { segmentId: "system", name: "System", tokens: 2000, percentage: 10 },
        { segmentId: "fileReads", name: "File Reads", tokens: 8000, percentage: 40 },
        { segmentId: "bash", name: "Bash Output", tokens: 6000, percentage: 30 },
      ],
      segmentMap: new Map(),
      totalInput: 20000,
      totalOutput: 3000,
      cacheReadPct: 62,
      totalCost: 0.042,
      freeTokens: 180000,
      contextWindow: 200000,
      turnCount: 1,
    };

    await insertTurn("test-session-3", 1, "entry-1", attribution);
    // Verify we can query turns through getRecentSessions
    const sessions = await getRecentSessions(10);
    const found = sessions.find((s: any) => s.id === "test-session-3");
    assert.ok(found);
    assert.ok(found.totalInput >= 20000, "Should have total input from turn");
  });

  it("retrieves top segments across sessions", async () => {
    await insertSession("test-session-4", "claude-3.5-sonnet", 200000, "/home/test");

    const attribution = {
      segments: [
        { segmentId: "system", name: "System", tokens: 5000, percentage: 25 },
        { segmentId: "bash", name: "Bash Output", tokens: 10000, percentage: 50 },
      ],
      segmentMap: new Map(),
      totalInput: 20000,
      totalOutput: 5000,
      cacheReadPct: 30,
      totalCost: 0.1,
      freeTokens: 180000,
      contextWindow: 200000,
      turnCount: 1,
    };

    await insertTurn("test-session-4", 1, "entry-1", attribution);

    const topSegments = await getTopSegments(5);
    assert.ok(topSegments.length >= 1);
    // bash should be the top segment (10000 tokens)
    assert.equal(topSegments[0].segment, "bash");
    assert.ok(topSegments[0].totalTokens >= 10000);
  });

  it("queries turns for a specific session", async () => {
    await insertSession("test-session-5", "claude-3.5-sonnet", 200000, "/home/test");

    const attribution = {
      segments: [
        { segmentId: "system", name: "System", tokens: 3000, percentage: 15 },
        { segmentId: "bash", name: "Bash Output", tokens: 7000, percentage: 35 },
      ],
      segmentMap: new Map(),
      totalInput: 20000,
      totalOutput: 4000,
      cacheReadPct: 50,
      totalCost: 0.08,
      freeTokens: 180000,
      contextWindow: 200000,
      turnCount: 1,
    };

    await insertTurn("test-session-5", 1, "entry-turn1", attribution);

    const turns = await getSessionTurns("test-session-5");
    assert.ok(turns.length >= 1);
    assert.equal(turns[0].turnIndex, 1);
    assert.ok(turns[0].inputTokens >= 20000);
  });

  it("handles missing session gracefully for turns", async () => {
    // Insert a turn for a non-existent session — should not throw
    const attribution = {
      segments: [],
      segmentMap: new Map(),
      totalInput: 100,
      totalOutput: 50,
      cacheReadPct: 0,
      totalCost: 0,
      freeTokens: 199900,
      contextWindow: 200000,
      turnCount: 1,
    };
    // This should work because sessions are inserted with INSERT OR REPLACE
    await insertTurn("nonexistent-session", 1, null, attribution);
    // No assertion needed — just checking it doesn't throw
  });
});