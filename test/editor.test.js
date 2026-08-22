const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ChunkedString, Editor } = require("../lib/editor");

function createMockReply(msgId = 100) {
  const htmlReplies = [];
  const editedTexts = [];
  const reply = {
    parameters: {},
    htmlReplies,
    editedTexts,
    text: (text, mode) => {
      return {
        then: (cb) => {
          cb(null, { id: msgId });
          return Promise.resolve();
        }
      };
    },
    editText: (id, text, mode) => {
      editedTexts.push({ id, text, mode });
      return {
        then: (cb) => {
          if (cb) cb(null, { id });
          return Promise.resolve();
        }
      };
    },
    html: (fmt, ...args) => {
      htmlReplies.push({ fmt, args });
    }
  };
  return reply;
}

const flushTicks = () => new Promise((resolve) => process.nextTick(resolve));
const sleep = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ChunkedString", () => {
  test("initialization", () => {
    const cs = new ChunkedString("hello world");
    assert.strictEqual(cs.text, "hello world");
    assert.deepStrictEqual(cs.chunks, []);
  });

  describe("findAcquire", () => {
    test("acquires unique substring successfully", () => {
      const cs = new ChunkedString("hello world");
      const chunk = cs.findAcquire("world");
      assert.strictEqual(chunk.offset, 6);
      assert.strictEqual(chunk.text, "world");
      assert.strictEqual(cs.chunks.length, 1);
    });

    test("throws on empty search text", () => {
      const cs = new ChunkedString("hello world");
      assert.throws(() => cs.findAcquire(""), /Empty find text not allowed/);
    });

    test("throws when substring is not found", () => {
      const cs = new ChunkedString("hello world");
      assert.throws(
        () => cs.findAcquire("foo"),
        /The substring was not found/
      );
    });

    test("throws when multiple instances exist", () => {
      const cs = new ChunkedString("hello hello");
      assert.throws(
        () => cs.findAcquire("hello"),
        /There are multiple instances/
      );
    });
  });

  describe("acquire", () => {
    test("acquires valid chunk", () => {
      const cs = new ChunkedString("abcde");
      const chunk = cs.acquire(1, 3);
      assert.strictEqual(chunk.offset, 1);
      assert.strictEqual(chunk.text, "bcd");
      assert.strictEqual(cs.chunks.length, 1);
    });

    test("throws on invalid coordinates (negative offset)", () => {
      const cs = new ChunkedString("abcde");
      assert.throws(() => cs.acquire(-1, 2), /Invalid coordinates/);
    });

    test("throws on invalid coordinates (zero or negative length)", () => {
      const cs = new ChunkedString("abcde");
      assert.throws(() => cs.acquire(1, 0), /Invalid coordinates/);
      assert.throws(() => cs.acquire(1, -1), /Invalid coordinates/);
    });

    test("throws on invalid coordinates (out of bounds)", () => {
      const cs = new ChunkedString("abcde");
      assert.throws(() => cs.acquire(3, 3), /Invalid coordinates/);
    });

    test("throws when chunk overlaps with existing chunk", () => {
      const cs = new ChunkedString("abcdefgh");
      cs.acquire(2, 4); // "cdef", offset 2 to 6
      assert.throws(() => cs.acquire(1, 3), /Chunk overlaps/);
      assert.throws(() => cs.acquire(3, 2), /Chunk overlaps/);
      assert.throws(() => cs.acquire(5, 3), /Chunk overlaps/);
      assert.throws(() => cs.acquire(0, 8), /Chunk overlaps/);
    });

    test("allows non-overlapping adjacent chunks", () => {
      const cs = new ChunkedString("abcdefgh");
      const c1 = cs.acquire(0, 2); // "ab"
      const c2 = cs.acquire(2, 2); // "cd"
      assert.strictEqual(c1.text, "ab");
      assert.strictEqual(c2.text, "cd");
      assert.strictEqual(cs.chunks.length, 2);
    });
  });

  describe("release", () => {
    test("releases an existing chunk", () => {
      const cs = new ChunkedString("hello world");
      const chunk = cs.acquire(0, 5);
      assert.strictEqual(cs.chunks.length, 1);
      cs.release(chunk);
      assert.strictEqual(cs.chunks.length, 0);
      assert.doesNotThrow(() => cs.acquire(0, 5));
    });

    test("throws when releasing an invalid chunk", () => {
      const cs = new ChunkedString("hello world");
      const dummyChunk = { offset: 0, text: "hello" };
      assert.throws(() => cs.release(dummyChunk), /Invalid chunk given/);
    });
  });

  describe("modify", () => {
    test("modifies chunk text and adjusts subsequent chunk offsets", () => {
      const cs = new ChunkedString("AAA BBB CCC");
      const c1 = cs.findAcquire("AAA");
      const c2 = cs.findAcquire("CCC");

      assert.strictEqual(c1.offset, 0);
      assert.strictEqual(c2.offset, 8);

      cs.modify(c1, "AAAAAA");
      assert.strictEqual(cs.text, "AAAAAA BBB CCC");
      assert.strictEqual(c1.offset, 0);
      assert.strictEqual(c1.text, "AAAAAA");
      assert.strictEqual(c2.offset, 11);

      cs.modify(c1, "A");
      assert.strictEqual(cs.text, "A BBB CCC");
      assert.strictEqual(c2.offset, 6);
    });

    test("throws on invalid chunk", () => {
      const cs = new ChunkedString("hello world");
      const dummyChunk = { offset: 0, text: "hello" };
      assert.throws(() => cs.modify(dummyChunk, "hi"), /Invalid chunk given/);
    });

    test("throws on empty replacement", () => {
      const cs = new ChunkedString("hello world");
      const chunk = cs.findAcquire("hello");
      assert.throws(() => cs.modify(chunk, ""), /Empty replacement not allowed/);
    });
  });
});

describe("Editor", () => {
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shell-bot-editor-test-"));
    tmpFile = path.join(tmpDir, "test.txt");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("constructor & length validation", () => {
    test("loads valid file successfully", () => {
      fs.writeFileSync(tmpFile, "line 1\nline 2", "utf-8");
      const reply = createMockReply();
      const editor = new Editor(reply, tmpFile);

      assert.strictEqual(editor.contents.text, "line 1\nline 2");
      assert.strictEqual(editor.file, tmpFile);
    });

    test("throws error if content exceeds 1500 characters", () => {
      const longContent = "a".repeat(1501);
      fs.writeFileSync(tmpFile, longContent, "utf-8");
      const reply = createMockReply();

      assert.throws(() => new Editor(reply, tmpFile), /The file is too long/);
    });

    test("throws error if line count exceeds 50", () => {
      const manyLines = Array(51).fill("a").join("\n");
      fs.writeFileSync(tmpFile, manyLines, "utf-8");
      const reply = createMockReply();

      assert.throws(() => new Editor(reply, tmpFile), /The file is too long/);
    });
  });

  describe("_render", () => {
    test("renders empty file indicator when text is empty/whitespace", () => {
      fs.writeFileSync(tmpFile, "   \n  ", "utf-8");
      const reply = createMockReply();
      const editor = new Editor(reply, tmpFile);

      assert.strictEqual(editor._render(), "<em>(empty file)</em>");
    });

    test("renders escaped HTML inside <pre> tag", () => {
      fs.writeFileSync(tmpFile, "<div>Hello & 'world'</div>", "utf-8");
      const reply = createMockReply();
      const editor = new Editor(reply, tmpFile);

      assert.strictEqual(
        editor._render(),
        "<pre>&lt;div&gt;Hello &amp; &#39;world&#39;&lt;/div&gt;</pre>"
      );
    });
  });

  describe("handleReply", () => {
    test("acquires chunk on matching reply message ID", async () => {
      fs.writeFileSync(tmpFile, "foo bar baz", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      const msg = {
        id: 200,
        text: "bar",
        reply: { id: 100 }
      };

      editor.handleReply(msg);
      await flushTicks();

      assert.ok(editor.chunks[200]);
      assert.strictEqual(editor.chunks[200].text, "bar");
    });

    test("ignores reply if reply message ID does not match", async () => {
      fs.writeFileSync(tmpFile, "foo bar baz", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      const msg = {
        id: 200,
        text: "bar",
        reply: { id: 999 }
      };

      editor.handleReply(msg);
      await flushTicks();

      assert.strictEqual(editor.chunks[200], undefined);
    });

    test("replies with error HTML if findAcquire fails", async () => {
      fs.writeFileSync(tmpFile, "foo bar baz", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      const msg = {
        id: 200,
        text: "nonexistent",
        reply: { id: 100 }
      };

      editor.handleReply(msg);
      await flushTicks();

      assert.strictEqual(editor.chunks[200], undefined);
      assert.strictEqual(reply.htmlReplies.length, 1);
      assert.match(reply.htmlReplies[0].args[0], /The substring was not found/);
    });
  });

  describe("handleEdit & attemptSave", () => {
    test("returns false for msg.id not in editor.chunks", () => {
      fs.writeFileSync(tmpFile, "foo bar baz", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      const res = editor.handleEdit({ id: 999, text: "something" });
      assert.strictEqual(res, false);
    });

    test("modifies chunk, updates file, and renders updated message", async () => {
      fs.writeFileSync(tmpFile, "hello world", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      editor.handleReply({
        id: 200,
        text: "world",
        reply: { id: 100 }
      });
      await flushTicks();

      const handled = editor.handleEdit({ id: 200, text: "everyone" });
      assert.strictEqual(handled, true);

      await sleep(50);

      const updated = fs.readFileSync(tmpFile, "utf-8");
      assert.strictEqual(updated, "hello everyone");

      assert.ok(reply.editedTexts.length >= 1);
      assert.strictEqual(
        reply.editedTexts[reply.editedTexts.length - 1].text,
        "<pre>hello everyone</pre>"
      );
    });

    test("handles file save error gracefully", async () => {
      fs.writeFileSync(tmpFile, "hello world", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      editor.handleReply({
        id: 200,
        text: "world",
        reply: { id: 100 }
      });
      await flushTicks();

      fs.rmSync(tmpDir, { recursive: true, force: true });

      editor.handleEdit({ id: 200, text: "everyone" });
      await sleep(50);

      assert.ok(reply.htmlReplies.some(r => r.fmt.includes("Couldn't save file")));
    });
  });

  describe("detach", () => {
    test("does nothing in handleReply after detach", async () => {
      fs.writeFileSync(tmpFile, "hello world", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      editor.detach();

      editor.handleReply({
        id: 200,
        text: "world",
        reply: { id: 100 }
      });
      await flushTicks();

      assert.strictEqual(editor.chunks[200], undefined);
    });

    test("returns false in handleEdit after detach", async () => {
      fs.writeFileSync(tmpFile, "hello world", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      editor.handleReply({
        id: 200,
        text: "world",
        reply: { id: 100 }
      });
      await flushTicks();

      editor.detach();

      const result = editor.handleEdit({ id: 200, text: "everyone" });
      assert.strictEqual(result, false);
    });

    test("prevents attemptSave from writing file or editing message when detached", async () => {
      fs.writeFileSync(tmpFile, "hello world", "utf-8");
      const reply = createMockReply(100);
      const editor = new Editor(reply, tmpFile);

      await flushTicks();

      editor.handleReply({
        id: 200,
        text: "world",
        reply: { id: 100 }
      });
      await flushTicks();

      editor.fileTouched = true;
      editor.contents.text = "modified text";
      editor.detach();

      editor.attemptSave();
      await sleep(50);

      const fileText = fs.readFileSync(tmpFile, "utf-8");
      assert.strictEqual(fileText, "hello world");
    });
  });
});
