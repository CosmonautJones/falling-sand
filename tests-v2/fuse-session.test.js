import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';
import * as play from '../public/v2/play.js';
import * as camera from '../public/v2/camera.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
class Logic {
  constructor(props) { this.props = props; }
  setState(patch, done) { Object.assign(this.state, patch); done?.(); }
}
const Component = new Function('DCLogic', 'React', 'localStorage', script + '\nreturn Component;')(
  Logic, { createRef: () => ({ current: null }) }, { getItem: () => null, setItem() {} });
function fixture() {
  const c = new Component({});
  c.M = E; c.playMod = play; c.camera = camera;
  c.layout = camera.layout(390, 590); c.vw = 390; c.vh = 590;
  c.view = camera.closeView(c.layout);
  c.resize = () => {}; c.syncViewUI = () => {}; c.state.ready = true;
  const engine = E.createEngine(); engine.advanceTicks(37);
  const flush = (target = engine) => {
    while (c.checkpointRequests.length) {
      for (const request of c.checkpointRequests.splice(0)) c.onCheckpointReply(E.handleEngineRequest(target, request));
    }
  };
  return { c, engine, flush };
}

test('the fuse entry selects fire, shows its own hint, retries, and restores the vessel controls', () => {
  const { c, engine, flush } = fixture();
  c.state.brush = E.ICE; c.state.radius = 12; c.state.paused = true;
  const before = engine.captureState();
  assert.equal(typeof c.enterFuse, 'function');
  c.enterFuse(); flush();
  assert.equal(c.state.playing, true);
  assert.equal(c.state.brush, E.FIRE);
  assert.equal(c.state.radius, 3);
  assert.equal(c.renderVals().playName, 'Light the fuse');
  assert.match(c.renderVals().playHintText, /fire/);
  assert.match(c.renderVals().line, /fuse/i);
  assert.deepEqual(c.view, play.fuseView(c.layout));
  engine.advanceTicks(90, [{ tick: 1, sequence: 0, op: { t: 'p', x: 260, y: 92, r: 3, m: E.FIRE } }]);
  c.againDam(); flush();
  assert.deepEqual(engine.captureState(), play.createFuseCheckpoint().state);
  assert.equal(c.state.brush, E.FIRE);
  c.leaveDam(); flush();
  assert.deepEqual(engine.captureState(), before);
  assert.deepEqual([c.state.brush, c.state.radius, c.state.paused], [E.ICE, 12, true]);
});

test('dam entry still selects the eraser after returning from the fuse', () => {
  const { c, flush } = fixture();
  assert.equal(typeof c.enterFuse, 'function');
  c.enterFuse(); flush(); c.leaveDam(); flush();
  c.enterDam(); flush();
  assert.equal(c.state.brush, E.AIR);
  assert.equal(c.renderVals().playName, 'Pop the dam');
  assert.match(c.renderVals().playHintText, /Erase/);
});

test('failed initial restore holds input and edits until Again successfully opens the fuse', () => {
  const { c, engine, flush } = fixture();
  c.state.brush = E.ICE; c.state.paused = true;
  const before = engine.captureState();
  c.enterFuse();
  const capture = c.checkpointRequests.shift();
  c.onCheckpointReply(E.handleEngineRequest(engine, capture));
  const restore = c.checkpointRequests.shift();
  c.onCheckpointReply({ t: restore.t, requestId: restore.requestId, ok: false, error: 'Try again' });
  assert.equal(c.renderVals().playName, 'Light the fuse');
  assert.equal(c.renderVals().playBusy, false, 'retry and return remain available');
  assert.equal(c.state.brush, E.ICE);
  c.eng = engine; c.mode = 'local'; c.onFrame = () => {};
  c.bufs = Array.from({ length: 3 }, () => new ArrayBuffer(E.N * 4));
  c.pendingDt = 48; c.ops = [{ t: 'clear' }]; c.state.paused = false;
  c.send();
  assert.deepEqual(engine.captureState(), before, 'uncertain restore state cannot advance or receive edits');
  c.againDam(); flush();
  assert.equal(c.state.brush, E.FIRE);
  assert.equal(c.toyRecovery, false);
});

test('worker loss during initial restore keeps the return checkpoint recoverable', () => {
  const { c, engine, flush } = fixture();
  c.state.brush = E.ICE; c.state.paused = true;
  const before = engine.captureState();
  c.enterFuse();
  c.onCheckpointReply(E.handleEngineRequest(engine, c.checkpointRequests.shift()));
  c.mode = 'worker';
  c.toLocal();
  assert.equal(c.mode, 'local');
  assert.equal(c.renderVals().playName, 'Light the fuse');
  assert.equal(c.toyRecovery, true);
  c.leaveDam(); flush(c.eng);
  assert.deepEqual(c.eng.captureState(), before);
  assert.equal(c.state.brush, E.ICE);
  assert.equal(c.state.paused, true);
});
