# Technical Documentation

This document describes the core architecture and classes of the modernized shell-bot.

## Core Classes

### `Command` (`lib/command.js`)
Handles spawning a pseudo-terminal (PTY) and managing its lifecycle.
- **Methods**:
  - `sendInput(text, noTerminate)`: Sends text input to the PTY.
  - `sendSignal(signal, group)`: Sends a signal (e.g., SIGINT) to the process.
  - `resize(size)`: Resizes the terminal.
  - `redraw()`: Forces a terminal redraw.

### `Renderer` (`lib/renderer.js`)
Manages the mapping between terminal lines and Telegram messages.
- **Methods**:
  - `update()`: Processes terminal state changes and updates Telegram messages.
  - `render(message)`: Renders a message object to HTML.

### `Editor` (`lib/editor.js`)
Provides a simple text editor interface within Telegram.
- **Methods**:
  - `handleReply(msg)`: Handles user replies to the editor message to select text.
  - `handleEdit(msg)`: Handles user edits to replace selected text.

### `TermState` (`lib/terminal.js`)
Maintains the internal state of the terminal emulator.

## Integration

The core functionality is exported via `lib/index.js`, making it easy to integrate into other AI Agents or Telegram bots:

```javascript
const { Command } = require('./lib');
// Initialize and use Command class independently
```
