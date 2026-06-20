#!/usr/bin/env node
// Starts the bot, handles permissions and chat context,
// interprets commands and delegates the actual command
// running to a Command instance. When started, an owner
// ID should be given.

const path = require("path");
const fs = require("fs");
const botgram = require("botgram");
const escapeHtml = require("escape-html");
const utils = require("./lib/utils");
const { Command } = require("./lib/command");
const { Editor } = require("./lib/editor");

const CONFIG_FILE = path.join(__dirname, "config.json");
if (!fs.existsSync(CONFIG_FILE)) {
    console.error("Couldn't load the configuration file, starting the wizard.\n");
    require("./lib/wizard").configWizard({ configFile: CONFIG_FILE });
} else {
    const config = require(CONFIG_FILE);
    const bot = botgram(config.authToken, { agent: utils.createAgent() });
    const owner = config.owner;
    const tokens = {};
    const granted = {};
    const contexts = {};
    const defaultCwd = process.env.HOME || process.cwd();

    const fileUploads = {};

    bot.on("updateError", (err) => {
      console.error("Error when updating:", err);
    });

    bot.on("synced", () => {
      console.log("Bot ready.");
    });


    function rootHook(msg, reply, next) {
      if (msg.queued) return;

      let id = msg.chat.id;
      let allowed = id === owner || granted[id];

      // If this message contains a token, check it
      if (!allowed && msg.command === "start" && Object.hasOwnProperty.call(tokens, msg.args())) {
        const token = tokens[msg.args()];
        delete tokens[msg.args()];
        granted[id] = true;
        allowed = true;

        // Notify owner
        const contents = `${msg.user ? "User" : "Chat"} <em>${escapeHtml(msg.chat.name)}</em>${msg.chat.username ? " (@" + escapeHtml(msg.chat.username) + ")" : ""} can now use the bot. To revoke, use:`;
        reply.to(owner).html(contents).command("revoke", id);
      }

      // If chat is not allowed, but user is, use its context
      if (!allowed && (msg.from.id === owner || granted[msg.from.id])) {
        id = msg.from.id;
        allowed = true;
      }

      // Check that the chat is allowed
      if (!allowed) {
        if (msg.command === "start") reply.html("Not authorized to use this bot.");
        return;
      }

      if (!contexts[id]) contexts[id] = {
        id: id,
        shell: utils.shells[0],
        env: utils.getSanitizedEnv(),
        cwd: defaultCwd,
        size: {columns: 40, rows: 20},
        silent: true,
        interactive: false,
        linkPreviews: false,
      };

      msg.context = contexts[id];
      next();
    }
    bot.all(rootHook);
    bot.edited.all(rootHook);


    // Replies
    bot.message((msg, reply, next) => {
      if (msg.reply === undefined || msg.reply.from.id !== bot.get("id")) return next();
      if (msg.file)
        return handleDownload(msg, reply);
      if (msg.context.editor)
        return msg.context.editor.handleReply(msg);
      if (!msg.context.command)
        return reply.reply(msg).html("No command is running.");
      msg.context.command.handleReply(msg);
    });

    bot.edited.message((msg, reply, next) => {
      if (msg.context.editor)
        msg.context.editor.handleEdit(msg);
    });


    // Commands
    bot.command("run", (msg, reply, next) => {
      const command = msg.args();
      if (!command)
        return reply.html("Use /run &lt;command&gt; to execute something.");

      if (msg.context.command)
        return reply.reply(msg.context.command.initialMessage.id).html("A command is already running.");

      const cmd = new Command(reply, msg.context, command);
      msg.context.command = cmd;
      cmd.on("exit", () => {
        delete msg.context.command;
      });
    });

    bot.command("enter", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.sendInput(msg.args());
    });

    bot.command("type", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.sendInput(msg.args(), true);
    });

    bot.command("control", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      const keys = msg.args().split(/\s+/);
      keys.forEach((key) => {
        let char;
        if (key.length === 1) {
          char = key.toUpperCase().charCodeAt(0) - 64;
          if (char < 1 || char > 26) return;
        } else {
          char = utils.resolveControlKey(key);
        }
        if (char !== undefined) command.sendInput(String.fromCharCode(char), true);
      });
    });

    bot.command("meta", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.toggleMeta(true);
      reply.html("Next key will be sent with Alt.");
    });

    bot.command("keypad", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.toggleKeypad();
    });

    bot.command("redraw", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.redraw();
    });

    bot.command("end", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      command.sendEof();
    });

    bot.command("cancel", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      const signal = msg.args(1)[0] || "SIGINT";
      try {
        command.sendSignal(signal, true);
      } catch (e) {
        reply.html(`Couldn't send signal: ${e.message}`);
      }
    });

    bot.command("kill", (msg, reply, next) => {
      const command = msg.context.command;
      if (!command) return reply.html("No command is running.");
      const signal = msg.args(1)[0] || "SIGTERM";
      try {
        command.sendSignal(signal);
      } catch (e) {
        reply.html(`Couldn't send signal: ${e.message}`);
      }
    });

    bot.command("upload", (msg, reply, next) => {
      const file = msg.args();
      if (!file) return reply.html("Use /upload &lt;file&gt; to download a file from the server.");
      const fullPath = path.resolve(msg.context.cwd, file);
      reply.action("upload_document").document(fullPath).then((m) => {
        fileUploads[m.id] = fullPath;
      }, (err) => {
        reply.html(`Couldn't send file: ${err.message}`);
      });
    });

    bot.command("file", (msg, reply, next) => {
      const file = msg.args();
      if (!file) return reply.html("Use /file &lt;file&gt; to view or edit a file.");
      const fullPath = path.resolve(msg.context.cwd, file);
      try {
        msg.context.editor = new Editor(reply, fullPath);
      } catch (e) {
        return reply.html(`Couldn't open file: ${e.message}`);
      }
    });

    function handleDownload(msg, reply) {
      let file;
      if (Object.hasOwnProperty.call(fileUploads, msg.reply.id)) {
        file = fileUploads[msg.reply.id];
      } else if (msg.context.lastDirMessageId == msg.reply.id) {
        file = path.join(msg.context.cwd, msg.filename || utils.constructFilename(msg));
      } else {
        return;
      }

      try {
        const stream = fs.createWriteStream(file);
        bot.fileStream(msg.file, (err, ostream) => {
          if (err) throw err;
          reply.action("typing");
          ostream.pipe(stream);
          ostream.on("end", () => {
            reply.html(`File written: ${file}`);
          });
        });
      } catch (e) {
        return reply.html(`Couldn't write file: ${e.message}`);
      }
    }

    // Status
    bot.command("status", (msg, reply, next) => {
      let content = "";
      const context = msg.context;

      // Running command
      if (context.editor) content += `Editing file: ${escapeHtml(context.editor.file)}\n\n`;
      else if (!context.command) content += "No command running.\n\n";
      else content += `Command running, PID ${context.command.pty.pid}.\n\n`;

      // Chat settings
      content += `Shell: ${escapeHtml(context.shell)}\n`;
      content += `Size: ${context.size.columns}x${context.size.rows}\n`;
      content += `Directory: ${escapeHtml(context.cwd)}\n`;
      content += `Silent: ${context.silent ? "yes" : "no"}\n`;
      content += `Shell interactive: ${context.interactive ? "yes" : "no"}\n`;
      content += `Link previews: ${context.linkPreviews ? "yes" : "no"}\n`;
      let uid = process.getuid();
      const gid = process.getgid();
      if (uid !== gid) uid = `${uid}/${gid}`;
      content += `UID/GID: ${uid}\n`;

      // Granted chats (msg.chat.id is intentional)
      if (msg.chat.id === owner) {
        const grantedIds = Object.keys(granted);
        if (grantedIds.length) {
          content += "\nGranted chats:\n";
          content += grantedIds.map((id) => id.toString()).join("\n");
        } else {
          content += "\nNo chats granted. Use /grant or /token to allow another chat to use the bot.";
        }
      }

      if (context.command) reply.reply(context.command.initialMessage.id);
      reply.html(content);
    });

    // Settings: Shell
    bot.command("shell", (msg, reply, next) => {
      const arg = msg.args(1)[0];
      if (arg) {
        if (msg.context.command) {
          const command = msg.context.command;
          return reply.reply(command.initialMessage.id || msg).html("Can't change the shell while a command is running.");
        }
        try {
          const shell = utils.resolveShell(arg);
          msg.context.shell = shell;
          reply.html("Shell changed.");
        } catch (err) {
          reply.html("Couldn't change the shell.");
        }
      } else {
        const shell = msg.context.shell;
        const otherShells = utils.shells.slice(0);
        const idx = otherShells.indexOf(shell);
        if (idx !== -1) otherShells.splice(idx, 1);

        let content = `Current shell: ${escapeHtml(shell)}`;
        if (otherShells.length)
          content += `\n\nOther shells:\n${otherShells.map(escapeHtml).join("\n")}`;
        reply.html(content);
      }
    });

    // Settings: Working dir
    bot.command("cd", async (msg, reply, next) => {
      const arg = msg.args(1)[0];
      if (arg) {
        if (msg.context.command) {
          const command = msg.context.command;
          return reply.reply(command.initialMessage.id || msg).html("Can't change directory while a command is running.");
        }
        const newdir = path.resolve(msg.context.cwd, arg);
        try {
          await fs.promises.readdir(newdir);
          msg.context.cwd = newdir;
        } catch (err) {
          return reply.html("%s", err);
        }
      }

      reply.html("Now at: %s", msg.context.cwd).then((m) => {
        msg.context.lastDirMessageId = m.id;
      });
    });

    // Settings: Environment
    bot.command("env", (msg, reply, next) => {
      const env = msg.context.env;
      let key = msg.args();
      if (!key)
        return reply.reply(msg).html("Use %s to see the value of a variable, or %s to change it.", "/env <name>", "/env <name>=<value>");

      let idx = key.indexOf("=");
      if (idx === -1) idx = key.indexOf(" ");

      if (idx !== -1) {
        if (msg.context.command) {
          const command = msg.context.command;
          return reply.reply(command.initialMessage.id || msg).html("Can't change the environment while a command is running.");
        }

        const value = key.substring(idx + 1);
        key = key.substring(0, idx).trim().replace(/\s+/g, " ");
        if (value.length) env[key] = value;
        else delete env[key];
      }

      reply.reply(msg).text(printKey(key));

      function printKey(k) {
        if (Object.hasOwnProperty.call(env, k))
          return `${k}=${JSON.stringify(env[k])}`;
        return `${k} unset`;
      }
    });

    // Settings: Size
    bot.command("resize", (msg, reply, next) => {
      const arg = msg.args(1)[0] || "";
      const match = /(\d+)\s*((\sby\s)|x|\s|,|;)\s*(\d+)/i.exec(arg.trim());
      let columns, rows;
      if (match) {
        columns = parseInt(match[1]);
        rows = parseInt(match[4]);
      }
      if (!columns || !rows)
        return reply.text("Use /resize <columns> <rows> to resize the terminal.");

      msg.context.size = { columns, rows };
      if (msg.context.command) msg.context.command.resize(msg.context.size);
      reply.reply(msg).html("Terminal resized.");
    });

    // Settings: Silent
    bot.command("setsilent", (msg, reply, next) => {
      const arg = utils.resolveBoolean(msg.args());
      if (arg === null)
        return reply.html("Use /setsilent [yes|no] to control whether new output from the command will be sent silently.");

      msg.context.silent = arg;
      if (msg.context.command) msg.context.command.setSilent(arg);
      reply.html(`Output will ${arg ? "" : "not "}be sent silently.`);
    });

    // Settings: Interactive
    bot.command("setinteractive", (msg, reply, next) => {
      const arg = utils.resolveBoolean(msg.args());
      if (arg === null)
        return reply.html("Use /setinteractive [yes|no] to control whether shell is interactive. Enabling it will cause your aliases in i.e. .bashrc to be honored, but can cause bugs in some shells such as fish.");

      if (msg.context.command) {
        const command = msg.context.command;
        return reply.reply(command.initialMessage.id || msg).html("Can't change the interactive flag while a command is running.");
      }
      msg.context.interactive = arg;
      reply.html(`Commands will ${arg ? "" : "not "}be started with interactive shells.`);
    });

    // Settings: Link previews
    bot.command("setlinkpreviews", (msg, reply, next) => {
      const arg = utils.resolveBoolean(msg.args());
      if (arg === null)
        return reply.html("Use /setlinkpreviews [yes|no] to control whether links in the output get expanded.");

      msg.context.linkPreviews = arg;
      if (msg.context.command) msg.context.command.setLinkPreviews(arg);
      reply.html(`Links in the output will ${arg ? "" : "not "}be expanded.`);
    });

    // Settings: Other chat access
    bot.command("grant", "revoke", (msg, reply, next) => {
      if (msg.context.id !== owner) return;
      const arg = msg.args(1)[0];
      const id = parseInt(arg);
      if (!arg || isNaN(id))
        return reply.html("Use %s or %s to control whether the chat with that ID can use this bot.", "/grant <id>", "/revoke <id>");
      reply.reply(msg);
      if (msg.command === "grant") {
        granted[id] = true;
        reply.html(`Chat ${id} can now use this bot. Use /revoke to undo.`);
      } else {
        if (contexts[id] && contexts[id].command)
          return reply.html("Couldn't revoke specified chat because a command is running.");
        delete granted[id];
        delete contexts[id];
        reply.html(`Chat ${id} has been revoked successfully.`);
      }
    });
    bot.command("token", (msg, reply, next) => {
      if (msg.context.id !== owner) return;
      const token = utils.generateToken();
      tokens[token] = true;
      reply.disablePreview().html(`One-time access token generated. The following link can be used to get access to the bot:\n${bot.link(token)}\nOr by forwarding me this:`);
      reply.command(true, "start", token);
    });

    // Welcome message, help
    bot.command("start", (msg, reply, next) => {
      if (msg.args() && msg.context.id === owner && Object.hasOwnProperty.call(tokens, msg.args())) {
        reply.html("You were already authenticated; the token has been revoked.");
      } else {
        reply.html("Welcome! Use /run to execute commands, and reply to my messages to send input. /help for more info.");
      }
    });

    bot.command("help", (msg, reply, next) => {
      reply.html(
        "Use /run &lt;command&gt; and I'll execute it for you. While it's running, you can:\n" +
        "\n" +
        "‣ Reply to one of my messages to send input to the command, or use /enter.\n" +
        "‣ Use /end to send an EOF (Ctrl+D) to the command.\n" +
        "‣ Use /cancel to send SIGINT (Ctrl+C) to the process group, or the signal you choose.\n" +
        "‣ Use /kill to send SIGTERM to the root process, or the signal you choose.\n" +
        "‣ For graphical applications, use /redraw to force a repaint of the screen.\n" +
        "‣ Use /type or /control to press keys, /meta to send the next key with Alt, or /keypad to show a keyboard for special keys.\n" +
        "\n" +
        "You can see the current status and settings for this chat with /status. Use /env to " +
        "manipulate the environment, /cd to change the current directory, /shell to see or " +
        "change the shell used to run commands and /resize to change the size of the terminal.\n" +
        "\n" +
        "By default, output messages are sent silently (without sound) and links are not expanded. " +
        "This can be changed through /setsilent and /setlinkpreviews. Note: links are " +
        "never expanded in status lines.\n" +
        "\n" +
        "<em>Additional features</em>\n" +
        "\n" +
        "Use /upload &lt;file&gt; and I'll send that file to you. If you reply to that " +
        "message by uploading me a file, I'll overwrite it with yours.\n" +
        "\n" +
        "You can also use /file &lt;file&gt; to display the contents of file as a text " +
        "message. This also allows you to edit the file, but you have to know how..."
      );
    });

    bot.command((msg, reply, next) => {
      reply.reply(msg).text("Invalid command.");
    });
}
