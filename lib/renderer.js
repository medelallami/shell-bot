/**
 * This class keeps a logical mapping of lines to messages.
 **/

const escapeHtml = require("escape-html");
const utils = require("./utils");

class Renderer {
  constructor(reply, state, options = {}) {
    this.reply = reply;
    this.state = state;
    this.options = options;

    this.offset = 0;
    this.messages = [];
    this.orphanLines = [];
    this.unfinishedLine = null;
    this.totalLines = 0;

    state.on("lineChanged", (y) => this._lineChanged(y));
    state.on("linesRemoving", (y, n) => this._linesRemoving(y, n));
    state.on("linesScrolling", (n) => this._linesScrolling(n));
    state.on("linesInserted", (y, n) => this._linesInserted(y, n));

    this.initTimers();
  }

  ensureLinesCreated(y) {
    if (this.totalLines < y) {
      this.orphanLines = this.orphanLines.concat(this.state.lines.slice(this.totalLines, y));
      this.totalLines = y;
      this.newLinesChanged = true;
    }
  }

  _lineChanged(y) {
    if (this.state.lines.length - y <= this.orphanLines.length)
      this.newLinesChanged = true;
  }

  _linesRemoving(y, n) {
    this.ensureLinesCreated(this.state.lines.length);

    y += this.offset;
    let idx = 0, lineIdx = 0;
    while (y) {
      const lines = (idx === this.messages.length) ? this.orphanLines : this.messages[idx].lines;
      if (lineIdx < lines.length) { lineIdx++; y--; }
      else { idx++; lineIdx = 0; }
    }

    this.totalLines -= n;
    while (n) {
      const lines = (idx === this.messages.length) ? this.orphanLines : this.messages[idx].lines;
      if (lines.splice(lineIdx, 1).length) n--;
      else { idx++; lineIdx = 0; }
    }

    if (idx >= this.messages.length) this.newLinesChanged = true;
  }

  _linesScrolling(n) {
    this.ensureLinesCreated(this.state.lines.length);

    if (n > 0) {
      this.offset += n;
      this.totalLines -= n;
      while (this.messages.length) {
        const message = this.messages[0];
        if (message.lines.length > this.offset) break;
        if (message.rendered !== message.ref.lastText) break;
        this.offset -= message.lines.length;
        this.messages.shift();
      }
    } else {
      n = -n;
      this._linesRemoving(this.state.lines.length - n, n);
    }
  }

  _linesInserted(y, n) {
    this.ensureLinesCreated(y);
    let pos = y;

    y += this.offset;
    let idx = 0, lineIdx = 0;
    while (true) {
      const lines = (idx === this.messages.length) ? this.orphanLines : this.messages[idx].lines;
      if (lineIdx < lines.length) {
        if (!y) break;
        lineIdx++; y--;
      } else { idx++; lineIdx = 0; }
    }

    this.totalLines += n;
    while (n) {
      const lines = (idx === this.messages.length) ? this.orphanLines : this.messages[idx].lines;
      lines.splice(lineIdx, 0, this.state.lines[pos]);
      n--, lineIdx++, pos++;
    }

    if (idx === this.messages.length) this.newLinesChanged = true;
  }

  update() {
    this.ensureLinesCreated(this.state.lines.length);

    let linesChanged = false;
    this.messages.forEach((message) => {
      const rendered = this.render(message);
      if (rendered !== message.rendered) {
        message.rendered = rendered;
        linesChanged = true;
      }
    });

    if (linesChanged) this.editedLineTimer.set();
    if (this.newLinesChanged) this.newLineTimer.reset();
    this.newLinesChanged = false;

    this.orphanLinesUpdated();
  }

  emitMessage(count, silent, disablePreview) {
    if (count < 0 || count > this.orphanLines.length) throw new Error("Should not happen.");

    if (count > this.options.maxLinesEmitted)
      count = this.options.maxLinesEmitted;
    const lines = this.orphanLines.splice(0, count);
    const message = { lines: lines };
    this.messages.push(message);
    message.rendered = this.render(message);
    const reply = this.reply.silent(silent).disablePreview(disablePreview);
    message.ref = new utils.EditedMessage(reply, message.rendered, "HTML");
    this.orphanLinesUpdated();
  }

  evaluateCode(str) {
    if (str.indexOf("   ") !== -1 || /[-_,:;<>()/\\~|'"=^]{4}/.exec(str))
      return true;
    return false;
  }

  render(message) {
    const cursorString = this.state.getMode("cursorBlink") ? this.options.cursorBlinkString : this.options.cursorString;
    let isWhitespace = true;
    const x = this.state.cursor[0];

    const html = message.lines.map((line, idx) => {
      const hasCursor = (this.state.getMode("cursor")) && (this.state.getLine() === line);
      if (!line.code && this.evaluateCode(line.str)) line.code = true;

      let content = line.str;
      if (hasCursor || line.str.trim().length) isWhitespace = false;
      if (idx === 0 && !content.substring(0, this.options.startFill.length).trim()) {
        if (!(hasCursor && x < this.options.startFill.length))
          content = this.options.startFill + content.substring(this.options.startFill.length);
      }

      if (hasCursor)
        content = escapeHtml(content.substring(0, x)) + cursorString + escapeHtml(content.substring(x));
      else
        content = escapeHtml(content);

      if (line.code) content = `<code>${content}</code>`;
      return content;
    }).join("\n");

    if (isWhitespace) return "<em>(empty)</em>";
    return html;
  }

  initTimers() {
    this.editedLineTimer = new utils.Timer(this.options.editTime).on("fire", () => this.flushEdited());
    this.newChunkTimer = new utils.Timer(this.options.chunkTime).on("fire", () => this.flushNew());
    this.newLineTimer = new utils.Timer(this.options.lineTime).on("fire", () => this.flushNew());
    this.unfinishedLineTimer = new utils.Timer(this.options.unfinishedTime).on("fire", () => this.flushUnfinished());

    this.newChunkTimer.on("active", () => {
      this.reply.action("typing");
    });
  }

  orphanLinesUpdated() {
    const newLines = this.orphanLines.length - 1;
    if (newLines >= this.options.maxLinesWait) {
      this.flushNew();
    } else if (newLines > 0) {
      this.newChunkTimer.set();
    } else {
      this.newChunkTimer.cancel();
      this.newLineTimer.cancel();
    }

    let unfinishedLine = this.orphanLines[this.orphanLines.length - 1];
    if (unfinishedLine && this.totalLines === this.state.rows && unfinishedLine.str.length === this.state.columns)
      unfinishedLine = null;

    if (this.unfinishedLine !== unfinishedLine) {
      this.unfinishedLine = unfinishedLine;
      this.unfinishedLineTimer.cancel();
    }

    if (unfinishedLine && unfinishedLine.str.length) this.unfinishedLineTimer.set();
    else this.unfinishedLineTimer.cancel();
  }

  flushEdited() {
    this.messages.forEach((message) => {
      if (message.rendered !== message.ref.lastText)
        message.ref.edit(message.rendered);
    });
    this.editedLineTimer.cancel();
  }

  flushNew() {
    this.flushEdited();
    let count = this.orphanLines.length;
    if (this.unfinishedLine) count--;
    if (count <= 0) return;
    this.emitMessage(count, !!this.options.silent, !!this.options.hidePreview);
  }

  flushUnfinished() {
    do this.flushNew(); while (this.orphanLines.length > 1);
    if (this.orphanLines.length < 1 || this.orphanLines[0].str.length === 0) return;
    this.emitMessage(1, !!this.options.unfinishedSilent, !!this.options.unfinishedHidePreview);
  }
}

module.exports = { Renderer };
