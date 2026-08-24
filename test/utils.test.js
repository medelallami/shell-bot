const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const utils = require("../lib/utils");

test("isPathSafe - allows valid files in current directory", () => {
  const cwd = "/home/user/project";
  const target = path.resolve(cwd, "file.txt");
  assert.equal(utils.isPathSafe(cwd, target), true);
});

test("isPathSafe - allows valid files in subdirectories", () => {
  const cwd = "/home/user/project";
  const target = path.resolve(cwd, "subdir/file.txt");
  assert.equal(utils.isPathSafe(cwd, target), true);
});

test("isPathSafe - allows the working directory itself", () => {
  const cwd = "/home/user/project";
  const target = path.resolve(cwd, ".");
  assert.equal(utils.isPathSafe(cwd, target), true);
});

test("isPathSafe - blocks parent directory traversal", () => {
  const cwd = "/home/user/project";
  const target = path.resolve(cwd, "../file.txt");
  assert.equal(utils.isPathSafe(cwd, target), false);
});

test("isPathSafe - blocks sensitive system path traversal (/etc/passwd)", () => {
  const cwd = "/home/user/project";
  const target = path.resolve(cwd, "../../etc/passwd");
  assert.equal(utils.isPathSafe(cwd, target), false);
});

test("isPathSafe - blocks absolute path outside cwd", () => {
  const cwd = "/home/user/project";
  const target = "/etc/passwd";
  assert.equal(utils.isPathSafe(cwd, target), false);
});

test("isPathSafe - blocks prefix collision directory names", () => {
  const cwd = "/home/user/project";
  const target = "/home/user/project-other/file.txt";
  assert.equal(utils.isPathSafe(cwd, target), false);
});
