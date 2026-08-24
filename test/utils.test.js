const { describe, it } = require("node:test");
const assert = require("node:assert");
const { resolveBoolean } = require("../lib/utils");

describe("resolveBoolean", () => {
  it("should return true for truthy boolean string representations", () => {
    const truthyValues = ["yes", "y", "on", "enable", "enabled", "active", "true"];
    for (const val of truthyValues) {
      assert.strictEqual(resolveBoolean(val), true, `Expected true for "${val}"`);
    }
  });

  it("should return false for falsy boolean string representations", () => {
    const falsyValues = ["no", "n", "off", "disable", "disabled", "inactive", "false"];
    for (const val of falsyValues) {
      assert.strictEqual(resolveBoolean(val), false, `Expected false for "${val}"`);
    }
  });

  it("should handle mixed case and surrounding whitespace", () => {
    assert.strictEqual(resolveBoolean("  YES  "), true);
    assert.strictEqual(resolveBoolean("fAlSe\n"), false);
    assert.strictEqual(resolveBoolean("\tENABLE\t"), true);
    assert.strictEqual(resolveBoolean("  InAcTiVe  "), false);
  });

  it("should return null for unrecognized strings", () => {
    assert.strictEqual(resolveBoolean("maybe"), null);
    assert.strictEqual(resolveBoolean("1"), null);
    assert.strictEqual(resolveBoolean("0"), null);
    assert.strictEqual(resolveBoolean("random_string"), null);
    assert.strictEqual(resolveBoolean("toString"), null);
    assert.strictEqual(resolveBoolean("valueOf"), null);
  });

  it("should return null for falsy or empty input", () => {
    assert.strictEqual(resolveBoolean(null), null);
    assert.strictEqual(resolveBoolean(undefined), null);
    assert.strictEqual(resolveBoolean(""), null);
  });
});
