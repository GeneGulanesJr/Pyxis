import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEGMENTS, SEGMENT_FREE, SEGMENT_COLLAPSED, SEGMENT_MAP, SEGMENT_IDS, IMAGE_TOKEN_ESTIMATE } from "../src/segments.js";

describe("Segments", () => {
  it("has 19 attribution segments", () => {
    assert.equal(SEGMENTS.length, 19);
  });

  it("has unique ids", () => {
    const ids = SEGMENTS.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("has unique ansi codes", () => {
    const codes = SEGMENTS.map(s => s.ansi);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("SEGMENT_MAP has entries for all segment ids", () => {
    for (const s of SEGMENTS) {
      assert.ok(SEGMENT_MAP.has(s.id));
      assert.equal(SEGMENT_MAP.get(s.id)!.name, s.name);
    }
  });

  it("SEGMENT_IDS matches SEGMENTS order", () => {
    assert.deepEqual(SEGMENT_IDS, SEGMENTS.map(s => s.id));
  });

  it("free and collapsed are distinct from attribution segments", () => {
    const attributionIds = new Set(SEGMENTS.map(s => s.id));
    assert.ok(!attributionIds.has(SEGMENT_FREE.id));
    assert.ok(!attributionIds.has(SEGMENT_COLLAPSED.id));
    assert.notEqual(SEGMENT_FREE.ansi, SEGMENT_COLLAPSED.ansi);
  });

  it("image token estimate is reasonable (1000-3000)", () => {
    assert.ok(IMAGE_TOKEN_ESTIMATE >= 1000);
    assert.ok(IMAGE_TOKEN_ESTIMATE <= 3000);
  });
});