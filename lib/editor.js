/**
 * Implements a simple select-replace file editor in Telegram.
 **/

const fs = require("fs");
const escapeHtml = require("escape-html");
const utils = require("./utils");

class ChunkedString {
  constructor(text) {
    this.pieces = [text];
    this.chunks = [];
  }

  get text() {
    let res = "";
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      res += typeof p === "string" ? p : p.text;
    }
    return res;
  }

  findAcquire(text) {
    if (text.length === 0) throw Error("Empty find text not allowed");
    const fullText = this.text;
    const index = fullText.indexOf(text);
    if (index === -1)
      throw Error("The substring was not found. Wrapping in tildes may be necessary.");
    if (index !== fullText.lastIndexOf(text))
      throw Error("There are multiple instances of the passed substring");
    return this.acquire(index, text.length);
  }

  acquire(offset, length) {
    const fullText = this.text;
    if (offset < 0 || length <= 0 || offset + length > fullText.length)
      throw Error("Invalid coordinates");

    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (offset + length > c.offset && c.offset + c.text.length > offset)
        throw Error("Chunk overlaps");
    }

    let currentPos = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      const pieceStr = typeof piece === "string" ? piece : piece.text;
      const pieceLen = pieceStr.length;

      if (offset >= currentPos && offset + length <= currentPos + pieceLen) {
        const relOffset = offset - currentPos;
        const prefix = pieceStr.substring(0, relOffset);
        const chunkText = pieceStr.substring(relOffset, relOffset + length);
        const suffix = pieceStr.substring(relOffset + length);

        const self = this;
        const chunk = {
          get offset() {
            let pos = 0;
            for (let j = 0; j < self.pieces.length; j++) {
              const p = self.pieces[j];
              if (p === chunk) return pos;
              pos += typeof p === "string" ? p.length : p.text.length;
            }
            return -1;
          },
          text: chunkText,
        };

        const newPieces = [];
        if (prefix.length > 0) newPieces.push(prefix);
        newPieces.push(chunk);
        if (suffix.length > 0) newPieces.push(suffix);

        this.pieces.splice(i, 1, ...newPieces);
        this.chunks.push(chunk);
        return chunk;
      }
      currentPos += pieceLen;
    }

    throw Error("Invalid coordinates");
  }

  release(chunk) {
    const idx = this.chunks.indexOf(chunk);
    if (idx === -1) throw Error("Invalid chunk given");
    this.chunks.splice(idx, 1);

    const pIdx = this.pieces.indexOf(chunk);
    if (pIdx !== -1) {
      this.pieces[pIdx] = chunk.text;
      this._compactPieces();
    }
  }

  _compactPieces() {
    const newPieces = [];
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (typeof p === "string") {
        if (newPieces.length > 0 && typeof newPieces[newPieces.length - 1] === "string") {
          newPieces[newPieces.length - 1] += p;
        } else if (p.length > 0) {
          newPieces.push(p);
        }
      } else {
        newPieces.push(p);
      }
    }
    this.pieces = newPieces;
  }

  modify(chunk, text) {
    if (!this.chunks.includes(chunk)) throw Error("Invalid chunk given");
    if (text.length === 0) throw Error("Empty replacement not allowed");
    chunk.text = text;
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

module.exports = { Editor, ChunkedString };
