// Version 1 inventory. Only schema-owned keys reach a world; scratch is rebuilt by it.
// Float32 payloads use little-endian bytes. Exact continuation is same-version/runtime.
export const MAX_CHECKPOINT_BYTES = 16 * 1024 * 1024;
const WIDTH = 480, HEIGHT = 270, SIZE = WIDTH * HEIGHT, FIELD_SIZE = 60 * 34, MATERIALS = 43;
// Every valid command serializes to more than 32 bytes, so this defensive list
// bound cannot reject a command queue that fits the serialized byte ceiling.
const MAX_COMMANDS = Math.floor(MAX_CHECKPOINT_BYTES / 32);
const fail = message => { throw new Error(`Invalid checkpoint: ${message}`); };
const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail('integer out of range');
  return v;
};
const finite = (v, min = -Infinity, max = Infinity) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail('nonfinite or out-of-range number');
  return v;
};
const boolean = v => { if (typeof v !== 'boolean') fail('expected boolean'); return v; };
const choice = (v, values) => { if (!values.includes(v)) fail('unknown value'); return v; };

function record(value, required, optional = []) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('expected plain object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) fail('unknown object key');
  for (const key of keys) if (!('value' in descriptors[key]) || !descriptors[key].enumerable) fail('expected enumerable data property');
  for (const key of required) if (!Object.hasOwn(descriptors, key)) fail(`missing ${key}`);
  return value;
}
function list(value, max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) fail('invalid list size');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) fail('sparse or extended list');
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, i);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('invalid list item');
  }
  return value;
}

// Count JSON UTF-8 bytes without stringifying the whole input or decoding any payload.
// Reject getters, excessive nesting and cyclic/non-JSON objects before reading values.
function checkSerializedSize(value, allowTyped = false) {
  let bytes = 0;
  const add = n => { bytes += n; if (bytes > MAX_CHECKPOINT_BYTES) fail('exceeds 16 MiB serialized limit'); };
  const string = v => {
    if (v.length > MAX_CHECKPOINT_BYTES) fail('exceeds 16 MiB serialized limit');
    add(2); // JSON string quotes; count escapes/UTF-8 without allocating a string copy.
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i);
      if (c === 34 || c === 92) add(2);
      else if (c < 32) add([8, 9, 10, 12, 13].includes(c) ? 2 : 6);
      else if (c < 128) add(1);
      else if (c < 2048) add(2);
      else if (c >= 0xd800 && c <= 0xdbff) {
        const next = v.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { add(4); i++; }
        else add(6); // JSON.stringify escapes lone surrogates.
      } else if (c >= 0xdc00 && c <= 0xdfff) add(6);
      else add(3);
    }
  };
  function visit(v, depth) {
    if (depth > 12) fail('excessive nesting');
    if (v === null) { add(4); return; }
    if (typeof v === 'string') { string(v); return; }
    if (typeof v === 'boolean') { add(v ? 4 : 5); return; }
    if (typeof v === 'number') { finite(v); add(JSON.stringify(v).length); return; }
    if (allowTyped && ArrayBuffer.isView(v)) {
      const Type = [Uint8Array, Int8Array, Float32Array].find(Type => Object.getPrototypeOf(v) === Type.prototype);
      if (!Type || ['length', 'buffer', 'byteOffset', 'byteLength'].some(key => Object.hasOwn(v, key))) fail('invalid typed array');
      add(4 * Math.ceil(v.byteLength / 3) + JSON.stringify({ type: Type.name, data: '' }).length);
      return;
    }
    if (Array.isArray(v)) {
      list(v, MAX_COMMANDS); add(2 + Math.max(0, v.length - 1));
      for (const item of v) visit(item, depth + 1);
      return;
    }
    if (!v || typeof v !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('expected JSON value');
    const keys = Reflect.ownKeys(v);
    if (keys.length > 64) fail('too many object keys');
    add(2 + Math.max(0, keys.length - 1));
    for (const key of keys) {
      if (typeof key !== 'string') fail('symbol key');
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (!('value' in d) || !d.enumerable) fail('expected JSON data property');
      string(key); add(1); visit(d.value, depth + 1);
    }
  }
  visit(value, 0);
}
function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
function toBytes(array, Type) {
  if (Type !== Float32Array) return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const bytes = new Uint8Array(array.length * 4), view = new DataView(bytes.buffer);
  for (let i = 0; i < array.length; i++) view.setFloat32(i * 4, array[i], true);
  return bytes;
}
function typed(value, Type, length, mode, material = false) {
  let array;
  if (mode === 'decode') {
    record(value, ['type', 'data']);
    if (value.type !== Type.name || typeof value.data !== 'string') fail('wrong typed-array tag');
    const byteLength = length * Type.BYTES_PER_ELEMENT;
    if (value.data.length !== 4 * Math.ceil(byteLength / 3)) fail('wrong typed-array payload length');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) fail('bad base64');
    const binary = atob(value.data);
    if (binary.length !== byteLength) fail('wrong decoded byte length');
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    if (base64(bytes) !== value.data) fail('noncanonical base64');
    array = new Type(length);
    if (Type === Float32Array) {
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < length; i++) array[i] = view.getFloat32(i * 4, true);
    } else new Uint8Array(array.buffer).set(bytes);
  } else {
    if (!value || Object.getPrototypeOf(value) !== Type.prototype || Object.hasOwn(value, 'length') || Object.hasOwn(value, 'buffer') || Object.hasOwn(value, 'byteOffset') || Object.hasOwn(value, 'byteLength') || value.length !== length) fail('wrong typed-array type or length');
    array = new Type(value);
  }
  if (material) for (const m of array) if (m >= MATERIALS) fail('invalid material ID');
  if (Type === Float32Array) for (const v of array) finite(v);
  return mode === 'encode' ? { type: Type.name, data: base64(toBytes(array, Type)) } : array;
}
const GRID_FIELDS = ['cells', 'shades', 'heat', 'VX', 'VY', 'trails', 'WU', 'WV'];
const SCALAR_FIELDS = ['seed', 'scene', 'tickIndex', 'scanDir', 'trailsLive', 'blastKick', 'windEnergy', 'shipCd', 'storm', 'stormT', 'stormCd', 'boltCd', 'flash', 'goldCount', 'goldCX', 'goldCY', 'visitorCount', 'wipe'];
const SHIP_FIELDS = ['active', 'x', 'y', 't', 'leaving', 'spawnCd', 'stolen', 'crash', 'beam'];
const RANDOM_FIELDS = ['physical', 'ecology', 'weather', 'cosmetic'];
const EVENT_FIELDS = {
  blast: ['x', 'y', 'r'], vkill: ['x', 'y'], portal: ['x', 'y'], zap: ['x', 'y'],
  stolen: [], shipdown: ['x', 'y'], shipleave: [], ship: [], storm: [],
  fulgurite: ['x', 'y'], shock: ['x', 'y', 'killed'], bolt: ['x0', 'y0', 'x', 'y'],
  stormend: [], void: ['x', 'y'],
};
const OPS = {
  l: ['x0', 'y0', 'x1', 'y1', 'r', 'm'], p: ['x', 'y', 'r', 'm'],
  spray: ['x', 'y', 'r', 'm', 'n'], box: ['x0', 'y0', 'x1', 'y1', 'm'],
  heat: ['x', 'y', 'r'], cool: ['x', 'y', 'r'], rain: ['m', 'n'],
  tempest: [], clear: [], reset: [], snap: [], wipe: ['mode'], load: ['cells'],
};
function operation(op, mode) {
  // Check the discriminator descriptor before accessing it, then whitelist the variant.
  const descriptor = op && Object.getOwnPropertyDescriptor(op, 't');
  if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || !Object.hasOwn(OPS, descriptor.value)) fail('unknown operation');
  const t = descriptor.value;
  const optional = ['l', 'p', 'spray'].includes(t) ? ['vx', 'vy'] : t === 'wipe' ? ['cells'] : [];
  record(op, ['t', ...OPS[t]], optional);
  const out = { t };
  for (const key of OPS[t]) {
    if (key === 'cells') out.cells = typed(op.cells, Uint8Array, SIZE, mode, true);
    else if (key === 'mode') out.mode = choice(op.mode, ['clear', 'reset', 'load']);
    else if (key === 'm') out.m = integer(op.m, 0, MATERIALS - 1);
    else if (key === 'n') out.n = integer(op.n, 0, SIZE);
    else if (key === 'r') out.r = t === 'spray' ? finite(op.r, 0, WIDTH) : integer(op.r, 0, WIDTH);
    else out[key] = key.startsWith('x') ? integer(op[key], -WIDTH, WIDTH * 2) : integer(op[key], -HEIGHT, HEIGHT * 2);
  }
  for (const key of ['vx', 'vy']) if (optional.includes(key) && Object.hasOwn(op, key)) {
    const value = op[key];
    // Only legacy host input normalizes nonfinite numeric fling hints; stored commands stay strict.
    out[key] = mode === 'legacy' && typeof value === 'number' && !Number.isFinite(value) ? 0 : finite(value);
  }
  if (t === 'wipe') {
    if (op.mode === 'load' && !Object.hasOwn(op, 'cells')) fail('missing wipe load payload');
    if (Object.hasOwn(op, 'cells')) out.cells = typed(op.cells, Uint8Array, SIZE, mode, true);
  }
  return out;
}
function commandValue(command, minTick, mode) {
  record(command, ['tick', 'sequence', 'op']);
  if (!Number.isSafeInteger(command.tick) || command.tick < minTick) fail('command tick must be in the future');
  if (!Number.isSafeInteger(command.sequence) || command.sequence < 0) fail('invalid command sequence');
  return { tick: command.tick, sequence: command.sequence, op: operation(command.op, mode) };
}

export function validateOperations(ops, { legacyVelocity = false } = {}) {
  if (!legacyVelocity) checkSerializedSize(ops, true);
  const detached = list(ops, MAX_COMMANDS).map(op => operation(op, legacyVelocity ? 'legacy' : 'raw'));
  if (legacyVelocity) checkSerializedSize(detached, true);
  return detached;
}
export function validateCommands(commands, tickIndex) {
  checkSerializedSize(commands, true);
  return list(commands, MAX_COMMANDS).map(command => commandValue(command, tickIndex + 1, 'raw'));
}
// Intake also checks the complete world envelope before installing a new queue.
export function validateCheckpointSize(value) { checkSerializedSize(value, true); }
function stateValue(state, mode) {
  record(state, [...SCALAR_FIELDS, ...GRID_FIELDS, 'ship', 'wipeC', 'wipeS', 'events', 'random', 'commands']);
  const out = {
    seed: integer(state.seed, 0, 0xffffffff), scene: choice(state.scene, ['empty', 'vessel']),
    tickIndex: integer(state.tickIndex), scanDir: choice(state.scanDir, [-1, 1]),
    trailsLive: boolean(state.trailsLive), blastKick: finite(state.blastKick, 0), windEnergy: finite(state.windEnergy, 0),
    shipCd: integer(state.shipCd), storm: integer(state.storm), stormT: integer(state.stormT),
    stormCd: integer(state.stormCd), boltCd: integer(state.boltCd), flash: finite(state.flash, 0, 1),
    goldCount: integer(state.goldCount, 0, SIZE), goldCX: finite(state.goldCX, 0, WIDTH),
    goldCY: finite(state.goldCY, 0, HEIGHT), visitorCount: integer(state.visitorCount, 0, SIZE),
    wipe: integer(state.wipe, -1, WIDTH - 1),
  };
  for (const key of GRID_FIELDS) {
    const Type = key === 'shades' ? Int8Array : ['VX', 'VY', 'WU', 'WV'].includes(key) ? Float32Array : Uint8Array;
    out[key] = typed(state[key], Type, ['WU', 'WV'].includes(key) ? FIELD_SIZE : SIZE, mode, key === 'cells');
  }
  record(state.ship, SHIP_FIELDS);
  out.ship = {
    active: boolean(state.ship.active), x: finite(state.ship.x), y: finite(state.ship.y),
    t: integer(state.ship.t), leaving: boolean(state.ship.leaving),
    // A full visitor census can keep a beaming ship's spawn cooldown below zero.
    spawnCd: integer(state.ship.spawnCd, -Number.MAX_SAFE_INTEGER), stolen: integer(state.ship.stolen),
    crash: boolean(state.ship.crash), beam: boolean(state.ship.beam),
  };
  if ((state.wipeC === null) !== (state.wipeS === null) || state.wipe >= 0 && state.wipeC === null) fail('incomplete wipe targets');
  out.wipeC = state.wipeC === null ? null : typed(state.wipeC, Uint8Array, SIZE, mode, true);
  out.wipeS = state.wipeS === null ? null : typed(state.wipeS, Int8Array, SIZE, mode);
  record(state.random, RANDOM_FIELDS);
  out.random = {};
  for (const key of RANDOM_FIELDS) out.random[key] = integer(state.random[key], 0, 0xffffffff);
  out.events = list(state.events, 48).map(event => {
    const descriptor = event && Object.getOwnPropertyDescriptor(event, 't');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || !Object.hasOwn(EVENT_FIELDS, descriptor.value)) fail('unknown event');
    const fields = EVENT_FIELDS[descriptor.value]; record(event, ['t', ...fields]);
    const e = { t: descriptor.value };
    for (const key of fields) e[key] = key === 'killed' ? integer(event[key], 0, SIZE) : finite(event[key], key === 'r' ? 0 : -Infinity);
    return e;
  });
  let previousTick = -1, previousSequence = -1;
  out.commands = list(state.commands, MAX_COMMANDS).map(command => {
    const next = commandValue(command, state.tickIndex + 1, mode);
    const { tick, sequence } = next;
    if (tick < previousTick || tick === previousTick && sequence <= previousSequence) fail('unsorted or duplicate command sequence');
    previousTick = tick; previousSequence = sequence;
    return next;
  });
  return out;
}
function envelope(value, mode) {
  record(value, ['format', 'version', 'width', 'height', 'tick', 'state']);
  if (value.format !== 'alembic-world') fail('unknown format');
  if (value.version !== 1) fail('unknown version');
  if (value.width !== WIDTH || value.height !== HEIGHT) fail('wrong dimensions');
  const tick = integer(value.tick), state = stateValue(value.state, mode);
  if (tick !== state.tickIndex) fail('tick disagrees with state');
  return { format: 'alembic-world', version: 1, width: WIDTH, height: HEIGHT, tick, state };
}

export function validateWorldState(state) {
  checkSerializedSize(state, true);
  return stateValue(state, 'raw');
}
export function validateCheckpoint(value) {
  checkSerializedSize(value, true);
  return envelope(value, 'raw');
}
export function encodeCheckpoint(value) {
  checkSerializedSize(value, true);
  const encoded = envelope(value, 'encode');
  checkSerializedSize(encoded);
  return encoded;
}
export function decodeCheckpoint(value) {
  checkSerializedSize(value);
  return envelope(value, 'decode');
}
