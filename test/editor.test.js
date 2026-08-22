const { describe, it } = require("node:test");
const assert = require("node:assert");
const { ChunkedString } = require("../lib/editor");

describe("ChunkedString constructor", () => {
  it("should correctly set text and initialize empty chunks array", () => {
    const input = "Hello, world!";
    const cs = new ChunkedString(input);

    assert.strictEqual(cs.text, input);
    assert.ok(Array.isArray(cs.chunks));
    assert.strictEqual(cs.chunks.length, 0);
  });

  it("should create separate chunks array instances for different ChunkedString instances", () => {
    const cs1 = new ChunkedString("text 1");
    const cs2 = new ChunkedString("text 2");

    assert.notStrictEqual(cs1.chunks, cs2.chunks);
    cs1.chunks.push({ offset: 0, text: "text" });

    assert.strictEqual(cs1.chunks.length, 1);
    assert.strictEqual(cs2.chunks.length, 0);
  });

  it("should handle empty string input", () => {
    const cs = new ChunkedString("");

    assert.strictEqual(cs.text, "");
    assert.deepStrictEqual(cs.chunks, []);
  });

  it("should handle multiline and special character text", () => {
    const multilineText = "Line 1\nLine 2\r\nLine 3\tTabbed 🚀";
    const cs = new ChunkedString(multilineText);

    assert.strictEqual(cs.text, multilineText);
    assert.deepStrictEqual(cs.chunks, []);
  });

  it("should handle null and undefined input", () => {
    const csNull = new ChunkedString(null);
    assert.strictEqual(csNull.text, null);
    assert.deepStrictEqual(csNull.chunks, []);

    const csUndefined = new ChunkedString(undefined);
    assert.strictEqual(csUndefined.text, undefined);
    assert.deepStrictEqual(csUndefined.chunks, []);
  });

  it("should support basic chunk operations on constructed instance", () => {
    const cs = new ChunkedString("The quick brown fox");
    assert.strictEqual(cs.chunks.length, 0);

    const chunk = cs.findAcquire("quick");
    assert.strictEqual(chunk.text, "quick");
    assert.strictEqual(chunk.offset, 4);
    assert.strictEqual(cs.chunks.length, 1);
    assert.strictEqual(cs.chunks[0], chunk);
  });
});
