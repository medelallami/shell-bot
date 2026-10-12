const assert = require("assert");
const { TermState } = require("../lib/terminal.js");

function testEraseInDisplay0AndAfter() {
  [0, "after", undefined, null].forEach((mode) => {
    const term = new TermState({ rows: 10, columns: 20 });
    term.lines = [
      { str: "Line 0", attr: null },
      { str: "Line 1", attr: null },
      { str: "Line 2", attr: null },
      { str: "Line 3", attr: null },
      { str: "Line 4", attr: null }
    ];
    term.setCursor(2, 2);

    let removedY = null, removedN = null;
    term.on("linesRemoving", (y, n) => {
      removedY = y;
      removedN = n;
    });

    term.eraseInDisplay(mode);

    assert.strictEqual(term.lines.length, 3, `Mode ${mode}: length should be 3`);
    assert.strictEqual(term.lines[0].str, "Line 0", `Mode ${mode}: Line 0 intact`);
    assert.strictEqual(term.lines[1].str, "Line 1", `Mode ${mode}: Line 1 intact`);
    assert.strictEqual(term.lines[2].str, "Li", `Mode ${mode}: Line 2 erased after cursor x=2`);
    assert.strictEqual(removedY, 3, `Mode ${mode}: removed starting at index 3`);
    assert.strictEqual(removedN, 2, `Mode ${mode}: removed 2 lines`);
  });
  console.log("✓ eraseInDisplay (0/after/default) tests passed");
}

function testEraseInDisplay1AndBefore() {
  [1, "before"].forEach((mode) => {
    const term = new TermState({ rows: 10, columns: 20 });
    term.lines = [
      { str: "Line 0", attr: null },
      { str: "Line 1", attr: null },
      { str: "Line 2", attr: null },
      { str: "Line 3", attr: null },
      { str: "Line 4", attr: null }
    ];
    term.setCursor(2, 2);

    const changedLines = [];
    term.on("lineChanged", (y) => {
      changedLines.push(y);
    });

    term.eraseInDisplay(mode);

    assert.strictEqual(term.lines.length, 5, `Mode ${mode}: length should remain 5`);
    assert.strictEqual(term.lines[0].str, "", `Mode ${mode}: Line 0 cleared`);
    assert.strictEqual(term.lines[1].str, "", `Mode ${mode}: Line 1 cleared`);
    assert.strictEqual(term.lines[2].str, "  ne 2", `Mode ${mode}: Line 2 erased before x=2`);
    assert.strictEqual(term.lines[3].str, "Line 3", `Mode ${mode}: Line 3 intact`);
    assert.strictEqual(term.lines[4].str, "Line 4", `Mode ${mode}: Line 4 intact`);
    assert.deepStrictEqual(changedLines, [0, 1, 2], `Mode ${mode}: lineChanged emitted for 0, 1, 2`);
  });
  console.log("✓ eraseInDisplay (1/before) tests passed");
}

function testEraseInDisplay2AndAll() {
  ["all", 2].forEach((mode) => {
    const term = new TermState({ rows: 10, columns: 20 });
    term.lines = [
      { str: "Line 0", attr: null },
      { str: "Line 1", attr: null },
      { str: "Line 2", attr: null }
    ];
    term.setCursor(1, 1);

    let removedY = null, removedN = null;
    term.on("linesRemoving", (y, n) => {
      removedY = y;
      removedN = n;
    });

    term.eraseInDisplay(mode);

    assert.strictEqual(term.lines.length, 0, `Mode ${mode}: all lines removed`);
    assert.strictEqual(removedY, 0, `Mode ${mode}: removed starting at 0`);
    assert.strictEqual(removedN, 3, `Mode ${mode}: removed 3 lines`);
  });
  console.log("✓ eraseInDisplay (all/2) tests passed");
}

function runAll() {
  testEraseInDisplay0AndAfter();
  testEraseInDisplay1AndBefore();
  testEraseInDisplay2AndAll();
  console.log("\nAll terminal tests passed successfully!");
}

runAll();
