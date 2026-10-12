const fs = require("fs");
const editorModule = require("./lib/editor");

let ChunkedString = editorModule.ChunkedString;
if (!ChunkedString) {
  const code = fs.readFileSync("./lib/editor.js", "utf-8");
  const csCode = code.substring(code.indexOf("class ChunkedString"), code.indexOf("class Editor"));
  ChunkedString = Function(`${csCode}; return ChunkedString;`)();
}

function runTests() {
  console.log("Running ChunkedString test suite...");

  const initialText = "Hello world, this is a test string for ChunkedString.";
  const cs = new ChunkedString(initialText);

  // 1. findAcquire & acquire
  const chunk1 = cs.findAcquire("world");
  if (chunk1.offset !== 6) throw new Error(`Expected chunk1 offset 6, got ${chunk1.offset}`);
  if (chunk1.text !== "world") throw new Error(`Expected chunk1 text 'world', got '${chunk1.text}'`);

  const chunk2 = cs.findAcquire("test string");
  if (chunk2.offset !== 23) throw new Error(`Expected chunk2 offset 23, got ${chunk2.offset}`);
  if (chunk2.text !== "test string") throw new Error(`Expected chunk2 text 'test string', got '${chunk2.text}'`);

  // 2. modify chunk1
  cs.modify(chunk1, "EARTH");
  if (cs.text !== "Hello EARTH, this is a test string for ChunkedString.") {
    throw new Error(`Unexpected text after modify chunk1: '${cs.text}'`);
  }
  // check offset shift for chunk2
  if (chunk2.offset !== 23) throw new Error(`Expected chunk2 offset 23 (since length of EARTH == length of world), got ${chunk2.offset}`);

  cs.modify(chunk1, "BEAUTIFUL GLOBE");
  if (cs.text !== "Hello BEAUTIFUL GLOBE, this is a test string for ChunkedString.") {
    throw new Error(`Unexpected text after expanding chunk1: '${cs.text}'`);
  }
  // length difference: "BEAUTIFUL GLOBE".length (15) - 5 = +10. So chunk2 offset should be 23 + 10 = 33.
  if (chunk2.offset !== 33) throw new Error(`Expected chunk2 offset 33, got ${chunk2.offset}`);

  // 3. modify chunk2
  cs.modify(chunk2, "EXAMPLE");
  if (cs.text !== "Hello BEAUTIFUL GLOBE, this is a EXAMPLE for ChunkedString.") {
    throw new Error(`Unexpected text after modify chunk2: '${cs.text}'`);
  }

  // 4. Overlap error
  try {
    cs.acquire(0, 10); // overlaps with chunk1 at offset 6
    throw new Error("Should have thrown chunk overlaps error");
  } catch (e) {
    if (!e.message.includes("Chunk overlaps")) throw e;
  }

  // 5. Release chunk
  cs.release(chunk1);
  if (cs.text !== "Hello BEAUTIFUL GLOBE, this is a EXAMPLE for ChunkedString.") {
    throw new Error(`Text changed after release: '${cs.text}'`);
  }

  // Modifying released chunk should throw
  try {
    cs.modify(chunk1, "FAIL");
    throw new Error("Should have thrown invalid chunk error");
  } catch (e) {
    if (!e.message.includes("Invalid chunk given")) throw e;
  }

  // 6. Multiple instances error
  try {
    const csDup = new ChunkedString("foo foo foo");
    csDup.findAcquire("foo");
    throw new Error("Should have thrown multiple instances error");
  } catch (e) {
    if (!e.message.includes("multiple instances")) throw e;
  }

  // 7. Empty replacement error
  try {
    cs.modify(chunk2, "");
    throw new Error("Should have thrown empty replacement error");
  } catch (e) {
    if (!e.message.includes("Empty replacement not allowed")) throw e;
  }

  console.log("All ChunkedString unit tests passed successfully!");
}

runTests();
