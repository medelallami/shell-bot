const assert = require("assert");
const path = require("path");
const utils = require("../lib/utils");

function testIsPathInside() {
  const baseDir = "/home/user/app";

  // Safe relative paths inside baseDir
  assert.strictEqual(
    utils.isPathInside(baseDir, path.resolve(baseDir, "file.txt")),
    true,
    "file.txt should be allowed"
  );
  assert.strictEqual(
    utils.isPathInside(baseDir, path.resolve(baseDir, "subdir/file.txt")),
    true,
    "subdir/file.txt should be allowed"
  );
  assert.strictEqual(
    utils.isPathInside(baseDir, path.resolve(baseDir, "./file.txt")),
    true,
    "./file.txt should be allowed"
  );

  // Path traversal attempts
  assert.strictEqual(
    utils.isPathInside(baseDir, path.resolve(baseDir, "../etc/passwd")),
    false,
    "../etc/passwd should be denied"
  );
  assert.strictEqual(
    utils.isPathInside(baseDir, path.resolve(baseDir, "../../etc/passwd")),
    false,
    "../../etc/passwd should be denied"
  );
  assert.strictEqual(
    utils.isPathInside(baseDir, "/etc/passwd"),
    false,
    "/etc/passwd should be denied"
  );
  assert.strictEqual(
    utils.isPathInside(baseDir, "/home/user/other/file.txt"),
    false,
    "other directory outside baseDir should be denied"
  );

  console.log("All path traversal validation unit tests passed!");
}

testIsPathInside();
