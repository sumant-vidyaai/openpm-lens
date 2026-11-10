/**
 * A minimal ZIP writer (files stored without compression), so the archive opens in any zip tool and needs no library.
 * Layout follows the ZIP format: for each file a local header + data, then a central directory and an end record.
 */
const enc = new TextEncoder();

let table: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = (table[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile { name: string; data: string | Uint8Array }

/** `when` fixes the stored time (pass the export time); names are stored as UTF-8. */
export function buildZip(files: readonly ZipFile[], when: Date): Uint8Array {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const dosDate = (Math.max(0, when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const push = (u: Uint8Array) => { parts.push(u); offset += u.length; };
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    const start = offset;
    push(new Uint8Array(local.buffer)); push(name); push(data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true); cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true);
    cd.setUint32(42, start, true);
    central.push(new Uint8Array(cd.buffer), name);
  }
  const cdStart = offset;
  for (const c of central) push(c);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, offset - cdStart, true); end.setUint32(16, cdStart, true);
  push(new Uint8Array(end.buffer));
  const out = new Uint8Array(offset);
  let p = 0;
  for (const u of parts) { out.set(u, p); p += u.length; }
  return out;
}

export interface ZipEntry { name: string; data: Uint8Array }
const dec = new TextDecoder('utf-8');
export const zipText = (e: ZipEntry): string => dec.decode(e.data);

/** Unpacks a ZIP held in memory (stored or "deflate" files, no password, no ZIP64). Reads the central directory, so extra data after the files does not matter. */
export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) { if (v.getUint32(i, true) === 0x06054b50) { end = i; break; } }
  if (end < 0) throw new Error('This is not a zip file, or it is damaged.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('The zip file is damaged (bad directory).');
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw new Error('The zip file is password protected, which is not supported.');
    if (lho + 30 > bytes.length || v.getUint32(lho, true) !== 0x04034b50) throw new Error('The zip file is damaged (bad entry).');
    const start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) { out.push({ name, data: raw.slice() }); continue; }
    if (method !== 8) throw new Error(`The zip file uses a compression method (${method}) that is not supported.`);
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack a compressed zip. Load the archive straight from Spashta, or unzip it and load the files.');
    const stream = new Blob([raw.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    out.push({ name, data: new Uint8Array(await new Response(stream).arrayBuffer()) });
  }
  return out;
}
