const assert = require("assert");
const { describe, it } = require("node:test");
const { formatSignal } = require("../lib/utils");

describe("formatSignal", () => {
  it("should format valid 1-based signal numbers correctly", () => {
    assert.strictEqual(formatSignal(1), "SIGHUP");
    assert.strictEqual(formatSignal(2), "SIGINT");
    assert.strictEqual(formatSignal(9), "SIGKILL");
    assert.strictEqual(formatSignal(15), "SIGTERM");
    assert.strictEqual(formatSignal(31), "SIGSYS");
  });

  it("should format all valid signals from 1 to 31", () => {
    const expectedSignals = [
      "SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT", "SIGBUS",
      "SIGFPE", "SIGKILL", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGPIPE", "SIGALRM",
      "SIGTERM", "SIGSTKFLT", "SIGCHLD", "SIGCONT", "SIGSTOP", "SIGTSTP", "SIGTTIN",
      "SIGTTOU", "SIGURG", "SIGXCPU", "SIGXFSZ", "SIGVTALRM", "SIGPROF", "SIGWINCH",
      "SIGPOLL", "SIGPWR", "SIGSYS"
    ];

    expectedSignals.forEach((expected, index) => {
      const signalNum = index + 1;
      assert.strictEqual(formatSignal(signalNum), expected);
    });
  });

  it("should handle out-of-bounds lower boundary signals (0, negative numbers)", () => {
    assert.strictEqual(formatSignal(0), "unknown signal -1");
    assert.strictEqual(formatSignal(-1), "unknown signal -2");
    assert.strictEqual(formatSignal(-9), "unknown signal -10");
  });

  it("should handle out-of-bounds upper boundary signals (32 and above)", () => {
    assert.strictEqual(formatSignal(32), "unknown signal 31");
    assert.strictEqual(formatSignal(100), "unknown signal 99");
  });

  it("should handle string representations of valid signal numbers", () => {
    assert.strictEqual(formatSignal("1"), "SIGHUP");
    assert.strictEqual(formatSignal("9"), "SIGKILL");
    assert.strictEqual(formatSignal("15"), "SIGTERM");
  });

  it("should handle non-numeric or invalid inputs", () => {
    assert.strictEqual(formatSignal(undefined), "unknown signal NaN");
    assert.strictEqual(formatSignal("invalid"), "unknown signal NaN");
  });
});
