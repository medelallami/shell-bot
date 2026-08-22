const test = require("node:test");
const assert = require("node:assert/strict");
const { getSanitizedEnv } = require("../lib/utils");

test("getSanitizedEnv - sanitizes environment variables correctly", async (t) => {
  // Save original env
  const originalEnv = { ...process.env };

  const testVars = [
    "TMUX",
    "TMUX_PANE",
    "STY",
    "WINDOW",
    "WINDOWID",
    "TERMCAP",
    "COLUMNS",
    "LINES",
    "TERM",
    "TEST_VAR_PRESERVED"
  ];

  // Set test env variables
  process.env.TMUX = "/tmp/tmux-1000/default,1234,0";
  process.env.TMUX_PANE = "%0";
  process.env.STY = "1234.pts-0.hostname";
  process.env.WINDOW = "0";
  process.env.WINDOWID = "1234567";
  process.env.TERMCAP = "xterm|xterm terminal wrapper...";
  process.env.COLUMNS = "80";
  process.env.LINES = "24";
  process.env.TERM = "xterm-256color";
  process.env.TEST_VAR_PRESERVED = "hello_world";

  try {
    const env = getSanitizedEnv();

    // Verify deleted variables
    assert.strictEqual("TMUX" in env, false);
    assert.strictEqual("TMUX_PANE" in env, false);
    assert.strictEqual("STY" in env, false);
    assert.strictEqual("WINDOW" in env, false);
    assert.strictEqual("WINDOWID" in env, false);
    assert.strictEqual("TERMCAP" in env, false);
    assert.strictEqual("COLUMNS" in env, false);
    assert.strictEqual("LINES" in env, false);

    // Verify TERM is set to "screen"
    assert.strictEqual(env.TERM, "screen");

    // Verify preserved variables
    assert.strictEqual(env.TEST_VAR_PRESERVED, "hello_world");

    // Verify process.env was not modified
    assert.strictEqual(process.env.TMUX, "/tmp/tmux-1000/default,1234,0");
    assert.strictEqual(process.env.TERM, "xterm-256color");
  } finally {
    // Restore original process.env state for tested variables
    for (const key of testVars) {
      if (Object.prototype.hasOwnProperty.call(originalEnv, key)) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  }
});
