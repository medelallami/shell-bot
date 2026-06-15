# User Wiki

Welcome to the shell-bot wiki! This guide covers everything from basic usage to advanced features.

## Getting Started

1.  **Installation**: Run `npm install`.
2.  **Configuration**: Start the bot with `node server.js`. If no `config.json` exists, the interactive wizard will guide you through setting up your bot token and owner ID.

## Commands

- `/run <command>`: Execute a shell command.
- `/status`: View current terminal status, shell, and directory.
- `/cd <dir>`: Change working directory.
- `/upload <file>`: Download a file from the server.
- `/file <file>`: Open the text editor for a file.

## Advanced Usage

### Keypad
Use `/keypad` while a command is running to show a virtual keyboard for special keys like arrows, Tab, and Enter.

### Environment Variables
Use `/env NAME=VALUE` to set environment variables for subsequent commands.

### Permissions
The owner can use `/grant <id>` or `/token` to allow other users or groups to use the bot.

## Development

The bot has been modernized to ES6+ standards, featuring:
- `class` syntax for all core modules.
- `async/await` for asynchronous operations.
- `const/let` variable declarations.
- Template literals for cleaner string manipulation.
