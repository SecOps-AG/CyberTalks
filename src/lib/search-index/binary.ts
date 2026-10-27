/**
 * Little-endian section writer and reader.
 * Every section starts 8-byte aligned so typed-array views share the file buffer.
 */

import {
  HEADER_BYTES,
  HEADER_U32_FIELDS,
  SEARCH_INDEX_MAGIC,
  SEARCH_INDEX_VERSION,
  type IndexHeader,
} from "./format";

export function writeHeader(bytes: Uint8Array, header: IndexHeader): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(0, SEARCH_INDEX_MAGIC, true);
  view.setUint16(4, header.version, true);
  view.setUint16(6, HEADER_BYTES, true);
  let offset = 8;
  for (const field of HEADER_U32_FIELDS) {
    view.setUint32(offset, header[field], true);
    offset += 4;
  }
}

export function readHeader(buffer: ArrayBuffer): IndexHeader {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error("Search index is truncated.");
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== SEARCH_INDEX_MAGIC) throw new Error("Search index magic does not match.");
  const version = view.getUint16(4, true);
  if (version !== SEARCH_INDEX_VERSION) {
    throw new Error(`Unsupported search index version ${version}.`);
  }
  const headerSize = view.getUint16(6, true);
  if (headerSize !== HEADER_BYTES) throw new Error("Search index header size does not match.");
  const header = { version } as IndexHeader;
  let offset = 8;
  for (const field of HEADER_U32_FIELDS) {
    header[field] = view.getUint32(offset, true);
    offset += 4;
  }
  return header;
}

export class Writer {
  private readonly parts: Uint8Array[] = [];
  length = 0;

  constructor() {
    this.raw(new Uint8Array(HEADER_BYTES));
  }

  private raw(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.length += bytes.byteLength;
  }

  private copy(view: ArrayBufferView): void {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const cloned = new Uint8Array(bytes.byteLength);
    cloned.set(bytes);
    this.raw(cloned);
  }

  align(): void {
    const pad = (8 - (this.length % 8)) % 8;
    if (pad) this.raw(new Uint8Array(pad));
  }

  u8(values: Uint8Array): void {
    this.align();
    this.copy(values);
  }

  u16(values: Uint16Array): void {
    this.align();
    this.copy(values);
  }

  u32(values: Uint32Array): void {
    this.align();
    this.copy(values);
  }

  finish(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }
    return out;
  }
}

export class Cursor {
  offset: number;

  constructor(
    private readonly buffer: ArrayBuffer,
    offset = 0,
  ) {
    this.offset = offset;
  }

  private align(): void {
    const pad = (8 - (this.offset % 8)) % 8;
    this.offset += pad;
  }

  u8(count: number): Uint8Array {
    this.align();
    if (count === 0) return new Uint8Array();
    this.need(count);
    const out = new Uint8Array(this.buffer, this.offset, count);
    this.offset += count;
    return out;
  }

  u16(count: number): Uint16Array {
    this.align();
    if (count === 0) return new Uint16Array();
    this.need(count * 2);
    const out = new Uint16Array(this.buffer, this.offset, count);
    this.offset += count * 2;
    return out;
  }

  u32(count: number): Uint32Array {
    this.align();
    if (count === 0) return new Uint32Array();
    this.need(count * 4);
    const out = new Uint32Array(this.buffer, this.offset, count);
    this.offset += count * 4;
    return out;
  }

  private need(bytes: number): void {
    if (this.offset + bytes > this.buffer.byteLength) {
      throw new Error("Search index is truncated.");
    }
  }
}
