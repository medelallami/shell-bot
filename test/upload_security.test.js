const assert = require("assert");
const path = require("path");

function isPathSafe(cwd, fileInput) {
  const fullPath = path.resolve(cwd, fileInput);
  const relative = path.relative(cwd, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

const cwd = "/home/user/workspace";

// Safe paths
assert.strictEqual(isPathSafe(cwd, "file.txt"), true);
assert.strictEqual(isPathSafe(cwd, "./file.txt"), true);
assert.strictEqual(isPathSafe(cwd, "subfolder/file.txt"), true);

// Unsafe path traversal attempts
assert.strictEqual(isPathSafe(cwd, "../file.txt"), false);
assert.strictEqual(isPathSafe(cwd, "../../etc/passwd"), false);
assert.strictEqual(isPathSafe(cwd, "/etc/passwd"), false);

console.log("All upload path security unit tests passed!");
