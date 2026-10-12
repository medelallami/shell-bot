const fs = require("fs");
const editorModule = require("./lib/editor");

let ChunkedString = editorModule.ChunkedString;
if (!ChunkedString) {
  const code = fs.readFileSync("./lib/editor.js", "utf-8");
  const csCode = code.substring(code.indexOf("class ChunkedString"), code.indexOf("class Editor"));
  ChunkedString = Function(`${csCode}; return ChunkedString;`)();
}

function runBenchmark(iterations = 200000) {
  const initialText = "PREFIX_" + "a".repeat(500) + "_MIDDLE_" + "b".repeat(500) + "_SUFFIX";

  const start = process.hrtime.bigint();

  const cs = new ChunkedString(initialText);
  const chunk1 = cs.findAcquire("_MIDDLE_");
  const chunk2 = cs.findAcquire("_SUFFIX");

  for (let i = 0; i < iterations; i++) {
    cs.modify(chunk1, "_MID_" + (i % 100) + "_");
    cs.modify(chunk2, "_SUF_" + (i % 100) + "_");
    if (i % 5 === 0) {
      const dummy = cs.text;
    }
  }

  const end = process.hrtime.bigint();
  const durMs = Number(end - start) / 1e6;
  console.log(`Benchmark completed ${iterations} modify iterations in ${durMs.toFixed(2)} ms`);
  return durMs;
}

runBenchmark();
