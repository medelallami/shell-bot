# shell-bot

A fully functional terminal emulator and shellrunner for Telegram. Execute commands, interact with live output, edit files, and more—all from your favorite chat app.

## Features

- **Real Terminal Experience**: Interprets escape sequences and updates messages in real-time.
- **Interactive**: Send input to running commands by replying to messages.
- **File Management**: Upload/download files and a built-in simple text editor.
- **Modern & Modular**: Refactored to ES6+ (Classes, Async/Await) and can be used as a library for other AI agents and bots.
- **Proxy Support**: Works with HTTP/HTTPS/SOCKS proxies.

## Quick Start

### Installation

Ensure you have dependencies installed.

```bash
git clone https://github.com/botgram/shell-bot.git && cd shell-bot
npm install
```

### Start the Bot

Launch the bot with: `npm start`

The first run will launch an interactive wizard to create your config.

## Developer Guide

Shell-bot's core is now modular and can be integrated into larger AI agent projects.

```javascript
const { Command, TermState } = require('./lib');

// Use the core terminal logic in your own bot or agent
const cmd = new Command(customReplyObject, context, "ls -la");
```

See DOCS.md for technical details and WIKI.md for a comprehensive user guide.

## Authorization

By default, only the owner can use the bot. Use /token to grant access to other chats or groups.

## License

MIT
