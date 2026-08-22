const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Editor } = require('../lib/editor');

const mockReply = {
  parameters: {},
  text: () => ({ then: (cb) => cb(null, { id: 100 }) }),
  html: () => {},
  reply: () => ({ html: () => {} }),
  editText: () => ({ then: (cb) => cb(null, { id: 100 }) }),
};

async function runTests() {
  console.log('Running Editor tests...');
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const validFile = path.join(tmpDir, 'valid.txt');
  fs.writeFileSync(validFile, 'hello world\nline 2');

  const longFile = path.join(tmpDir, 'long.txt');
  fs.writeFileSync(longFile, Array(60).fill('line').join('\n'));

  const nonExistentFile = path.join(tmpDir, 'does_not_exist.txt');

  // Test 1: Editor.create with valid file
  {
    const editor = await Editor.create(mockReply, validFile);
    assert.strictEqual(editor.file, validFile);
    assert.strictEqual(editor.contents.text, 'hello world\nline 2');
    console.log('✔ Editor.create with valid file');
  }

  // Test 2: Editor.create with missing file throws ENOENT
  {
    await assert.rejects(
      async () => {
        await Editor.create(mockReply, nonExistentFile);
      },
      (err) => err.code === 'ENOENT'
    );
    console.log('✔ Editor.create with missing file throws ENOENT');
  }

  // Test 3: Editor.create with long file throws "The file is too long"
  {
    await assert.rejects(
      async () => {
        await Editor.create(mockReply, longFile);
      },
      (err) => err.message === 'The file is too long'
    );
    console.log('✔ Editor.create with long file throws error');
  }

  // Test 4: Backwards compatibility - new Editor(reply, file)
  {
    const editor = new Editor(mockReply, validFile);
    assert.strictEqual(editor.contents.text, 'hello world\nline 2');
    console.log('✔ Backwards compatibility: new Editor(reply, file)');
  }

  // Test 5: new Editor(reply, file, contents)
  {
    const editor = new Editor(mockReply, validFile, 'preloaded content');
    assert.strictEqual(editor.contents.text, 'preloaded content');
    console.log('✔ new Editor(reply, file, contents)');
  }

  // Test 6: handleReply and handleEdit
  {
    const editor = await Editor.create(mockReply, validFile);
    await editor.message.idPromise;

    // Simulate reply message selecting text "hello"
    editor.handleReply({
      id: 200,
      text: 'hello',
      reply: { id: 100 },
    });

    await new Promise((r) => process.nextTick(r));

    assert.ok(editor.chunks[200], 'Chunk should be registered for message 200');

    // Simulate edit message replacing "hello" with "hi"
    const handled = editor.handleEdit({
      id: 200,
      text: 'hi',
    });

    assert.strictEqual(handled, true);
    assert.strictEqual(editor.contents.text, 'hi world\nline 2');

    // Wait for attemptSave nextTick + async writeFile to complete
    await new Promise((r) => setTimeout(r, 50));
    const savedContent = fs.readFileSync(validFile, 'utf-8');
    assert.strictEqual(savedContent, 'hi world\nline 2');

    console.log('✔ handleReply, handleEdit, and attemptSave');
  }

  // Test 7: detach stops handleEdit
  {
    const editor = await Editor.create(mockReply, validFile);
    editor.detach();
    const handled = editor.handleEdit({ id: 200, text: 'test' });
    assert.strictEqual(handled, false);
    console.log('✔ detach stops handleEdit');
  }

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('All tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
