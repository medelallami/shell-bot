const test = require("node:test");
const assert = require("node:assert");
const { ChunkedString } = require("../lib/editor");

test("ChunkedString.modify - single chunk replacement with longer text", () => {
  const cs = new ChunkedString("hello world");
  const chunk = cs.acquire(6, 5); // "world"
  cs.modify(chunk, "everyone");

  assert.strictEqual(cs.text, "hello everyone");
  assert.strictEqual(chunk.text, "everyone");
  assert.strictEqual(chunk.offset, 6);
});

test("ChunkedString.modify - single chunk replacement with shorter text", () => {
  const cs = new ChunkedString("hello world");
  const chunk = cs.acquire(6, 5); // "world"
  cs.modify(chunk, "you");

  assert.strictEqual(cs.text, "hello you");
  assert.strictEqual(chunk.text, "you");
  assert.strictEqual(chunk.offset, 6);
});

test("ChunkedString.modify - single chunk replacement with same length text", () => {
  const cs = new ChunkedString("hello world");
  const chunk = cs.acquire(6, 5); // "world"
  cs.modify(chunk, "there");

  assert.strictEqual(cs.text, "hello there");
  assert.strictEqual(chunk.text, "there");
  assert.strictEqual(chunk.offset, 6);
});

test("ChunkedString.modify - multiple chunks offset updates (longer and shorter text)", () => {
  const cs = new ChunkedString("aaa bbb ccc ddd");
  const c1 = cs.findAcquire("aaa"); // offset 0, len 3
  const c2 = cs.findAcquire("bbb"); // offset 4, len 3
  const c3 = cs.findAcquire("ccc"); // offset 8, len 3
  const c4 = cs.findAcquire("ddd"); // offset 12, len 3

  // Expand c2 ("bbb" -> "BBBBBB", diff = +3)
  cs.modify(c2, "BBBBBB");

  assert.strictEqual(cs.text, "aaa BBBBBB ccc ddd");
  assert.strictEqual(c1.offset, 0);
  assert.strictEqual(c1.text, "aaa");
  assert.strictEqual(c2.offset, 4);
  assert.strictEqual(c2.text, "BBBBBB");
  assert.strictEqual(c3.offset, 11);
  assert.strictEqual(c3.text, "ccc");
  assert.strictEqual(c4.offset, 15);
  assert.strictEqual(c4.text, "ddd");

  // Verify slice matches updated offsets
  assert.strictEqual(cs.text.substring(c3.offset, c3.offset + c3.text.length), "ccc");
  assert.strictEqual(cs.text.substring(c4.offset, c4.offset + c4.text.length), "ddd");

  // Shrink c3 ("ccc" -> "X", diff = -2)
  cs.modify(c3, "X");

  assert.strictEqual(cs.text, "aaa BBBBBB X ddd");
  assert.strictEqual(c1.offset, 0);
  assert.strictEqual(c2.offset, 4);
  assert.strictEqual(c3.offset, 11);
  assert.strictEqual(c3.text, "X");
  assert.strictEqual(c4.offset, 13);
  assert.strictEqual(c4.text, "ddd");
  assert.strictEqual(cs.text.substring(c4.offset, c4.offset + c4.text.length), "ddd");
});

test("ChunkedString.modify - modification at start of string", () => {
  const cs = new ChunkedString("foo bar baz");
  const chunk = cs.findAcquire("foo");
  cs.modify(chunk, "superlongfoo");

  assert.strictEqual(cs.text, "superlongfoo bar baz");
  assert.strictEqual(chunk.offset, 0);
  assert.strictEqual(chunk.text, "superlongfoo");
});

test("ChunkedString.modify - modification at end of string", () => {
  const cs = new ChunkedString("foo bar baz");
  const chunk = cs.findAcquire("baz");
  cs.modify(chunk, "qux");

  assert.strictEqual(cs.text, "foo bar qux");
  assert.strictEqual(chunk.offset, 8);
  assert.strictEqual(chunk.text, "qux");
});

test("ChunkedString.modify - throws error on invalid or unacquired chunk", () => {
  const cs = new ChunkedString("foo bar baz");
  const dummyChunk = { offset: 0, text: "foo" };

  assert.throws(
    () => cs.modify(dummyChunk, "test"),
    { message: "Invalid chunk given" }
  );
});

test("ChunkedString.modify - throws error on released chunk", () => {
  const cs = new ChunkedString("foo bar baz");
  const chunk = cs.findAcquire("bar");
  cs.release(chunk);

  assert.throws(
    () => cs.modify(chunk, "test"),
    { message: "Invalid chunk given" }
  );
});

test("ChunkedString.modify - throws error on empty replacement text", () => {
  const cs = new ChunkedString("foo bar baz");
  const chunk = cs.findAcquire("bar");

  assert.throws(
    () => cs.modify(chunk, ""),
    { message: "Empty replacement not allowed" }
  );
});

test("ChunkedString.modify - multiple sequential modifications on same and different chunks", () => {
  const cs = new ChunkedString("first second third");
  const c1 = cs.findAcquire("first");
  const c2 = cs.findAcquire("second");
  const c3 = cs.findAcquire("third");

  cs.modify(c1, "1st"); // diff -2 => text "1st second third"
  assert.strictEqual(cs.text, "1st second third");
  assert.strictEqual(c2.offset, 4);
  assert.strictEqual(c3.offset, 11);

  cs.modify(c2, "2nd"); // diff -3 => text "1st 2nd third"
  assert.strictEqual(cs.text, "1st 2nd third");
  assert.strictEqual(c3.offset, 8);

  cs.modify(c1, "FIRST"); // diff +2 => text "FIRST 2nd third"
  assert.strictEqual(cs.text, "FIRST 2nd third");
  assert.strictEqual(c2.offset, 6);
  assert.strictEqual(c3.offset, 10);
});
