const test = require("node:test");
const assert = require("node:assert");
const EventEmitter = require("events");
const { TermState } = require("../lib/terminal");

test("TermState constructor default initialization", () => {
  const term = new TermState();

  assert.ok(term instanceof EventEmitter);
  assert.strictEqual(term.columns, 80);
  assert.strictEqual(term.rows, 24);
  assert.deepStrictEqual(term.lines, []);
  assert.deepStrictEqual(term.cursor, [0, 0]);
  assert.deepStrictEqual(term.savedCursor, [0, 0]);
  assert.deepStrictEqual(term.modes, {
    graphic: false,
    insert: false,
    cursor: true,
    cursorBlink: true,
    appKeypad: false,
  });
  assert.deepStrictEqual(term.metas, { title: "" });
  assert.deepStrictEqual(term._tabs, []);
  assert.deepStrictEqual(term._charsets, []);
  assert.strictEqual(term._mappedCharset, 0);
  assert.strictEqual(term._mappedCharsetNext, 0);
});

test("TermState constructor with empty options object", () => {
  const term = new TermState({});

  assert.strictEqual(term.columns, 80);
  assert.strictEqual(term.rows, 24);
});

test("TermState constructor with custom options", () => {
  const term = new TermState({ columns: 120, rows: 40 });

  assert.strictEqual(term.columns, 120);
  assert.strictEqual(term.rows, 40);
  assert.deepStrictEqual(term.lines, []);
  assert.deepStrictEqual(term.cursor, [0, 0]);
});

test("TermState constructor with partial options", () => {
  const termOnlyCols = new TermState({ columns: 100 });
  assert.strictEqual(termOnlyCols.columns, 100);
  assert.strictEqual(termOnlyCols.rows, 24);

  const termOnlyRows = new TermState({ rows: 50 });
  assert.strictEqual(termOnlyRows.columns, 80);
  assert.strictEqual(termOnlyRows.rows, 50);
});
