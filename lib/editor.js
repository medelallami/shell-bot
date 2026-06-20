/**
 * Implements a simple select-replace file editor in Telegram.
 **/

const fs = require("fs");
const escapeHtml = require("escape-html");
const utils = require("./utils");

class ChunkedString {
  constructor(text) {
    this.text = text;
    this.chunks = [];
  }

  findAcquire(text) {
    if (text.length === 0) throw Error("Empty find text not allowed");
    const index = this.text.indexOf(text);
    if (index === -1)
      throw Error("The substring was not found. Wrapping in tildes may be necessary.");
    if (index !== this.text.lastIndexOf(text))
      throw Error("There are multiple instances of the passed substring");
    return this.acquire(index, text.length);
  }

  acquire(offset, length) {
    if (offset < 0 || length <= 0 || offset + length > this.text.length)
      throw Error("Invalid coordinates");
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (offset + length > c.offset && c.offset + c.text.length > offset)
        throw Error("Chunk overlaps");
    }
    const chunk = { offset, text: this.text.substring(offset, offset + length) };
    this.chunks.push(chunk);
    return chunk;
  }

  release(chunk) {
    const idx = this.chunks.indexOf(chunk);
    if (idx === -1) throw Error("Invalid chunk given");
    this.chunks.splice(idx, 1);
  }

  modify(chunk, text) {
    const idx = this.chunks.indexOf(chunk);
    if (idx === -1) throw Error("Invalid chunk given");
    if (text.length === 0) throw Error("Empty replacement not allowed");
    const end = chunk.offset + chunk.text.length;
    this.text = this.text.substring(0, chunk.offset) + text + this.text.substring(end);
    const diff = text.length - chunk.text.length;
    chunk.text = text;
    this.chunks.forEach((c) => {
      if (c.offset > chunk.offset) c.offset += diff;
    });
  }
}


class Editor {
  constructor(reply, file, encoding = "utf-8") {
    this.reply = reply;
    this.file = file;
    this.encoding = encoding;

    const contents = fs.readFileSync(file, encoding);
    if (contents.length > 1500 || contents.split("\n").length > 50)
      throw Error("The file is too long");

    this.contents = new ChunkedString(contents);
    this.chunks = {}; // associates each message ID to an active chunk

    this.message = new utils.EditedMessage(reply, this._render(), "HTML");
    this.fileTouched = false;
  }

  _render() {
    if (!this.contents.text.trim()) return "<em>(empty file)</em>";
    return `<pre>${escapeHtml(this.contents.text)}</pre>`;
  }

  handleReply(msg) {
    this.message.idPromise.then((id) => {
      if (this.detached) return;
      if (msg.reply.id !== id) return;
      try {
        this.chunks[msg.id] = this.contents.findAcquire(msg.text);
      } catch (e) {
        this.reply.html("%s", e.message);
      }
    });
  }

  handleEdit(msg) {
    if (this.detached) return false;
    if (!Object.hasOwnProperty.call(this.chunks, msg.id)) return false;
    this.contents.modify(this.chunks[msg.id], msg.text);
    this.attemptSave();
    return true;
  }

  attemptSave() {
    this.fileTouched = true;
    process.nextTick(async () => {
      if (!this.fileTouched) return;
      if (this.detached) return;
      this.fileTouched = false;

      try {
        await fs.promises.writeFile(this.file, this.contents.text, this.encoding);
      } catch (e) {
        this.reply.html("Couldn't save file: %s", e.message);
        return;
      }
      this.message.edit(this._render());
    });
  }

  detach() {
    this.detached = true;
  }
}

module.exports = { Editor };
