const test = require("node:test");
const assert = require("node:assert/strict");
const { TermState } = require("../lib/terminal");

test("TermState.setCursor - valid coordinates", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(10, 5);
  assert.deepEqual(state.cursor, [10, 5]);
});

test("TermState.setCursor - partial update x only", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(10, 5);
  state.setCursor(15, undefined);
  assert.deepEqual(state.cursor, [15, 5]);
});

test("TermState.setCursor - partial update y only", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(10, 5);
  state.setCursor(undefined, 8);
  assert.deepEqual(state.cursor, [10, 8]);
});

test("TermState.setCursor - negative out-of-bounds coordinates clamped to 0", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(-5, -10);
  assert.deepEqual(state.cursor, [0, 0]);
});

test("TermState.setCursor - upper out-of-bounds coordinates clamped to max bounds", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(100, 50);
  assert.deepEqual(state.cursor, [79, 23]);
});

test("TermState.setCursor - exact edge coordinates (columns - 1, rows - 1)", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  state.setCursor(79, 23);
  assert.deepEqual(state.cursor, [79, 23]);
});

test("TermState.setCursor - emits cursor event", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  let emitted = false;
  state.on("cursor", () => {
    emitted = true;
  });
  state.setCursor(5, 5);
  assert.equal(emitted, true);
});

test("TermState.setCursor - returns state instance for method chaining", () => {
  const state = new TermState({ columns: 80, rows: 24 });
  const result = state.setCursor(5, 5);
  assert.equal(result, state);
});
