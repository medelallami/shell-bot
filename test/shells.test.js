const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const utils = require("../lib/utils");

describe("getShells", () => {
  let originalReadFileSync;
  let originalShellEnv;

  beforeEach(() => {
    originalReadFileSync = fs.readFileSync;
    originalShellEnv = process.env.SHELL;
  });

  afterEach(() => {
    fs.readFileSync = originalReadFileSync;
    if (originalShellEnv !== undefined) {
      process.env.SHELL = originalShellEnv;
    } else {
      delete process.env.SHELL;
    }
  });

  test("parses /etc/shells correctly when SHELL env var is not set", () => {
    delete process.env.SHELL;
    fs.readFileSync = (filepath, encoding) => {
      if (filepath === "/etc/shells") {
        return "/bin/bash\n/bin/zsh\n/usr/bin/fish\n";
      }
      return originalReadFileSync(filepath, encoding);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/bash", "/bin/zsh", "/usr/bin/fish"]);
  });

  test("ignores comments and empty lines in /etc/shells", () => {
    delete process.env.SHELL;
    fs.readFileSync = (filepath, encoding) => {
      if (filepath === "/etc/shells") {
        return "# /etc/shells: valid login shells\n/bin/sh\n/bin/bash # default\n\n# comment line\n/bin/zsh\n";
      }
      return originalReadFileSync(filepath, encoding);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/sh", "/bin/bash", "/bin/zsh"]);
  });

  test("moves SHELL env var to the front if present in /etc/shells", () => {
    process.env.SHELL = "/bin/zsh";
    fs.readFileSync = (filepath, encoding) => {
      if (filepath === "/etc/shells") {
        return "/bin/bash\n/bin/zsh\n/usr/bin/fish\n";
      }
      return originalReadFileSync(filepath, encoding);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/zsh", "/bin/bash", "/usr/bin/fish"]);
  });

  test("unshifts SHELL env var to the front if not in /etc/shells", () => {
    process.env.SHELL = "/usr/local/bin/customsh";
    fs.readFileSync = (filepath, encoding) => {
      if (filepath === "/etc/shells") {
        return "/bin/bash\n/bin/zsh\n";
      }
      return originalReadFileSync(filepath, encoding);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/usr/local/bin/customsh", "/bin/bash", "/bin/zsh"]);
  });

  test("falls back to SHELL env var if reading /etc/shells fails", () => {
    process.env.SHELL = "/bin/bash";
    fs.readFileSync = (filepath) => {
      if (filepath === "/etc/shells") {
        const err = new Error("ENOENT: no such file or directory");
        err.code = "ENOENT";
        throw err;
      }
      return originalReadFileSync(filepath);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/bash"]);
  });

  test("falls back to /bin/sh if /etc/shells fails to read and SHELL env var is not set", () => {
    delete process.env.SHELL;
    fs.readFileSync = (filepath) => {
      if (filepath === "/etc/shells") {
        const err = new Error("ENOENT: no such file or directory");
        err.code = "ENOENT";
        throw err;
      }
      return originalReadFileSync(filepath);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/sh"]);
  });

  test("falls back to /bin/sh if /etc/shells is empty and SHELL env var is not set", () => {
    delete process.env.SHELL;
    fs.readFileSync = (filepath) => {
      if (filepath === "/etc/shells") {
        return "";
      }
      return originalReadFileSync(filepath);
    };

    const shells = utils.getShells(true);
    assert.deepStrictEqual(shells, ["/bin/sh"]);
  });

  test("returns cached result unless reload parameter is true", () => {
    delete process.env.SHELL;
    let callCount = 0;
    fs.readFileSync = (filepath, encoding) => {
      if (filepath === "/etc/shells") {
        callCount++;
        return callCount === 1 ? "/bin/bash\n" : "/bin/zsh\n";
      }
      return originalReadFileSync(filepath, encoding);
    };

    // First call with reload=true populates cache with /bin/bash
    const first = utils.getShells(true);
    assert.deepStrictEqual(first, ["/bin/bash"]);
    assert.strictEqual(callCount, 1);

    // Second call without reload returns cached result without reading file again
    const second = utils.getShells();
    assert.deepStrictEqual(second, ["/bin/bash"]);
    assert.strictEqual(callCount, 1);

    // Third call with reload=true re-reads file and updates cache
    const third = utils.getShells(true);
    assert.deepStrictEqual(third, ["/bin/zsh"]);
    assert.strictEqual(callCount, 2);
  });
});
