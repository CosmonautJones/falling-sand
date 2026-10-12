import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';
import * as play from '../public/v2/play.js';
import * as camera from '../public/v2/camera.js';

// Run the actual component handlers and actual checkpoint protocol, without a DOM.
const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
class Logic {
  constructor(props) { this.props = props; }
  setState(patch, done) { Object.assign(this.state, patch); done?.(); }
}
const Component = new Function('DCLogic', 'React', 'localStorage', script + '\nreturn Component;')(
  Logic, { createRef: () => ({ current: null }) }, { getItem: () => null, setItem() {} });
function fixture() {
  const component = new Component({});
  component.M = E; component.playMod = play; component.camera = camera;
  component.layout = camera.layout(390, 590); component.vw = 390; component.vh = 590;
  component.view = camera.closeView(component.layout);
  component.resize = () => {};
  component.syncViewUI = () => {};
  component.state.ready = true;
  const engine = E.createEngine(); engine.advanceTicks(37);
  const flush = () => {
    while (component.checkpointRequests.length) {
      const requests = component.checkpointRequests.splice(0);
      for (const request of requests) component.onCheckpointReply(E.handleEngineRequest(engine, request));
    }
  };
  return { component, engine, flush };
}

test('enter, retry and return preserve the original world and brush controls', () => {
  const { component: c, engine, flush } = fixture();
  assert.equal(typeof c.enterDam, 'function', 'the toy must have a reversible entry point');
  c.state.brush = E.ICE; c.state.radius = 12; c.state.tool = 'cool'; c.state.paused = true; c.state.speed = 0.5;
  const before = engine.captureState(), view = { ...c.view };
  c.enterDam(); flush();
  assert.equal(c.state.playing, true);
  assert.equal(c.state.brush, E.AIR);
  assert.equal(c.state.paused, false);
  engine.advanceTicks(100, [{ tick: 1, sequence: 0, op: { t: 'p', x: 244, y: 115, r: 6, m: E.AIR } }]);
  c.againDam(); flush();
  assert.deepEqual(engine.captureState(), play.createDamCheckpoint().state);
  c.leaveDam(); flush();
  assert.deepEqual(engine.captureState(), before);
  assert.equal(c.state.playing, false);
  assert.deepEqual([c.state.brush, c.state.radius, c.state.tool, c.state.paused, c.state.speed], [E.ICE, 12, 'cool', true, 0.5]);
  assert.deepEqual(c.view, view);
});

test('a failed toy restore keeps the return checkpoint available for another attempt', () => {
  const { component: c, engine, flush } = fixture();
  assert.equal(typeof c.enterDam, 'function');
  const before = engine.captureState();
  c.enterDam(); flush();
  c.leaveDam();
  const request = c.checkpointRequests.shift();
  c.onCheckpointReply({ t: request.t, requestId: request.requestId, ok: false, error: 'Try again' });
  assert.equal(c.state.playing, true);
  assert.equal(c.toyBusy, false);
  c.leaveDam(); flush();
  assert.deepEqual(engine.captureState(), before);
});

test('return resumes opening eligibility rather than making the seeded blast a player achievement', () => {
  const { component: c, flush } = fixture();
  assert.equal(typeof c.enterDam, 'function');
  c.openingPending = true; c.openingUntil = performance.now() + 20000;
  c.enterDam(); flush();
  assert.equal(c.openingPending, false);
  c.leaveDam(); flush();
  assert.equal(c.openingPending, true);
  assert.ok(c.openingUntil > performance.now() + 19000, 'time spent in the toy does not consume the opening window');
});

test('entry uses opening eligibility after the final in-flight vessel frame', () => {
  const { component: c, flush } = fixture();
  c.enterDam();
  // A worker frame already in flight can contain the opening blast before capture replies.
  c.openingPending = false;
  flush(); c.leaveDam(); flush();
  assert.equal(c.openingPending, false, 'an already witnessed opening is not re-armed');
});
