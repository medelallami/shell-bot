const assert = require('assert');
const utils = require('../lib/utils');

function runTests() {
  console.log('Running utils tests...');

  const originalHttpsProxy = process.env.https_proxy;
  const originalAllProxy = process.env.all_proxy;

  try {
    // 1. Unset environment variables -> returns undefined
    delete process.env.https_proxy;
    delete process.env.all_proxy;
    assert.strictEqual(utils.createAgent(), undefined, 'createAgent should return undefined when proxy env vars are unset');

    // 2. HTTP proxy
    process.env.https_proxy = 'http://127.0.0.1:8080';
    const httpAgent = utils.createAgent();
    assert.ok(httpAgent, 'createAgent should return an agent for HTTP proxy');
    assert.strictEqual(httpAgent.constructor.name, 'HttpsProxyAgent', 'Should be an HttpsProxyAgent instance');

    // 3. HTTPS proxy
    process.env.https_proxy = 'https://127.0.0.1:8443';
    const httpsAgent = utils.createAgent();
    assert.ok(httpsAgent, 'createAgent should return an agent for HTTPS proxy');
    assert.strictEqual(httpsAgent.constructor.name, 'HttpsProxyAgent', 'Should be an HttpsProxyAgent instance');

    // 4. SOCKS proxy
    process.env.https_proxy = 'socks5://127.0.0.1:1080';
    const socksAgent = utils.createAgent();
    assert.ok(socksAgent, 'createAgent should return an agent for SOCKS5 proxy');
    assert.strictEqual(socksAgent.constructor.name, 'SocksProxyAgent', 'Should be a SocksProxyAgent instance');

    // 5. Fallback to all_proxy
    delete process.env.https_proxy;
    process.env.all_proxy = 'socks4a://127.0.0.1:1080';
    const allProxyAgent = utils.createAgent();
    assert.ok(allProxyAgent, 'createAgent should fallback to all_proxy');
    assert.strictEqual(allProxyAgent.constructor.name, 'SocksProxyAgent', 'Should be a SocksProxyAgent instance');

    // 6. Unknown proxy protocol -> returns undefined
    process.env.https_proxy = 'ftp://127.0.0.1:21';
    delete process.env.all_proxy;

    // Suppress console.error log during invalid protocol test
    const origError = console.error;
    console.error = () => {};
    const unknownAgent = utils.createAgent();
    console.error = origError;

    assert.strictEqual(unknownAgent, undefined, 'createAgent should return undefined for unknown proxy protocol');

    // 7. Resolve boolean test
    assert.strictEqual(utils.resolveBoolean('yes'), true);
    assert.strictEqual(utils.resolveBoolean('no'), false);
    assert.strictEqual(utils.resolveBoolean('invalid'), null);

    console.log('All tests passed successfully!');
  } finally {
    if (originalHttpsProxy !== undefined) {
      process.env.https_proxy = originalHttpsProxy;
    } else {
      delete process.env.https_proxy;
    }
    if (originalAllProxy !== undefined) {
      process.env.all_proxy = originalAllProxy;
    } else {
      delete process.env.all_proxy;
    }
  }
}

runTests();
