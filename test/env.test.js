const assert = require("assert");
const utils = require("../lib/utils");

console.log("Running env security tests...");

// 1. Test isProtectedEnvVar for protected environment variables
const protectedVars = [
  "PATH",
  "path",
  "LD_PRELOAD",
  "ld_preload",
  "LD_LIBRARY_PATH",
  "NODE_OPTIONS",
  "PYTHONPATH",
  "RUBYOPT",
  "PERL5OPT",
  "IFS",
  "SHELL",
  "BASH_ENV",
  "PROMPT_COMMAND",
  "BASH_FUNC_myfunc%%"
];

for (const key of protectedVars) {
  assert.strictEqual(
    utils.isProtectedEnvVar(key),
    true,
    `Expected '${key}' to be protected`
  );
}

// 2. Test isProtectedEnvVar for non-protected environment variables
const allowedVars = [
  "FOO",
  "BAR",
  "MY_VAR",
  "CUSTOM_SETTING",
  "LANG",
  "EDITOR"
];

for (const key of allowedVars) {
  assert.strictEqual(
    utils.isProtectedEnvVar(key),
    false,
    `Expected '${key}' NOT to be protected`
  );
}

// 3. Test simulating environment modification logic from server.js
function handleEnvUpdate(env, inputKey, inputValue) {
  let key = inputKey.trim().replace(/\s+/g, " ");
  if (utils.isProtectedEnvVar(key)) {
    return { success: false, error: "Modification of key is restricted for security reasons." };
  }
  if (inputValue.length) {
    env[key] = inputValue;
  } else {
    delete env[key];
  }
  return { success: true };
}

const mockEnv = { FOO: "initial", PATH: "/usr/bin" };

// Attempt modifying PATH
const pathResult = handleEnvUpdate(mockEnv, "PATH", "/tmp/malicious");
assert.strictEqual(pathResult.success, false);
assert.strictEqual(mockEnv.PATH, "/usr/bin");

// Attempt deleting PATH
const pathDeleteResult = handleEnvUpdate(mockEnv, "PATH", "");
assert.strictEqual(pathDeleteResult.success, false);
assert.strictEqual(mockEnv.PATH, "/usr/bin");

// Attempt setting LD_PRELOAD
const ldPreloadResult = handleEnvUpdate(mockEnv, "LD_PRELOAD", "/tmp/libhack.so");
assert.strictEqual(ldPreloadResult.success, false);
assert.strictEqual(mockEnv.LD_PRELOAD, undefined);

// Attempt setting allowed variable FOO
const fooResult = handleEnvUpdate(mockEnv, "FOO", "updated");
assert.strictEqual(fooResult.success, true);
assert.strictEqual(mockEnv.FOO, "updated");

// Attempt deleting allowed variable FOO
const fooDeleteResult = handleEnvUpdate(mockEnv, "FOO", "");
assert.strictEqual(fooDeleteResult.success, true);
assert.strictEqual(mockEnv.FOO, undefined);

console.log("All env security tests passed successfully!");
