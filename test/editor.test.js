const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { Editor, ChunkedString } = require("../lib/editor");
const libIndex = require("../lib");

const tmpDir = path.join(__dirname, "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

function mockReply() {
  const replies = [];
  return {
    parameters: {},
    text: (text, mode) => {
      replies.push({ type: "text", text, mode });
      return {
        then: (cb) => {
          cb(null, { id: 100 });
          return Promise.resolve();
        }
      };
    },
    html: (format, ...args) => {
      replies.push({ type: "html", message: util_format(format, ...args) });
      return Promise.resolve({ id: 101 });
    },
    editText: (id, text, mode) => {
      replies.push({ type: "editText", id, text, mode });
      return {
        then: (cb) => {
          if (cb) cb(null, { id });
          return Promise.resolve();
        }
      };
    },
    replies
  };
}

function util_format(fmt, ...args) {
  let i = 0;
  return fmt.replace(/%s/g, () => args[i++]);
}

async function testEditorExports() {
  console.log("Testing exports...");
  assert.strictEqual(typeof Editor, "function");
  assert.strictEqual(typeof ChunkedString, "function");
  assert.strictEqual(libIndex.Editor, Editor);
  assert.strictEqual(libIndex.ChunkedString, ChunkedString);
  console.log("✔ Exports verified.");
}

async function testEditorAsyncCreate() {
  console.log("Testing Editor.create()...");
  const testFile = path.join(tmpDir, "test_editor_async.txt");
  const fileContent = "Line 1\nLine 2\nLine 3";
  fs.writeFileSync(testFile, fileContent, "utf-8");

  const reply = mockReply();
  const editor = await Editor.create(reply, testFile);

  assert.strictEqual(editor.file, testFile);
  assert.strictEqual(editor.contents.text, fileContent);

  fs.unlinkSync(testFile);
  console.log("✔ Editor.create() verified.");
}

async function testEditorFileTooLong() {
  console.log("Testing file size/line limits...");
  const longFile = path.join(tmpDir, "long.txt");
  fs.writeFileSync(longFile, "a".repeat(1501), "utf-8");

  const reply = mockReply();
  await assert.rejects(
    async () => {
      await Editor.create(reply, longFile);
    },
    { message: "The file is too long" }
  );

  const manyLinesFile = path.join(tmpDir, "lines.txt");
  fs.writeFileSync(manyLinesFile, Array(52).fill("line").join("\n"), "utf-8");

  await assert.rejects(
    async () => {
      await Editor.create(reply, manyLinesFile);
    },
    { message: "The file is too long" }
  );

  fs.unlinkSync(longFile);
  fs.unlinkSync(manyLinesFile);
  console.log("✔ File size limits verified.");
}

async function testSyncFallback() {
  console.log("Testing Editor synchronous constructor fallback with explicit encoding...");
  const testFile = path.join(tmpDir, "test_sync_fallback.txt");
  fs.writeFileSync(testFile, "Fallback content", "utf-8");

  const reply = mockReply();
  // Test constructor with explicit encoding as 3rd parameter
  const editor = new Editor(reply, testFile, "utf-8");

  assert.strictEqual(editor.encoding, "utf-8");
  assert.strictEqual(editor.contents.text, "Fallback content");

  fs.unlinkSync(testFile);
  console.log("✔ Synchronous constructor fallback verified.");
}

async function testEditorInteractions() {
  console.log("Testing Editor reply and edit handling...");
  const testFile = path.join(tmpDir, "test_interactions.txt");
  fs.writeFileSync(testFile, "Hello World", "utf-8");

  const reply = mockReply();
  const editor = await Editor.create(reply, testFile);

  // Simulate handleReply
  editor.handleReply({
    id: 200,
    text: "World",
    reply: { id: 100 }
  });

  // Wait for promise resolution on handleReply
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(editor.chunks[200]);

  // Simulate handleEdit
  const editHandled = editor.handleEdit({
    id: 200,
    text: "Telegram"
  });
  assert.strictEqual(editHandled, true);
  assert.strictEqual(editor.contents.text, "Hello Telegram");

  // Wait for attemptSave nextTick
  await new Promise((resolve) => setTimeout(resolve, 50));

  const savedContent = fs.readFileSync(testFile, "utf-8");
  assert.strictEqual(savedContent, "Hello Telegram");

  // Test detach
  editor.detach();
  assert.strictEqual(editor.detached, true);
  const handleResult = editor.handleEdit({ id: 200, text: "Noop" });
  assert.strictEqual(handleResult, false);

  fs.unlinkSync(testFile);
  console.log("✔ Editor interactions and detach verified.");
}

async function main() {
  try {
    await testEditorExports();
    await testEditorAsyncCreate();
    await testEditorFileTooLong();
    await testSyncFallback();
    await testEditorInteractions();
    console.log("\nAll Editor tests passed successfully!");
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
