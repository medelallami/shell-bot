/**
 * Attaches to a chat, spawns a pty, attaches it to the terminal emulator
 * and the renderer and manages them. Handles incoming commands & input,
 * and posts complimentary messages such as command itself and output code.
 **/

const EventEmitter = require("events");
const escapeHtml = require("escape-html");
const pty = require("node-pty");
const termios = require("node-termios");
const utils = require("./utils");
const terminal = require("./terminal");
const renderer = require("./renderer");
const tsyms = termios.native.ALL_SYMBOLS;

class Command extends EventEmitter {
  constructor(reply, context, command) {
    super();
    const toUser = reply.destination > 0;

    this.startTime = Date.now();
    this.reply = reply;
    this.command = command;

    console.log(`[Command] Spawning pty: ${context.shell} -c "${command}"`);

    this.pty = pty.spawn(context.shell, [context.interactive ? "-ic" : "-c", command], {
      cols: context.size.columns,
      rows: context.size.rows,
      cwd: context.cwd,
      env: context.env,
    });

    console.log(`[Command] Pty spawned with PID ${this.pty.pid}`);

    this.termios = new termios.Termios(this.pty._fd);
    this.termios.c_lflag &= ~(tsyms.ISIG | tsyms.IEXTEN);
    this.termios.c_lflag &= ~tsyms.ECHO; // disable ECHO
    this.termios.c_lflag |= tsyms.ICANON | tsyms.ECHONL; // we need it for /end, it needs to be active beforehand
    this.termios.c_iflag = (this.termios.c_iflag & ~(tsyms.INLCR | tsyms.IGNCR)) | tsyms.ICRNL; // CR to NL
    this.termios.writeTo(this.pty._fd);

    this.terminal = terminal.createTerminal({
      columns: context.size.columns,
      rows: context.size.rows,
    });
    this.state = this.terminal.state;
    this.renderer = new renderer.Renderer(reply, this.state, {
      cursorString: "\uD83D\uDD38",
      cursorBlinkString: "\uD83D\uDD38",
      hidePreview: !context.linkPreviews,
      unfinishedHidePreview: true,
      silent: context.silent,
      unfinishedSilent: true,
      maxLinesWait: toUser ? 20 : 30,
      maxLinesEmitted: 30,
      lineTime: toUser ? 400 : 1200,
      chunkTime: toUser ? 3000 : 6000,
      editTime: toUser ? 300 : 2500,
      unfinishedTime: toUser ? 1000 : 2000,
      startFill: "·  ",
    });
    this._initKeypad();

    // Post initial message
    this.initialMessage = new utils.EditedMessage(reply, this._renderInitial(), "HTML");

    // Process command output
    this.pty.on("data", this._ptyData.bind(this));

    // Handle command exit
    this.pty.on("exit", this._exit.bind(this));
  }

  _renderInitial() {
    let content = "";
    const title = this.state.metas.title;
    const badges = this.badges || "";
    if (title) {
      content += `<strong>${escapeHtml(title)}</strong>\n`;
      content += `${badges}<strong>$</strong> ${escapeHtml(this.command)}`;
    } else {
      content += `${badges}<strong>$ ${escapeHtml(this.command)}</strong>`;
    }
    return content;
  }

  _ptyData(chunk) {
    if ((typeof chunk !== "string") && !(chunk instanceof String))
      throw new Error("Expected a String, you liar.");
    this.interacted = true;
    this.terminal.write(chunk, "utf-8", this._update.bind(this));
  }

  _update() {
    this.initialMessage.edit(this._renderInitial());
    this.renderer.update();
  }

  resize(size) {
    this.interacted = true;
    this.metaActive = false;
    this.state.resize(size);
    this._update();
    this.pty.resize(size.columns, size.rows);
  }

  redraw() {
    this.interacted = true;
    this.metaActive = false;
    this.pty.redraw();
  }

  sendSignal(signal, group) {
    this.interacted = true;
    this.metaActive = false;
    let pid = this.pty.pid;
    console.log(`[Command] Sending signal ${signal} to PID ${pid} (group: ${!!group})`);
    if (group) pid = -pid;
    process.kill(pid, signal);
  }

  sendEof() {
    this.interacted = true;
    this.metaActive = false;
    this.termios.loadFrom(this.pty._fd);
    this.pty.write(Buffer.from([ this.termios.c_cc[tsyms.VEOF] ]));
  }

  _exit(code, signal) {
    console.log(`[Command] Process exited with code ${code}, signal ${signal}`);
    this._update();
    this.renderer.flushUnfinished();

    if ((Date.now() - this.startTime) < 2000 && !signal && code === 0 && !this.interacted) {
      this.badges = "\u2705 ";
      this.initialMessage.edit(this._renderInitial());
    } else {
      if (signal)
        this.reply.html(`\uD83D\uDC80 <strong>Killed</strong> by ${utils.formatSignal(signal)}.`);
      else if (code === 0)
        this.reply.html("\u2705 <strong>Exited</strong> correctly.");
      else
        this.reply.html(`\u26D4 <strong>Exited</strong> with ${code}.`);
    }

    this._removeKeypad();
    this.emit("exit");
  }

  handleReply(msg) {
    if (msg.type !== "text") return false;
    this.sendInput(msg.text);
  }

  sendInput(text, noTerminate) {
    this.interacted = true;
    text = text.replace(/\n/g, "\r");
    if (!noTerminate) text += "\r";
    if (this.metaActive) text = "\x1b" + text;
    this.pty.write(text);
    this.metaActive = false;
  }

  toggleMeta(metaActive) {
    if (metaActive === undefined) metaActive = !this.metaActive;
    this.metaActive = metaActive;
  }

  setSilent(silent) {
    this.renderer.options.silent = silent;
  }

  setLinkPreviews(linkPreviews) {
    this.renderer.options.hidePreview = !linkPreviews;
  }

  _initKeypad() {
    this.keypadToken = utils.generateToken();

    const keys = {
      esc:       { label: "ESC", content: "\x1b" },
      tab:       { label: "⇥", content: "\t" },
      enter:     { label: "⏎", content: "\r" },
      backspace: { label: "↤", content: "\x7F" },
      space:     { label: " ", content: " " },

      up:        { label: "↑", content: "\x1b[A", appKeypadContent: "\x1bOA" },
      down:      { label: "↓", content: "\x1b[B", appKeypadContent: "\x1bOB" },
      right:     { label: "→", content: "\x1b[C", appKeypadContent: "\x1bOC" },
      left:      { label: "←", content: "\x1b[D", appKeypadContent: "\x1bOD" },

      insert:    { label: "INS", content: "\x1b[2~" },
      del:       { label: "DEL", content: "\x1b[3~" },
      home:      { label: "⇱", content: "\x1bOH" },
      end:       { label: "⇲", content: "\x1bOF" },

      prevPage:  { label: "⇈", content: "\x1b[5~" },
      nextPage:  { label: "⇊", content: "\x1b[6~" },
    };

    const keypad = [
      [ "esc",  "up",    "backspace", "del"  ],
      [ "left", "space", "right",     "home" ],
      [ "tab",  "down",  "enter",     "end"  ],
    ];

    this.buttons = [];
    this.inlineKeyboard = keypad.map((row) => {
      return row.map((name) => {
        const button = keys[name];
        const data = JSON.stringify({ token: this.keypadToken, button: this.buttons.length });
        const keyboardButton = { text: button.label, callback_data: data };
        this.buttons.push(button);
        return keyboardButton;
      });
    });

    this.reply.bot.callback((query, next) => {
      try {
        const data = JSON.parse(query.data);
        if (data.token !== this.keypadToken) return next();
        this._keypadPressed(data.button, query);
      } catch (e) { return next(); }
    });
  }

  toggleKeypad() {
    if (this.keypadMessage) {
      this.keypadMessage.markup = null;
      this.keypadMessage.refresh();
      this.keypadMessage = null;
      return;
    }

    const messages = this.renderer.messages;
    const msg = messages[messages.length - 1].ref;
    msg.markup = {inline_keyboard: this.inlineKeyboard};
    msg.refresh();
    this.keypadMessage = msg;
  }

  _keypadPressed(id, query) {
    this.interacted = true;
    if (typeof id !== "number" || !(id in this.buttons)) return;
    const button = this.buttons[id];
    let content = button.content;
    if (button.appKeypadContent !== undefined && this.state.getMode("appKeypad"))
      content = button.appKeypadContent;
    this.pty.write(content);
    query.answer();
  }

  _removeKeypad() {
    if (this.keypadMessage) this.toggleKeypad();
  }
}

module.exports = { Command };
