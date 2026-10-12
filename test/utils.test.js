const assert = require("assert");
const { getSanitizedEnv } = require("../lib/utils");

function testGetSanitizedEnv() {
  // Store original process.env values to restore after test
  const originalEnv = { ...process.env };

  try {
    // Scenario 1: Standard environment variables are preserved
    process.env.TEST_DUMMY_VAR = "dummy_value";
    let sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.TEST_DUMMY_VAR, "dummy_value", "Standard environment variable should be preserved");

    // Scenario 2: Tmux-related variables are deleted
    process.env.TMUX = "/tmp/tmux-1000/default,1234,0";
    process.env.TMUX_PANE = "%0";
    sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.TMUX, undefined, "TMUX variable should be deleted");
    assert.strictEqual(sanitized.TMUX_PANE, undefined, "TMUX_PANE variable should be deleted");
    assert.strictEqual("TMUX" in sanitized, false, "TMUX key should not exist in sanitized object");
    assert.strictEqual("TMUX_PANE" in sanitized, false, "TMUX_PANE key should not exist in sanitized object");

    // Scenario 3: Screen-related variables are deleted
    process.env.STY = "1234.pts-0.host";
    process.env.WINDOW = "0";
    sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.STY, undefined, "STY variable should be deleted");
    assert.strictEqual(sanitized.WINDOW, undefined, "WINDOW variable should be deleted");
    assert.strictEqual("STY" in sanitized, false, "STY key should not exist in sanitized object");
    assert.strictEqual("WINDOW" in sanitized, false, "WINDOW key should not exist in sanitized object");

    // Scenario 4: Terminal-confusing variables are deleted
    process.env.WINDOWID = "12345";
    process.env.TERMCAP = "xterm|gnu terminal emulator";
    process.env.COLUMNS = "80";
    process.env.LINES = "24";
    sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.WINDOWID, undefined, "WINDOWID variable should be deleted");
    assert.strictEqual(sanitized.TERMCAP, undefined, "TERMCAP variable should be deleted");
    assert.strictEqual(sanitized.COLUMNS, undefined, "COLUMNS variable should be deleted");
    assert.strictEqual(sanitized.LINES, undefined, "LINES variable should be deleted");

    // Scenario 5: TERM variable is explicitly set to "screen"
    process.env.TERM = "xterm-256color";
    sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.TERM, "screen", "TERM variable should be set to 'screen'");

    delete process.env.TERM;
    sanitized = getSanitizedEnv();
    assert.strictEqual(sanitized.TERM, "screen", "TERM variable should be set to 'screen' even if unset in process.env");

    // Scenario 6: process.env is not mutated by getSanitizedEnv or by modifying returned env
    process.env.TMUX = "test_tmux";
    process.env.TERM = "xterm-256color";
    sanitized = getSanitizedEnv();
    assert.strictEqual(process.env.TMUX, "test_tmux", "process.env.TMUX should not be deleted");
    assert.strictEqual(process.env.TERM, "xterm-256color", "process.env.TERM should not be changed");

    sanitized.MUTATION_TEST = "mutated";
    assert.strictEqual(process.env.MUTATION_TEST, undefined, "Modifying returned object should not mutate process.env");

    console.log("All getSanitizedEnv tests passed successfully!");
  } finally {
    // Restore process.env
    for (const key in process.env) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const key in originalEnv) {
      process.env[key] = originalEnv[key];
    }
  }
}

testGetSanitizedEnv();
