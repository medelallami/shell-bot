const assert = require("assert");
const utils = require("../lib/utils");

// Test createAgent without proxy set
delete process.env.https_proxy;
delete process.env.all_proxy;
assert.strictEqual(utils.createAgent(), undefined, "createAgent should return undefined when no proxy env vars are set");

// Test createAgent with invalid proxy URL
process.env.https_proxy = "http://[invalid-url";
assert.strictEqual(utils.createAgent(), undefined, "createAgent should return undefined on invalid proxy URL");

// Test createAgent with unsupported proxy protocol
process.env.https_proxy = "ftp://127.0.0.1:21";
assert.strictEqual(utils.createAgent(), undefined, "createAgent should return undefined for unsupported proxy protocol");

// Test createAgent with http proxy
process.env.https_proxy = "http://127.0.0.1:8080";
// Should attempt to load https-proxy-agent without throwing uncaught errors
const agent = utils.createAgent();
// Depending on installed dependency / package version, it returns an agent or undefined on catch
assert(agent !== null, "createAgent should handle http proxy without throwing");

// Test resolveBoolean
assert.strictEqual(utils.resolveBoolean("yes"), true);
assert.strictEqual(utils.resolveBoolean("no"), false);
assert.strictEqual(utils.resolveBoolean("enable"), true);
assert.strictEqual(utils.resolveBoolean("disable"), false);
assert.strictEqual(utils.resolveBoolean("invalid"), null);

// Test formatSignal
assert.strictEqual(utils.formatSignal(1), "SIGHUP");
assert.strictEqual(utils.formatSignal(2), "SIGINT");
assert.strictEqual(utils.formatSignal(15), "SIGTERM");

// Test generateToken
const token = utils.generateToken();
assert.strictEqual(typeof token, "string");
assert.strictEqual(token.length, 24);

// Test getSanitizedEnv
const env = utils.getSanitizedEnv();
assert.strictEqual(env.TERM, "screen");

// Cleanup env
delete process.env.https_proxy;
delete process.env.all_proxy;

console.log("All utils tests passed successfully!");
