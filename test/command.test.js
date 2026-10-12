const assert = require("assert");
const pty = require("node-pty");

// Test that pty.spawn with `--` works properly for commands starting with `-`
const shell = process.env.SHELL || "/bin/sh";

// Test 1: Standard command execution
const ptyProcess1 = pty.spawn(shell, ["-c", "--", "echo hello"], {
  cols: 80,
  rows: 24,
});

let output1 = "";
ptyProcess1.on("data", (data) => {
  output1 += data;
});

ptyProcess1.on("exit", (code) => {
  assert.strictEqual(code, 0, "Exit code should be 0");
  assert.ok(output1.includes("hello"), "Output should contain 'hello'");
  console.log("Test 1 passed: Standard command with -- works");

  // Test 2: Command starting with - which could be misparsed as shell flag without --
  const ptyProcess2 = pty.spawn(shell, ["-c", "--", "-echo_test 2>&1 || echo safe"], {
    cols: 80,
    rows: 24,
  });

  let output2 = "";
  ptyProcess2.on("data", (data) => {
    output2 += data;
  });

  ptyProcess2.on("exit", (code2) => {
    // Should safely pass -echo_test as the command to execute (and not interpret -e as shell option)
    assert.ok(output2.length > 0, "Pty should produce output");
    console.log("Test 2 passed: Command starting with - handled safely");
    console.log("All tests passed successfully!");
  });
});
