const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const { TermState } = require("../lib/terminal");

describe("TermState.prototype.removeLine", () => {
  let termState;

  beforeEach(() => {
    termState = new TermState();
    termState.lines = [
      { str: "line 0", attr: null },
      { str: "line 1", attr: null },
      { str: "line 2", attr: null },
      { str: "line 3", attr: null },
      { str: "line 4", attr: null }
    ];
  });

  it("removes specified number of lines starting at given index y", () => {
    let emitted = false;
    termState.on("linesRemoving", (y, n) => {
      emitted = true;
      assert.strictEqual(y, 1);
      assert.strictEqual(n, 2);
    });

    const result = termState.removeLine(2, 1);
    assert.strictEqual(result, termState);
    assert.strictEqual(emitted, true);
    assert.strictEqual(termState.lines.length, 3);
    assert.deepStrictEqual(
      termState.lines.map((l) => l.str),
      ["line 0", "line 3", "line 4"]
    );
  });

  it("uses cursor line y = cursor[1] when y is not provided", () => {
    termState.setCursor(0, 2);

    let emitted = false;
    termState.on("linesRemoving", (y, n) => {
      emitted = true;
      assert.strictEqual(y, 2);
      assert.strictEqual(n, 1);
    });

    termState.removeLine(1);
    assert.strictEqual(emitted, true);
    assert.strictEqual(termState.lines.length, 4);
    assert.deepStrictEqual(
      termState.lines.map((l) => l.str),
      ["line 0", "line 1", "line 3", "line 4"]
    );
  });

  it("clamps n when y + n exceeds lines.length", () => {
    let emittedArgs = null;
    termState.on("linesRemoving", (y, n) => {
      emittedArgs = { y, n };
    });

    // Requesting to remove 10 lines starting at index 3 (only 2 lines remaining)
    termState.removeLine(10, 3);
    assert.deepStrictEqual(emittedArgs, { y: 3, n: 2 });
    assert.strictEqual(termState.lines.length, 3);
    assert.deepStrictEqual(
      termState.lines.map((l) => l.str),
      ["line 0", "line 1", "line 2"]
    );
  });

  it("returns this without removing or emitting if n <= 0", () => {
    let emitted = false;
    termState.on("linesRemoving", () => {
      emitted = true;
    });

    const res0 = termState.removeLine(0, 1);
    const resNeg = termState.removeLine(-2, 1);

    assert.strictEqual(res0, termState);
    assert.strictEqual(resNeg, termState);
    assert.strictEqual(emitted, false);
    assert.strictEqual(termState.lines.length, 5);
  });

  it("returns this without removing or emitting if starting index y is >= lines.length", () => {
    let emitted = false;
    termState.on("linesRemoving", () => {
      emitted = true;
    });

    const result = termState.removeLine(2, 5);
    assert.strictEqual(result, termState);
    assert.strictEqual(emitted, false);
    assert.strictEqual(termState.lines.length, 5);
  });

  it("returns this without removing or emitting if clamped n becomes <= 0", () => {
    let emitted = false;
    termState.on("linesRemoving", () => {
      emitted = true;
    });

    // lines length is 5, starting at index 5 -> y + n > length -> n = 5 - 5 = 0 -> returns early
    const result = termState.removeLine(1, 5);
    assert.strictEqual(result, termState);
    assert.strictEqual(emitted, false);
    assert.strictEqual(termState.lines.length, 5);
  });
});
