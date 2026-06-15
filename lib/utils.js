/**
 * Miscellaneous utilities.
 **/

const fs = require("fs");
const util = require("util");
const mime = require("mime");
const crypto = require("crypto");
const url = require("url");
const EventEmitter = require("events");

/** TIMER **/

class Timer extends EventEmitter {
  constructor(delay) {
    super();
    this.delay = delay;
  }

  /* Starts the timer, does nothing if started already. */
  set() {
    if (this.timeout) return;
    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.emit("fire");
    }, this.delay);
    this.emit("active");
  }

  /* Cancels the timer if set. */
  cancel() {
    if (!this.timeout) return;
    clearTimeout(this.timeout);
    delete this.timeout;
  }

  /* Starts the timer, cancelling first if set. */
  reset() {
    this.cancel();
    this.set();
  }
}

/** EDITED MESSAGE **/

class EditedMessage extends EventEmitter {
  constructor(reply, text, mode) {
    super();
    this.reply = reply;
    this.mode = mode;

    this.lastText = text;
    this.markup = reply.parameters["reply_markup"];
    this.disablePreview = reply.parameters["disable_web_page_preview"];
    this.text = text;
    this.callbacks = [];
    this.pendingText = null;
    this.pendingCallbacks = [];

    this.idPromise = new Promise((resolve, reject) => {
      reply.text(this.text, this.mode).then((err, msg) => {
        if (err) {
          reject(err);
        } else {
          this.id = msg.id;
          resolve(msg.id);
        }
        this._whenEdited(err, msg);
      });
    });
  }

  refresh(callback) {
    if (callback) this.pendingCallbacks.push(callback);
    this.pendingText = this.lastText;
    if (this.callbacks === undefined) this._flushEdit();
  }

  edit(text, callback) {
    this.lastText = text;
    const idle = this.callbacks === undefined;
    if (callback) this.pendingCallbacks.push(callback);

    if (text === this.text) {
      this.callbacks = (this.callbacks || []).concat(this.pendingCallbacks);
      this.pendingText = null;
      this.pendingCallbacks = [];
      if (idle) this._whenEdited();
    } else {
      this.pendingText = text;
      if (idle) this._flushEdit();
    }
  }

  _flushEdit() {
    this.text = this.pendingText;
    this.callbacks = this.pendingCallbacks;
    this.pendingText = null;
    this.pendingCallbacks = [];
    this.reply.parameters["reply_markup"] = this.markup;
    this.reply.parameters["disable_web_page_preview"] = this.disablePreview;
    this.reply.editText(this.id, this.text, this.mode).then(this._whenEdited.bind(this));
  }

  _whenEdited(err, msg) {
    if (err) this.emit(this.id === undefined ? "error" : "editError", err);
    if (this.id === undefined && msg) this.id = msg.id;
    const callbacks = this.callbacks;
    delete this.callbacks;
    if (callbacks) {
      callbacks.forEach((callback) => { callback(); });
    }
    if (this.pendingText !== null) this._flushEdit();
  }
}

/** SANITIZED ENV **/

function getSanitizedEnv() {
  const env = { ...process.env };

  // Make sure we didn't start our server from inside tmux.
  delete env.TMUX;
  delete env.TMUX_PANE;

  // Make sure we didn't start our server from inside screen.
  delete env.STY;
  delete env.WINDOW;

  // Delete some variables that might confuse our terminal.
  delete env.WINDOWID;
  delete env.TERMCAP;
  delete env.COLUMNS;
  delete env.LINES;

  // Set $TERM to screen.
  env.TERM = "screen";

  return env;
}

/** RESOLVE SIGNAL **/

const SIGNALS = "HUP INT QUIT ILL TRAP ABRT BUS FPE KILL USR1 SEGV USR2 PIPE ALRM TERM STKFLT CHLD CONT STOP TSTP TTIN TTOU URG XCPU XFSZ VTALRM PROF WINCH POLL PWR SYS".split(" ");

function formatSignal(signal) {
  signal--;
  if (signal in SIGNALS) return "SIG" + SIGNALS[signal];
  return "unknown signal " + signal;
}

/** SHELLS **/

function getShells() {
  const lines = fs.readFileSync("/etc/shells", "utf-8").split("\n");
  const shellsList = lines.map((line) => line.split("#")[0])
    .filter((line) => line.trim().length);

  const shell = process.env.SHELL;
  if (shell) {
    const idx = shellsList.indexOf(shell);
    if (idx !== -1) shellsList.splice(idx, 1);
    shellsList.unshift(shell);
  }
  return shellsList;
}

const shells = getShells();

function resolveShell(shell) {
  return shell;
}

function generateToken() {
  return crypto.randomBytes(12).toString("hex");
}

const BOOLEANS = {
  "yes": true, "no": false,
  "y": true, "n": false,
  "on": true, "off": false,
  "enable": true, "disable": false,
  "enabled": true, "disabled": false,
  "active": true, "inactive": false,
  "true": true, "false": false,
};

function resolveBoolean(arg) {
  if (!arg) return null;
  const normalized = arg.trim().toLowerCase();
  if (!Object.hasOwnProperty.call(BOOLEANS, normalized)) return null;
  return BOOLEANS[normalized];
}

function constructFilename(msg) {
  return "upload." + mime.extension(msg.file.mime);
}

function createAgent() {
  const proxyStr = process.env["https_proxy"] || process.env["all_proxy"];
  if (!proxyStr) return;

  let proxy;
  try {
    proxy = url.parse(proxyStr);
  } catch (e) {
    console.error("Error parsing proxy URL:", e, "Ignoring proxy.");
    return;
  }

  if ([ "socks:", "socks4:", "socks4a:", "socks5:", "socks5h:" ].indexOf(proxy.protocol) !== -1) {
    try {
      const SocksProxyAgent = require('socks-proxy-agent');
      return new SocksProxyAgent(proxyStr);
    } catch (e) {
      console.error("Error loading SOCKS proxy support, verify socks-proxy-agent is correctly installed. Ignoring proxy.");
      return;
    }
  }
  if ([ "http:", "https:" ].indexOf(proxy.protocol) !== -1) {
    try {
      const HttpsProxyAgent = require('https-proxy-agent');
      return new HttpsProxyAgent(proxyStr);
    } catch (e) {
      console.error("Error loading HTTPS proxy support, verify https-proxy-agent is correctly installed. Ignoring proxy.");
      return;
    }
  }

  console.error("Unknown proxy protocol:", util.inspect(proxy.protocol), "Ignoring proxy.");
}

module.exports = {
  Timer,
  EditedMessage,
  getSanitizedEnv,
  formatSignal,
  shells,
  resolveShell,
  generateToken,
  resolveBoolean,
  constructFilename,
  createAgent
};
