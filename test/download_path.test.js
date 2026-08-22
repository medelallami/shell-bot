const assert = require("assert");
const path = require("path");

function validateDownloadPath(cwd, filename) {
  const file = path.resolve(cwd, filename);
  const rel = path.relative(cwd, file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return file;
}

const cwd = "/home/user/workspace";

// Test valid filenames
assert.strictEqual(
  validateDownloadPath(cwd, "file.txt"),
  path.join(cwd, "file.txt")
);
assert.strictEqual(
  validateDownloadPath(cwd, "subfolder/file.txt"),
  path.join(cwd, "subfolder", "file.txt")
);

// Test path traversal inputs
assert.strictEqual(validateDownloadPath(cwd, "../file.txt"), null);
assert.strictEqual(validateDownloadPath(cwd, "../../etc/passwd"), null);
assert.strictEqual(validateDownloadPath(cwd, "/etc/passwd"), null);
assert.strictEqual(validateDownloadPath(cwd, "."), null);
assert.strictEqual(validateDownloadPath(cwd, ".."), null);

console.log("All download path validation tests passed successfully!");
