const assert = require("assert");
const path = require("path");
const utils = require("../lib/utils");

function resolveDownloadFile(msg) {
  let file;
  const fileUploads = msg.fileUploads || {};

  if (Object.hasOwnProperty.call(fileUploads, msg.reply.id)) {
    file = fileUploads[msg.reply.id];
  } else if (msg.context.lastDirMessageId == msg.reply.id) {
    let filename = msg.filename ? path.basename(msg.filename.replace(/\\/g, "/")) : "";
    if (!filename || filename === "." || filename === "..") {
      filename = utils.constructFilename(msg);
    }
    file = path.join(msg.context.cwd, filename);
  }

  return file;
}

// Test cases
const cwd = "/home/user/project";
const lastDirMsgId = 123;

const testCases = [
  {
    name: "Standard filename",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "document.txt",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, "document.txt")
  },
  {
    name: "Relative path traversal with ../",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "../../../etc/passwd",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, "passwd")
  },
  {
    name: "Windows path traversal with ..\\",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "..\\..\\..\\etc\\passwd",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, "passwd")
  },
  {
    name: "Dot dot path (..)",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "..",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, utils.constructFilename({ file: { mime: "text/plain" } }))
  },
  {
    name: "Single dot path (.)",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: ".",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, utils.constructFilename({ file: { mime: "text/plain" } }))
  },
  {
    name: "Absolute path (/etc/shadow)",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "/etc/shadow",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, "shadow")
  },
  {
    name: "Empty or missing filename",
    msg: {
      reply: { id: lastDirMsgId },
      context: { cwd, lastDirMessageId: lastDirMsgId },
      filename: "",
      file: { mime: "text/plain" }
    },
    expected: path.join(cwd, utils.constructFilename({ file: { mime: "text/plain" } }))
  }
];

let failed = false;
for (const tc of testCases) {
  const actual = resolveDownloadFile(tc.msg);
  if (actual !== tc.expected) {
    console.error(`FAILED: ${tc.name}\n  Expected: ${tc.expected}\n  Actual:   ${actual}`);
    failed = true;
  } else {
    console.log(`PASSED: ${tc.name}`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("\nAll path traversal tests passed successfully!");
}
