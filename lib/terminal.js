/**
 * Terminal emulator.
 **/

const EventEmitter = require("events");
const Terminal = require("terminal.js");

const GRAPHICS = {
  "`": "\u25C6", "a": "\u2592", "b": "\u2409", "c": "\u240C", "d": "\u240D", "e": "\u240A", "f": "\u00B0", "g": "\u00B1", "h": "\u2424", "i": "\u240B", "j": "\u2518", "k": "\u2510", "l": "\u250C", "m": "\u2514", "n": "\u253C", "o": "\u23BA", "p": "\u23BB", "q": "\u2500", "r": "\u23BC", "s": "\u23BD", "t": "\u251C", "u": "\u2524", "v": "\u2534", "w": "\u252C", "x": "\u2502", "y": "\u2264", "z": "\u2265", "{": "\u03C0", "|": "\u2260", "}": "\u00A3", "~": "\u00B7"
};

class TermState extends EventEmitter {
  constructor(options = {}) {
    super();
    this.columns = options.columns || 80;
    this.rows = options.rows || 24;
    this.lines = [];
    this.cursor = [0, 0];
    this.savedCursor = [0, 0];
    this.modes = { graphic: false, insert: false, cursor: true, cursorBlink: true, appKeypad: false };
    this.metas = { title: "" };
    this._tabs = [];
    this._charsets = [];
    this._mappedCharset = 0;
    this._mappedCharsetNext = 0;
  }

  setMode(mode, value) {
    this.modes[mode] = value;
    this.emit("mode", mode, value);
  }

  getMode(mode) {
    return this.modes[mode];
  }

  setMeta(meta, value) {
    this.metas[meta] = value;
    this.emit("meta", meta, value);
  }

  mapCharset(target) {
    this._mappedCharsetNext = target;
  }

  setCharset(charset, target) {
    if (target === undefined) target = this._mappedCharset;
    this._charsets[target] = charset;
    this.modes.graphic = this._charsets[this._mappedCharset] === "graphics";
  }

  setCursor(x, y) {
    if (typeof x === 'number') this.cursor[0] = x;
    if (typeof y === 'number') this.cursor[1] = y;
    this.cursor = this.getCursor();
    this.emit("cursor");
    return this;
  }

  getCursor() {
    let x = this.cursor[0], y = this.cursor[1];
    if (x >= this.columns) x = this.columns - 1;
    else if (x < 0) x = 0;
    if (y >= this.rows) y = this.rows - 1;
    else if (y < 0) y = 0;
    return [x, y];
  }

  getLine(y) {
    if (typeof y !== "number") y = this.getCursor()[1];
    if (y < 0) throw new Error("Invalid position to write to");
    while (!(y < this.lines.length))
      this.lines.push({ str: "", attr: null });
    return this.lines[y];
  }

  setLine(y, line) {
    if (typeof y !== "number") { line = y; y = this.getCursor()[1]; }
    this.getLine(y);
    this.lines[y] = line;
    return this;
  }

  _writeChunk(position, chunk, insert) {
    const x = position[0], line = this.getLine(position[1]);
    if (x < 0) throw new Error("Invalid position to write to");
    while (line.str.length < x) line.str += " ";
    line.str = line.str.substring(0, x) + chunk + line.str.substring(x + (insert ? 0 : chunk.length));
    this.emit("lineChanged", position[1]);
    return this;
  }

  removeChar(n) {
    const x = this.cursor[0], line = this.getLine();
    if (x < 0) throw new Error("Invalid position to delete from");
    while (line.str.length < x) line.str += " ";
    line.str = line.str.substring(0, x) + line.str.substring(x + n);
    this.emit("lineChanged", this.cursor[1]);
    return this;
  }

  eraseInLine(n) {
    const x = this.cursor[0], line = this.getLine();
    switch (n || 0) {
      case "after": case 0:
        line.str = line.str.substring(0, x);
        break;
      case "before": case 1:
        let str = "";
        while (str.length < x) str += " ";
        line.str = str + line.str.substring(x);
        break;
      case "all": case 2:
        line.str = "";
        break;
    }
    this.emit("lineChanged", this.cursor[1]);
    return this;
  }

  eraseInDisplay(n) {
    switch (n || 0) {
      case "below": case "after": case 0:
        this.eraseInLine(n);
        this.removeLine(this.lines.length - (this.cursor[1]+1), this.cursor[1]+1);
        break;
      case "above": case "before": case 1:
        for (let y = 0; y < this.cursor[1]; y++) {
          this.lines[y].str = "";
          this.emit("lineChanged", y);
        }
        this.eraseInLine(n);
        break;
      case "all": case 2:
        this.removeLine(this.lines.length, 0);
        break;
    }
    return this;
  }

  removeLine(n, y) {
    if (typeof y !== "number") y = this.cursor[1];
    if (n <= 0) return this;
    if (y + n > this.lines.length) n = this.lines.length - y;
    if (n <= 0) return this;
    this.emit("linesRemoving", y, n);
    this.lines.splice(y, n);
    return this;
  }

  insertLine(n, y) {
    if (typeof y !== "number") y = this.cursor[1];
    if (n <= 0) return this;
    if (y + n > this.rows) n = this.rows - y;
    if (n <= 0) return this;
    this.getLine(y);
    this.removeLine((this.lines.length + n) - this.rows, this.rows - n);
    for (let i = 0; i < n; i++)
      this.lines.splice(y, 0, { str: "", attr: null });
    this.emit("linesInserted", y, n);
    return this;
  }

  scroll(n) {
    if (n > 0) {
      if (n > this.lines.length) n = this.lines.length;
      if (n > 0) this.emit("linesScrolling", n);
      this.lines = this.lines.slice(n);
    } else if (n < 0) {
      n = -n;
      if (n > this.rows) n = this.rows;
      const extraLines = (this.lines.length + n) - this.rows;
      if (extraLines > 0) this.emit("linesScrolling", -extraLines);
      this.lines = this.lines.slice(0, this.rows - n);
      this.insertLine(n, 0);
    }
    return this;
  }

  _graphConvert(content) {
    if(this._mappedCharset === this._mappedCharsetNext && !this.modes.graphic) {
      return content;
    }
    let result = "";
    for(let i = 0; i < content.length; i++) {
      result += (this.modes.graphic && content[i] in GRAPHICS) ? GRAPHICS[content[i]] : content[i];
      this._mappedCharset = this._mappedCharsetNext;
      this.modes.graphic = this._charsets[this._mappedCharset] === "graphics";
    }
    return result;
  }

  write(chunk) {
    chunk.split("\n").forEach((line, i) => {
      if (i > 0) {
        if (this.cursor[1] + 1 >= this.rows) this.scroll(1);
        this.mvCursor(0, 1);
        this.getLine();
      }
      if (!line.length) return;
      if (this.getMode("graphic")) this.getLine().code = true;
      line = this._graphConvert(line);
      this._writeChunk(this.cursor, line, this.getMode("insert"));
      this.cursor[0] += line.length;
    });
    this.emit("cursor");
    return this;
  }

  resize(size) {
    if (this.lines.length > size.rows) this.scroll(this.lines.length - size.rows);
    this.rows = size.rows;
    this.columns = size.columns;
    this.setCursor();
    this.emit("resize", size);
    return this;
  }

  mvCursor(x, y) {
    const cursor = this.getCursor();
    return this.setCursor(cursor[0] + x, cursor[1] + y);
  }

  toString() {
    return this.lines.map((line) => line.str).join("\n");
  }

  prevLine() {
    if (this.cursor[1] > 0) this.mvCursor(0, -1);
    else this.scroll(-1);
    return this;
  }

  nextLine() {
    if (this.cursor[1] < this.rows - 1) this.mvCursor(0, +1);
    else this.scroll(+1);
    return this;
  }

  saveCursor() {
    this.savedCursor = this.getCursor();
    return this;
  }

  restoreCursor() {
    this.cursor = this.savedCursor;
    return this.setCursor();
  }

  insertBlank(n) {
    let str = "";
    while (str.length < n) str += " ";
    return this._writeChunk(this.cursor, str, true);
  }

  eraseCharacters(n) {
    let str = "";
    while (str.length < n) str += " ";
    return this._writeChunk(this.cursor, str, false);
  }

  setScrollRegion() { return this; }

  switchBuffer(alt) {
    if (this.alt !== alt) {
      this.scroll(this.lines.length);
      this.alt = alt;
    }
    return this;
  }

  getBufferRowCount() { return this.lines.length; }

  mvTab(n) {
    let x = this.getCursor()[0];
    const tabMax = this._tabs[this._tabs.length - 1] || 0;
    const positive = n > 0;
    n = Math.abs(n);
    while(n !== 0 && x > 0 && x < this.columns-1) {
      x += positive ? 1 : -1;
      if(this._tabs.indexOf(x) !== -1 || (x > tabMax && x % 8 === 0)) n--;
    }
    this.setCursor(x);
  }

  setTab(pos) {
    if(pos === undefined) pos = this.getCursor()[0];
    if (this._tabs.indexOf(pos) === -1) {
      this._tabs.push(pos);
      this._tabs.sort();
    }
  }

  removeTab(pos) {
    const idx = this._tabs.indexOf(pos);
    if (idx !== -1) this._tabs.splice(idx, 1);
  }

  tabClear(n) {
    switch(n || "current") {
      case "current": case 0:
        for(let i = this._tabs.length - 1; i >= 0; i--) {
          if(this._tabs[i] < this.getCursor()[0]) {
            this._tabs.splice(i, 1);
            break;
          }
        }
        break;
      case "all": case 3:
        this._tabs = [];
        break;
    }
  }
}

function createTerminal(options) {
  const state = new TermState(options);
  const term = new Terminal({});
  term.state = state;
  return term;
}

module.exports = { TermState, createTerminal };
