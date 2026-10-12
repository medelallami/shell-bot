const assert = require("assert");
const path = require("path");
const utils = require("../lib/utils");

console.log("Running path traversal tests...");

// Test 1: utils.isPathInside unit tests
const baseDir = "/home/user/app";

assert.strictEqual(
  utils.isPathInside(baseDir, "/home/user/app/file.txt"),
  true,
  "File inside base directory should be allowed"
);

assert.strictEqual(
  utils.isPathInside(baseDir, "/home/user/app/subfolder/file.txt"),
  true,
  "File in subfolder should be allowed"
);

assert.strictEqual(
  utils.isPathInside(baseDir, "/home/user/app/../file.txt"),
  false,
  "Path traversing outside base directory should be denied"
);

assert.strictEqual(
  utils.isPathInside(baseDir, "/etc/passwd"),
  false,
  "Absolute path outside base directory should be denied"
);

assert.strictEqual(
  utils.isPathInside(baseDir, "/home/user/appother/file.txt"),
  false,
  "Directory prefix overlap without separator should be denied"
);

assert.strictEqual(
  utils.isPathInside(baseDir, baseDir),
  true,
  "Base directory itself is inside"
);

assert.strictEqual(
  utils.isPathInside("/some/other/dir", "relative_file.txt"),
  true,
  "Relative path should resolve relative to base directory"
);

// Test 2: Simulate command handler logic
function simulateFileCommand(fileArg, cwd) {
  const fullPath = path.resolve(cwd, fileArg);
  if (!utils.isPathInside(cwd, fullPath)) {
    return { status: "denied", path: fullPath };
  }
  return { status: "allowed", path: fullPath };
}

const cwd = "/var/www/app";

assert.strictEqual(
  simulateFileCommand("index.js", cwd).status,
  "allowed",
  "Relative valid file should be allowed"
);

assert.strictEqual(
  simulateFileCommand("../../etc/shadow", cwd).status,
  "denied",
  "Path traversal attempt should be denied"
);

assert.strictEqual(
  simulateFileCommand("/etc/hosts", cwd).status,
  "denied",
  "Absolute path attempt outside cwd should be denied"
);

console.log("All path traversal tests passed successfully!");
