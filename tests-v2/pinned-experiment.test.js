import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as E from '../public/v2/alembic-engine-v2.js';
import * as opening from '../public/v2/opening.js';
import * as toasts from '../public/v2/toasts.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
const recipe = index => {
  const n = opening.NUDGES[index];
  return { goal: E[n.goal], brush: E[n.brush], text: n.text };
};
const plain = value => JSON.parse(JSON.stringify(value));
function component(t, withModule = true) {
  const values = new Map([['existing-save', 'keep']]);
  const store = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const timers = new Map(); let timerId = 0;
  const context = {
    DCLogic: class {
      constructor() { this.props = {}; }
      setState(value, done) { Object.assign(this.state, value); done?.(); }
    },
    React: { createRef: () => ({ current: null }) }, localStorage: store, performance, console,
    Uint8Array, Float32Array, ArrayBuffer, Blob, Response, btoa, atob, URL,
    location: { href: 'https://example.test/v2/', hash: '' }, navigator: {},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id), cancelAnimationFrame() {},
  };
  vm.createContext(context); vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  ui.alive = true;
  if (withModule) {
    ui.M = E; ui.opening = opening; ui.toastsMod = toasts;
    ui.known = new Set(E.STARTER); ui.state.ready = true;
  }
  ui.fanfare = () => {}; ui.chime = () => {};
  ui.updateReticleSize = () => {}; // Graphics only; all experiment/discovery methods stay real.
  t.after(() => ui.componentWillUnmount());
  return { ui, timers, store };
}
function channels(ui) {
  return { ops: plain(ui.ops), pending: plain(ui.pending), requests: plain(ui.checkpointRequests),
    jobs: Array.from(ui.checkpointJobs.keys()) };
}
function checkExperiment(ui, expected, message) {
  assert.deepEqual(plain(ui.state.experiment), expected, message);
}

test('experiment state and render values are safe before engine readiness', t => {
  const { ui } = component(t, false);
  assert.equal(ui.state.experiment, null);
  assert.equal(ui.renderVals().experimentVisible, false);
  assert.doesNotThrow(() => ui.pinExperiment(E.BRINE));
  assert.doesNotThrow(() => ui.resumeExperiment());
  assert.equal(ui.state.experiment, null);
});

test('manual pin preserves the chosen tools and world while consuming the automatic nudge', t => {
  const { ui, timers, store } = component(t);
  const n = recipe(3);
  ui.eng = E.createEngine({ seed: 91, scene: 'empty', weather: false, ambientEmbers: false });
  ui.eng.inspect().setc(50, 60, E.GLASS, 3);
  ui.setState({ brush: E.SAND, tool: 'cool', folio: true, sheet: 'options', whisper: 'Existing weather message.' });
  const activeToast = { kind: 'find', label: 'An existing discovery', text: 'Keep this toast.' };
  ui.state.toast = activeToast;
  ui.ops.push({ t: 'p', x: 9, y: 9, r: 0, m: E.STONE });
  ui.pending.push({ t: 'wipe', mode: 'clear' });
  ui.queueNudge(25);
  const timer = ui.nudgeT, queuedNudge = timers.get(timer).fn;
  const before = channels(ui), world = ui.eng.captureState();
  ui.pinExperiment(n.goal);
  checkExperiment(ui, n);
  assert.equal(ui.state.suggest, n.brush);
  assert.equal(ui.state.brush, E.SAND); assert.equal(ui.state.tool, 'cool');
  assert.equal(ui.state.folio, false); assert.equal(ui.state.sheet, '');
  assert.equal(ui.state.whisper, 'Existing weather message.');
  assert.equal(ui.state.toast, activeToast, 'the pinned card does not occupy the discovery toast');
  assert.equal(timers.has(timer), false); assert.equal(ui.nudged, true);
  assert.deepEqual(channels(ui), before);
  assert.deepEqual(ui.eng.captureState(), world);
  assert.equal(store.getItem('existing-save'), 'keep');
  queuedNudge(); ui.nudge();
  checkExperiment(ui, n, 'a callback already queued cannot replace a manual pin');
});

test('pin rejects unavailable, failed, completed, and unsupported targets without side effects', t => {
  const cases = [
    ['module missing', ui => { ui.M = undefined; }, E.BRINE],
    ['recipes missing', ui => { ui.opening = undefined; }, E.BRINE],
    ['not ready', ui => { ui.state.ready = false; }, E.BRINE],
    ['engine failed', ui => { ui.state.engineError = 'Simulation stopped.'; }, E.BRINE],
    ['already discovered', ui => { ui.known.add(E.BRINE); }, E.BRINE],
    ['no existing recipe', () => {}, E.STEAM],
    ['string id', () => {}, String(E.BRINE)],
    ['fractional id', () => {}, E.BRINE + 0.5],
    ['negative id', () => {}, -1],
    ['nonfinite id', () => {}, NaN],
  ];
  for (const [name, prepare, goal] of cases) {
    const { ui, timers } = component(t);
    ui.queueNudge(100); prepare(ui);
    const before = plain(ui.state), queued = channels(ui), timerCount = timers.size;
    assert.doesNotThrow(() => ui.pinExperiment(goal), name);
    assert.deepEqual(plain(ui.state), before, name);
    assert.deepEqual(channels(ui), queued, name);
    assert.equal(timers.size, timerCount, name + ' must not consume the pending nudge');
    assert.ok(!ui.nudged, name);
  }
});

test('automatic suggestion stores its recipe once and dismissal prevents its return', t => {
  const { ui, timers } = component(t);
  const n = opening.pickNudge(ui.known, E);
  ui.queueNudge(20);
  const queued = timers.get(ui.nudgeT).fn;
  ui.nudge();
  checkExperiment(ui, n);
  assert.equal(ui.state.whisper, n.text, 'the existing automatic whisper is preserved');
  assert.equal(ui.state.toast.text, n.text, 'the existing TRY toast still appears');
  const toast = ui.state.toast, whisper = ui.state.whisper;
  ui.renderVals().onDismissExperiment();
  assert.equal(ui.state.experiment, null); assert.equal(ui.state.suggest, -1);
  assert.equal(ui.renderVals().experimentVisible, false);
  assert.equal(ui.state.whisper, whisper); assert.equal(ui.state.toast, toast);
  queued(); ui.nudge(); ui.queueNudge(1);
  assert.equal(ui.state.experiment, null, 'a queued callback cannot restore a dismissed card');
  assert.equal(ui.nudged, true);
});

test('brush, folio, unrelated discoveries and weather leave the pending instruction intact', t => {
  const { ui } = component(t), n = recipe(3);
  ui.pinExperiment(n.goal);
  ui.setState({ brush: E.WATER, tool: 'heat', folio: true, sheet: 'options', whisper: 'Another message.' });
  ui.revealMany([E.STEAM], 'A separate discovery.');
  assert.equal(ui.state.whisper, 'A separate discovery.');
  assert.equal(ui.state.toast.text, 'A separate discovery.');
  ui.onEvents([{ t: 'climate', v: -1 }, { t: 'season', v: 2 }, { t: 'omen', v: 1 }]);
  assert.notEqual(ui.state.whisper, 'A separate discovery.', 'real weather handlers still update the shared whisper');
  checkExperiment(ui, n);
  const rendered = ui.renderVals();
  assert.equal(rendered.experimentVisible, true);
  assert.equal(rendered.experimentComplete, false);
  assert.equal(rendered.experimentText, n.text);
  assert.equal(rendered.experimentStatus, 'Waiting for a new Codex page.');
  assert.equal(rendered.experimentBrushLabel, 'pour ' + E.NAMES[n.brush]);
});

test('normal discovery completes the pin without changing discovery messages', t => {
  const { ui } = component(t), n = recipe(0);
  ui.pinExperiment(n.goal);
  ui.revealMany([n.goal], 'The ordinary discovery message.');
  const rendered = ui.renderVals();
  assert.equal(ui.state.experiment.goal, n.goal);
  assert.equal(rendered.experimentVisible, true);
  assert.equal(rendered.experimentComplete, true);
  assert.equal(rendered.experimentStatus, 'Discovered \u00b7 ' + E.NAMES[n.goal]);
  assert.equal(ui.state.whisper, 'The ordinary discovery message.');
  assert.equal(ui.state.toast.text, 'The ordinary discovery message.');
});

test('quietly stained pages also complete a pin without inventing a toast', t => {
  const { ui } = component(t), n = recipe(0);
  ui.pinExperiment(n.goal);
  const beforeToast = ui.state.toast, beforeWhisper = ui.state.whisper;
  assert.notEqual(ui.state.brush, n.brush, 'the suggested reagent is not selected');
  ui.stainQuietly([n.goal]);
  assert.equal(ui.known.has(n.goal), true);
  assert.equal(ui.renderVals().experimentComplete, true);
  assert.equal(ui.renderVals().suggesting, 'false', 'a quietly completed goal stops suggesting its reagent');
  assert.equal(ui.renderVals().experimentStatus, 'Discovered \u00b7 ' + E.NAMES[n.goal]);
  assert.equal(ui.state.toast, beforeToast); assert.equal(ui.state.whisper, beforeWhisper);
});

test('resume selects the existing reagent and pour tool without replaying or changing the world', t => {
  const { ui } = component(t), n = recipe(4);
  ui.pinExperiment(n.goal);
  ui.mode = 'local';
  ui.eng = E.createEngine({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
  ui.eng.inspect().setc(100, 90, E.WATER, 2);
  ui.ops.push({ t: 'p', x: 12, y: 12, r: 0, m: E.SAND });
  ui.pending.push({ t: 'wipe', mode: 'clear' });
  ui.requestCheckpoint('checkpoint', {}, { kind: 'export' });
  ui.setState({ brush: E.FIRE, tool: 'cool', folio: true, sheet: 'options', whisper: 'Keep this discovery.' });
  const before = channels(ui), world = ui.eng.captureState();
  ui.renderVals().onExperimentBrush();
  assert.equal(ui.state.brush, n.brush); assert.equal(ui.state.tool, 'pour');
  assert.equal(ui.state.folio, false); assert.equal(ui.state.sheet, '');
  checkExperiment(ui, n);
  assert.equal(ui.state.whisper, 'Keep this discovery.');
  assert.deepEqual(channels(ui), before, 'resuming adds no operations, loads, or checkpoint requests');
  assert.deepEqual(ui.eng.captureState(), world);
});

test('resume is inert without readiness, a pending experiment, or a healthy engine', t => {
  for (const [name, prepare] of [
    ['module missing', ui => { ui.M = undefined; }],
    ['not ready', ui => { ui.state.ready = false; }],
    ['engine failed', ui => { ui.state.engineError = 'Simulation stopped.'; }],
    ['no current experiment', ui => { ui.state.experiment = null; }],
    ['already complete', ui => { ui.known.add(recipe(0).goal); }],
  ]) {
    const { ui } = component(t);
    ui.pinExperiment(recipe(0).goal);
    ui.setState({ brush: E.SAND, tool: 'cool', folio: true, sheet: 'options' });
    prepare(ui);
    const before = plain(ui.state), queued = channels(ui);
    assert.doesNotThrow(() => ui.resumeExperiment(), name);
    assert.deepEqual(plain(ui.state), before, name);
    assert.deepEqual(channels(ui), queued, name);
    if (name !== 'already complete') assert.equal(ui.renderVals().experimentVisible, false, name);
  }
});

test('Codex pin actions exist only for undiscovered targets in the existing recipe list', t => {
  const { ui } = component(t);
  ui.known.add(recipe(0).goal);
  const order = [...E.STARTER, ...E.TRANSMUTED];
  const goals = new Set(opening.NUDGES.map(n => E[n.goal]));
  const pages = ui.renderVals().pages;
  for (let i = 0; i < order.length; i++) {
    const id = order[i], page = pages[i], eligible = goals.has(id) && !ui.known.has(id);
    assert.equal(!!page.canPin, eligible, E.NAMES[id]);
    if (eligible) {
      assert.equal(typeof page.onPin, 'function', E.NAMES[id]);
      assert.notEqual(page.name, E.NAMES[id], 'unwritten product names remain hidden');
      assert.equal(page.whisper, E.HINTS[id] || 'Unwritten.');
    } else assert.notEqual(typeof page.onPin, 'function', E.NAMES[id] + ' has no pin action');
  }
  pages[order.indexOf(recipe(3).goal)].onPin();
  checkExperiment(ui, recipe(3));
  ui.opening = undefined;
  assert.ok(ui.renderVals().pages.every(page => !page.canPin), 'recipes must be available before offering pins');
});