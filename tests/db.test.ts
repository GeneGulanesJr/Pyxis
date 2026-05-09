import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { insertSession, updateSessionEnd, insertTurn, getRecentSessions, getTopSegments, getSessionTurns, closeDb } from "../src/db.js";

describe("PiStats DB", () => {
  afterEach(async () => {
    await closeDb();
  });

  it("inserts and retrieves a session", async () => {
    await insertSession("db-test-1", "claude-3.5-sonnet", 200000, "/home/test");
    const sessions = await getRecentSessions(10);
    const found = sessions.find((s: any) => s.id === "db-test-1");
    assert.ok(found);
    assert.equal(found.model, "claude-3.5-sonnet");
    assert.equal(found.contextWindow, 200000);
  });

  it("updates session end time", async () => {
    await insertSession("db-test-2", "gpt-4o", 128000, "/home/test");
    await updateSessionEnd("db-test-2");
    const sessions = await getRecentSessions(10);
    const found = sessions.find((s: any) => s.id === "db-test-2");
    assert.ok(found);
    assert.ok(found.endedAt, "Should have endedAt set");
  });

  it("inserts a turn with segment breakdown", async () => {
    await insertSession("db-test-3", "claude-3.5-sonnet", 200000, "/home/test");

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

    await insertTurn("db-test-3", 1, "entry-1", attribution);
    const sessions = await getRecentSessions(10);
    const found = sessions.find((s: any) => s.id === "db-test-3");
    assert.ok(found);
    assert.ok(found.totalInput >= 20000, "Should have total input from turn");
  });

  it("retrieves top segments across sessions", async () => {
    await insertSession("db-test-4", "claude-3.5-sonnet", 200000, "/home/test");

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

    await insertTurn("db-test-4", 1, "entry-1", attribution);

    const topSegments = await getTopSegments(10);
    assert.ok(topSegments.length >= 1, "Should have at least one segment");
    // Find bash in the results — it should have at least 10000 tokens
    const bashSegment = topSegments.find((s: any) => s.segment === "bash");
    assert.ok(bashSegment, "Should find bash segment");
    assert.ok(bashSegment.totalTokens >= 10000, "Bash should have at least 10000 tokens");
  });

  it("queries turns for a specific session", async () => {
    await insertSession("db-test-5", "claude-3.5-sonnet", 200000, "/home/test");

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

    await insertTurn("db-test-5", 1, "entry-turn1", attribution);

    const turns = await getSessionTurns("db-test-5");
    assert.ok(turns.length >= 1);
    assert.equal(turns[0].turnIndex, 1);
    assert.ok(turns[0].inputTokens >= 20000);
  });

  it("handles missing session gracefully for turns", async () => {
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
    // Should not throw
    await insertTurn("db-test-nonexistent", 1, null, attribution);
  });
});