const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBoolean } = require('../lib/utils');

test('resolveBoolean - truthy inputs', () => {
  const truthyInputs = ['yes', 'y', 'on', 'enable', 'enabled', 'active', 'true'];
  for (const input of truthyInputs) {
    assert.strictEqual(resolveBoolean(input), true, `Expected "${input}" to resolve to true`);
  }
});

test('resolveBoolean - falsy inputs', () => {
  const falsyInputs = ['no', 'n', 'off', 'disable', 'disabled', 'inactive', 'false'];
  for (const input of falsyInputs) {
    assert.strictEqual(resolveBoolean(input), false, `Expected "${input}" to resolve to false`);
  }
});

test('resolveBoolean - case insensitivity and trimming', () => {
  assert.strictEqual(resolveBoolean(' YES '), true);
  assert.strictEqual(resolveBoolean('  Disabled\n'), false);
  assert.strictEqual(resolveBoolean('\tACTIVE\t'), true);
  assert.strictEqual(resolveBoolean('OFF'), false);
});

test('resolveBoolean - null, undefined, empty, and whitespace strings', () => {
  assert.strictEqual(resolveBoolean(null), null);
  assert.strictEqual(resolveBoolean(undefined), null);
  assert.strictEqual(resolveBoolean(''), null);
  assert.strictEqual(resolveBoolean('   '), null);
  assert.strictEqual(resolveBoolean('\t\n'), null);
});

test('resolveBoolean - invalid and non-boolean strings', () => {
  assert.strictEqual(resolveBoolean('maybe'), null);
  assert.strictEqual(resolveBoolean('1'), null);
  assert.strictEqual(resolveBoolean('0'), null);
  assert.strictEqual(resolveBoolean('unknown'), null);
});

test('resolveBoolean - property collision safety', () => {
  assert.strictEqual(resolveBoolean('toString'), null);
  assert.strictEqual(resolveBoolean('hasOwnProperty'), null);
  assert.strictEqual(resolveBoolean('__proto__'), null);
  assert.strictEqual(resolveBoolean('constructor'), null);
  assert.strictEqual(resolveBoolean('valueOf'), null);
});
