const assert = require("assert");
const path = require("path");
const utils = require("../lib/utils");

console.log("Running unit tests for isPathInside helper...");

const baseDir = "/home/user/app";

// Valid child paths
assert.strictEqual(utils.isPathInside(baseDir, "/home/user/app/file.txt"), true, "file inside baseDir should be allowed");
assert.strictEqual(utils.isPathInside(baseDir, "/home/user/app/subdir/file.txt"), true, "subfolder file inside baseDir should be allowed");
assert.strictEqual(utils.isPathInside(baseDir, "/home/user/app"), true, "baseDir itself should be allowed");

// Invalid path traversal attempts
assert.strictEqual(utils.isPathInside(baseDir, "/home/user/app/../other.txt"), false, "parent folder traversal should be disallowed");
assert.strictEqual(utils.isPathInside(baseDir, "/etc/passwd"), false, "absolute path outside baseDir should be disallowed");
assert.strictEqual(utils.isPathInside(baseDir, "/home/user/app-other/file.txt"), false, "prefix matching path outside baseDir should be disallowed");

console.log("All unit tests for isPathInside passed successfully!");
