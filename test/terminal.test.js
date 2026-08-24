const { describe, it } = require("node:test");
const assert = require("node:assert");
const { TermState } = require("../lib/terminal");

describe("TermState.setCursor", () => {
  it("should set cursor to valid coordinates within terminal bounds", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    state.setCursor(10, 5);
    assert.deepStrictEqual(state.cursor, [10, 5]);
  });

  it("should clamp negative x and y coordinates to 0", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    state.setCursor(-5, -10);
    assert.deepStrictEqual(state.cursor, [0, 0]);

    state.setCursor(-1, 15);
    assert.deepStrictEqual(state.cursor, [0, 15]);

    state.setCursor(20, -1);
    assert.deepStrictEqual(state.cursor, [20, 0]);
  });

  it("should clamp out-of-bounds x and y coordinates to max dimensions minus one", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    state.setCursor(100, 50);
    assert.deepStrictEqual(state.cursor, [79, 23]);

    state.setCursor(80, 24);
    assert.deepStrictEqual(state.cursor, [79, 23]);

    state.setCursor(150, 10);
    assert.deepStrictEqual(state.cursor, [79, 10]);

    state.setCursor(10, 100);
    assert.deepStrictEqual(state.cursor, [10, 23]);
  });

  it("should support partial updates when passing only x or y", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    state.setCursor(15, 8);
    assert.deepStrictEqual(state.cursor, [15, 8]);

    state.setCursor(30, undefined);
    assert.deepStrictEqual(state.cursor, [30, 8]);

    state.setCursor(undefined, 12);
    assert.deepStrictEqual(state.cursor, [30, 12]);
  });

  it("should emit 'cursor' event when setCursor is called", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    let emitted = false;
    state.on("cursor", () => {
      emitted = true;
    });

    state.setCursor(5, 5);
    assert.strictEqual(emitted, true);
  });

  it("should return the TermState instance for method chaining", () => {
    const state = new TermState({ columns: 80, rows: 24 });
    const result = state.setCursor(5, 5);
    assert.strictEqual(result, state);
  });
});
