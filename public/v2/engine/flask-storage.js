import { encodeCheckpoint, decodeCheckpoint, MAX_CHECKPOINT_BYTES } from './checkpoint.js';
import { rleDecode, N, COUNT } from '../alembic-engine-v2.js';

// Bound original text before JSON.parse, including whitespace and actual UTF-8 bytes.
function checkTextSize(text, limit) {
  if (typeof text !== 'string') throw new Error('Expected JSON text');
  if (text.length > limit) throw new Error('Checkpoint exceeds 16 MiB limit');
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) bytes++;
    else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
    if (bytes > limit) throw new Error('Checkpoint exceeds 16 MiB limit');
  }
}
export function parseCheckpointText(text) {
  checkTextSize(text, MAX_CHECKPOINT_BYTES);
  return decodeCheckpoint(JSON.parse(text));
}
export function checkpointText(checkpoint) {
  return JSON.stringify(encodeCheckpoint(checkpoint));
}
export function readFlasks(storage, key) {
  const text = storage.getItem(key);
  if (text === null) return [null, null, null];
  // Three checkpoint envelopes plus bounded thumbnail/entry metadata overhead.
  checkTextSize(text, 3 * (MAX_CHECKPOINT_BYTES + 256 * 1024));
  const entries = JSON.parse(text);
  if (entries === null) return [null, null, null]; // old empty-value convention
  if (!Array.isArray(entries) || entries.length !== 3) throw new Error('Invalid flask slots');
  return entries;
}
export function decodeFlask(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('Invalid flask');
  if (entry.kind === 'checkpoint-v1') return { kind: 'checkpoint-v1', checkpoint: decodeCheckpoint(entry.data) };
  if (entry.kind !== undefined && entry.kind !== 'scene-stamp') throw new Error('Unknown flask kind');
  const data = entry.data;
  if (typeof data !== 'string' || data.length > 4 * Math.ceil(N * 2 / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw new Error('Invalid scene stamp');
  const binary = atob(data);
  if (binary.length % 2) throw new Error('Invalid scene stamp');
  let cells = 0;
  for (let i = 0; i < binary.length; i += 2) {
    const id = binary.charCodeAt(i), count = binary.charCodeAt(i + 1);
    if (id >= COUNT || count === 0) throw new Error('Invalid scene stamp');
    cells += count;
  }
  if (cells !== N) throw new Error('Invalid scene stamp size');
  return { kind: 'scene-stamp', cells: rleDecode(Uint8Array.from(binary, c => c.charCodeAt(0))) };
}
export function saveFlask(storage, key, slot, entry) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2 || entry?.kind !== 'checkpoint-v1') throw new Error('Invalid flask save');
  if (!Number.isFinite(entry.t) || typeof entry.thumb !== 'string' || entry.thumb.length > 256 * 1024) throw new Error('Invalid flask metadata');
  const prepared = { kind: 'checkpoint-v1', t: entry.t, thumb: entry.thumb, data: encodeCheckpoint(entry.checkpoint) };
  const entries = readFlasks(storage, key);
  entries[slot] = prepared;
  const text = JSON.stringify(entries);
  // Storage.setItem is atomic on failure: never remove the old value or retry lossily.
  storage.setItem(key, text);
  return entries;
}
