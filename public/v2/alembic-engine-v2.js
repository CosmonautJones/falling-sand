// Alembic v2 worker/host adapter. Each engine owns an independent world.
import { createWorld, N, COUNT } from './engine/world.js';
import { validateCheckpoint, validateOperations } from './engine/checkpoint.js';
export * from './engine/world.js';
export { encodeCheckpoint, decodeCheckpoint, MAX_CHECKPOINT_BYTES } from './engine/checkpoint.js';

// ---------- RLE (snapshots) ----------
export function rleEncode(c) {
  const out = []; let i = 0;
  while (i < c.length) { const v = c[i]; let n = 1; while (i + n < c.length && c[i + n] === v && n < 255) n++; out.push(v, n); i += n; }
  return Uint8Array.from(out);
}
export function rleDecode(b) {
  const c = new Uint8Array(N); let p = 0;
  for (let i = 0; i + 1 < b.length && p < N; i += 2) { const v = b[i] < COUNT ? b[i] : 0; c.fill(v, p, Math.min(N, p + b[i + 1])); p += b[i + 1]; }
  return c;
}

// ---------- engine ----------
const STEP_MS = 1000 / 60;
export function createEngine(options = {}) {
  const world = createWorld(options);
  let acc = 0, tickN = 0, frames = 0;
  return {
    captureState: world.captureState,
    checkpoint() {
      const state = world.captureState();
      return { format: 'alembic-world', version: 1, width: 480, height: 270, tick: state.tickIndex, state };
    },
    restore(checkpoint) {
      const next = validateCheckpoint(checkpoint);
      world.restore(next.state);
      acc = 0; tickN = 0; frames = 0;
    },
    inspect: world.inspect,
    advanceTicks: (count, commands = []) => world.advanceTicks(count, commands),
    render: world.render,
    reset(options) { world.reset(options); acc = 0; tickN = 0; frames = 0; },
    tick(msg, color, emis, fxb) {
      const t0 = performance.now();
      const ops = validateOperations(msg.ops ?? [], { legacyVelocity: true });
      let snap = null, steps = 0, discardedMs = 0, nextAcc = acc;
      if (!msg.paused) {
        const dt = Number.isFinite(msg.dt) ? Math.max(0, msg.dt) : 0;
        const speed = Number.isFinite(msg.speed) ? Math.max(0, msg.speed) : 1;
        discardedMs = Math.max(0, dt - 48) * speed;
        nextAcc += Math.min(48, dt) * speed;
        while (nextAcc >= STEP_MS && steps < 3) { nextAcc -= STEP_MS; steps++; }
        if (nextAcc > STEP_MS * 3) { discardedMs += nextAcc; nextAcc = 0; }
      }
      const observeOperation = (op, result) => { if (op.t === 'snap') snap = result; };
      const events = msg.paused
        ? world.applyOperations(ops, observeOperation, true)
        : world.advanceTicks(steps, world.commandsForNextTick(ops), observeOperation);
      acc = nextAcc;
      if (!msg.still) tickN++;
      world.render(color, emis, fxb, msg.still ? 0 : tickN);
      frames++;
      const kick = events.reduce((max, event) => event.t === 'blast' ? Math.max(max, event.r) : max, 0);
      return { ...world.finishFrame(frames % 6 === 0), events, kick, discardedMs, ms: performance.now() - t0, snap };
    },
  };
}

// The same correlated protocol is used by worker and local hosts.
export function handleEngineRequest(engine, request) {
  const reply = { t: request.t, requestId: request.requestId, ok: false };
  try {
    if (request.t === 'checkpoint') {
      reply.checkpoint = engine.checkpoint();
      if (request.thumbnail) {
        reply.color = new Uint8Array(N * 4);
        engine.render(reply.color, new Uint8Array(N * 4), new Uint8Array(N * 4), 0);
      }
    }
    else if (request.t === 'restore') engine.restore(request.checkpoint);
    else throw new Error('Unknown checkpoint request');
    reply.ok = true;
  } catch (error) { reply.error = error instanceof Error ? error.message : 'Checkpoint operation failed'; }
  return reply;
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  let eng = null;
  self.onmessage = (e) => {
    const d = e.data;
    if (d.t === 'checkpoint' || d.t === 'restore') {
      if (!eng) eng = createEngine();
      self.postMessage(handleEngineRequest(eng, d));
      return;
    }
    if (d.type !== 'tick') return;
    if (!eng) eng = createEngine();
    const r = eng.tick(d, new Uint8Array(d.color), new Uint8Array(d.emis), new Uint8Array(d.fx));
    r.type = 'frame'; r.color = d.color; r.emis = d.emis; r.fx = d.fx;
    self.postMessage(r, [d.color, d.emis, d.fx]);
  };
}
