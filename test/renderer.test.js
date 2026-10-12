const assert = require("assert");
const { Renderer } = require("../lib/renderer");
const { TermState } = require("../lib/terminal");

function createMockReply() {
  const reply = {
    silent: () => reply,
    disablePreview: () => reply,
    action: () => {}
  };
  return reply;
}

function setupRenderer(options = {}) {
  const state = new TermState();
  const reply = createMockReply();
  const renderer = new Renderer(reply, state, Object.assign({
    cursorString: "[CURSOR]",
    cursorBlinkString: "[BLINK_CURSOR]",
    startFill: "· "
  }, options));
  return { state, reply, renderer };
}

// Test 1: Empty or whitespace-only messages return (empty)
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", false);

  const msg1 = { lines: [] };
  assert.strictEqual(renderer.render(msg1), "<em>(empty)</em>");

  const msg2 = { lines: [{ str: "  ", attr: null }] };
  assert.strictEqual(renderer.render(msg2), "<em>(empty)</em>");

  console.log("✓ Empty/whitespace message test passed");
}

// Test 2: Normal line rendering and HTML escaping
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", false);

  const line1 = { str: "Hello <world> & 'friends'", attr: null };
  const msg = { lines: [line1] };
  const rendered = renderer.render(msg);
  assert.strictEqual(rendered, "Hello &lt;world&gt; &amp; &#39;friends&#39;");

  console.log("✓ HTML escaping test passed");
}

// Test 3: Cursor insertion and cursorBlink option
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", true);
  state.setMode("cursorBlink", true);
  const line = state.getLine(0);
  line.str = "Hello World";
  state.setCursor(5, 0);

  const msg = { lines: [line] };
  let rendered = renderer.render(msg);
  assert.strictEqual(rendered, "Hello[BLINK_CURSOR] World");

  // Disable cursorBlink
  state.setMode("cursorBlink", false);
  rendered = renderer.render(msg);
  assert.strictEqual(rendered, "Hello[CURSOR] World");

  console.log("✓ Cursor insertion and blink mode test passed");
}

// Test 4: startFill handling on first line (length 2 startFill "· ")
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", false);

  const line1 = { str: "  abc", attr: null };
  const line2 = { str: "  def", attr: null };
  const msg = { lines: [line1, line2] };

  const rendered = renderer.render(msg);
  assert.strictEqual(rendered, "· abc\n  def");

  console.log("✓ startFill padding test passed");
}

// Test 5: startFill when cursor is within startFill area
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", true);
  const line = state.getLine(0);
  line.str = "  abc";
  state.setCursor(1, 0); // x = 1 < startFill.length (2)

  const msg = { lines: [line] };
  const rendered = renderer.render(msg);
  // startFill should NOT be prepended because cursor x < startFill.length
  assert.strictEqual(rendered, " [BLINK_CURSOR] abc");

  console.log("✓ startFill with cursor test passed");
}

// Test 6: Code detection (evaluateCode) and wrapping in <code>
{
  const { state, renderer } = setupRenderer();
  state.setMode("cursor", false);

  const line1 = { str: "var x = 1;   // spaces", attr: null }; // contains 3 spaces
  const msg = { lines: [line1] };

  const rendered = renderer.render(msg);
  assert.strictEqual(rendered, "<code>var x = 1;   // spaces</code>");
  assert.strictEqual(line1.code, true);

  console.log("✓ Code evaluation test passed");
}

console.log("All tests passed successfully!");
