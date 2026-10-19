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
      setState(value, done) { Object.assign(this.state, value); this.onCommitDOM?.(value); done?.(); }
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

// A small ownerDocument/ref fake models only focus and mounting; production methods stay real.
function focusDOM(ui) {
  const doc = { body: { name: 'body' } }; doc.activeElement = doc.body;
  const calls = [], members = new Set();
  const node = (name, { visible = true, disabled = false } = {}) => ({
    name, ownerDocument: doc, disabled, hidden: !visible, isConnected: true,
    offsetParent: visible ? {} : null,
    getClientRects: () => visible ? [{ width: 20, height: 20 }] : [],
    focus() { assert.equal(this.isConnected, true, name + ' must be mounted before focus'); calls.push(name); doc.activeElement = this; },
  });
  const root = node('root'), card = node('card'), pour = node('pour'), codex = node('completed codex'),
    dismiss = node('dismiss'), outside = node('outside');
  const dom = { doc, calls, node, root, card, pour, codex, dismiss, outside, candidates: [] };
  root.querySelectorAll = () => dom.candidates;
  card.contains = element => element === card || members.has(element);
  for (const key of ['experimentRef', 'experimentPourRef', 'experimentCodexRef']) ui[key] ??= { current: null };
  ui.rootRef.current = root;
  for (const element of [card, pour, codex, dismiss]) element.isConnected = false;
  dom.mountPending = () => {
    members.clear(); members.add(pour); members.add(dismiss);
    card.isConnected = pour.isConnected = dismiss.isConnected = true;
    ui.experimentRef.current = card; ui.experimentPourRef.current = pour; ui.experimentCodexRef.current = null;
  };
  dom.complete = () => {
    members.delete(pour); members.add(codex); pour.isConnected = false; codex.isConnected = true;
    ui.experimentPourRef.current = null; ui.experimentCodexRef.current = codex;
    if (doc.activeElement === pour) doc.activeElement = doc.body;
  };
  dom.remove = () => {
    const lostFocus = card.contains(doc.activeElement);
    members.clear();
    for (const element of [card, pour, codex, dismiss]) element.isConnected = false;
    ui.experimentRef.current = ui.experimentPourRef.current = ui.experimentCodexRef.current = null;
    if (lostFocus) doc.activeElement = doc.body;
  };
  return dom;
}

test('experiment focus refs exist and are exported before engine readiness', t => {
  const { ui } = component(t, false), rendered = ui.renderVals();
  for (const key of ['experimentRef', 'experimentPourRef', 'experimentCodexRef']) {
    assert.ok(ui[key] && typeof ui[key] === 'object', key + ' is a component ref');
    assert.equal(ui[key].current, null);
    assert.equal(rendered[key], ui[key], key + ' reaches the template');
  }
});

test('manual pin focuses its newly mounted pour action, while automatic nudges leave focus alone', t => {
  for (const manual of [true, false]) {
    const { ui } = component(t), dom = focusDOM(ui), commits = [];
    dom.outside.focus(); dom.calls.length = 0;
    ui.onCommitDOM = value => {
      if (value.experiment) { commits.push('mounted'); dom.mountPending(); }
    };
    if (manual) ui.pinExperiment(recipe(0).goal);
    else ui.nudge();
    assert.deepEqual(commits, ['mounted']);
    if (manual) {
      assert.equal(dom.doc.activeElement, dom.pour);
      assert.deepEqual(dom.calls, ['pour']);
    } else {
      assert.equal(dom.doc.activeElement, dom.outside);
      assert.deepEqual(dom.calls, [], 'an automatic suggestion must not steal focus');
    }
  }
});

test('dismissal restores the first visible enabled control for each layout after card removal', t => {
  for (const layout of ['desktop', 'phone', 'immersive', 'none']) {
    const { ui } = component(t); ui.pinExperiment(recipe(0).goal);
    const dom = focusDOM(ui);
    const disabled = dom.node('disabled', { disabled: true }), hidden = dom.node('hidden', { visible: false });
    const desktop = dom.node('desktop codex', { visible: layout === 'desktop' });
    const phone = dom.node('phone element', { visible: layout === 'phone' });
    const sand = dom.node('sand chip', { visible: layout !== 'none' });
    dom.candidates = [disabled, hidden, desktop, phone, sand];
    dom.mountPending(); dom.dismiss.focus(); dom.calls.length = 0;
    ui.onCommitDOM = value => { if (value.experiment === null) dom.remove(); };
    ui.dismissExperiment();
    const expected = layout === 'desktop' ? desktop : layout === 'phone' ? phone : layout === 'immersive' ? sand : dom.doc.body;
    assert.equal(dom.doc.activeElement, expected, layout);
    assert.deepEqual(dom.calls, layout === 'none' ? [] : [expected.name], layout);
    assert.equal(ui.experimentRef.current, null, 'the card was removed before handoff');
  }
});

test('dismissal preserves outside focus and a new user focus choice during the commit', t => {
  for (const changeDuringCommit of [false, true]) {
    const { ui } = component(t); ui.pinExperiment(recipe(0).goal);
    const dom = focusDOM(ui), fallback = dom.node('fallback');
    dom.candidates = [fallback]; dom.mountPending();
    (changeDuringCommit ? dom.dismiss : dom.outside).focus(); dom.calls.length = 0;
    ui.onCommitDOM = value => {
      if (value.experiment === null) { dom.remove(); if (changeDuringCommit) dom.outside.focus(); }
    };
    ui.dismissExperiment();
    assert.equal(dom.doc.activeElement, dom.outside);
    assert.ok(!dom.calls.includes('fallback'), 'handoff cannot override an intentional focus target');
  }
});

test('normal and quiet completion focus the newly mounted Codex action only after its pour action disappears', t => {
  for (const method of ['revealMany', 'stainQuietly']) {
    const { ui } = component(t), goal = recipe(0).goal; ui.pinExperiment(goal);
    const dom = focusDOM(ui); dom.mountPending(); dom.pour.focus(); dom.calls.length = 0;
    ui.onCommitDOM = value => { if (value.discovered && ui.known.has(goal)) dom.complete(); };
    ui[method]([goal]);
    assert.equal(ui.experimentPourRef.current, null, method);
    assert.equal(ui.experimentCodexRef.current, dom.codex, method);
    assert.equal(dom.doc.activeElement, dom.codex, method);
    assert.deepEqual(dom.calls, ['completed codex'], method);
    assert.equal(ui.renderVals().experimentComplete, true, method);
  }
});

test('completion cannot take outside focus, body focus, a new user target, or an unrelated discovery', t => {
  for (const method of ['revealMany', 'stainQuietly']) for (const scenario of ['outside', 'body', 'new target', 'unrelated']) {
    const { ui } = component(t), goal = recipe(0).goal; ui.pinExperiment(goal);
    const dom = focusDOM(ui); dom.mountPending();
    if (scenario === 'outside') dom.outside.focus();
    else if (scenario !== 'body') dom.pour.focus();
    dom.calls.length = 0;
    ui.onCommitDOM = value => {
      if (value.discovered && ui.known.has(goal)) {
        dom.complete();
        if (scenario === 'new target') dom.outside.focus();
      }
    };
    ui[method]([scenario === 'unrelated' ? E.STEAM : goal]);
    const expected = scenario === 'body' ? dom.doc.body : scenario === 'unrelated' ? dom.pour : dom.outside;
    assert.equal(dom.doc.activeElement, expected, method + ': ' + scenario);
    assert.ok(!dom.calls.includes('completed codex'), method + ': ' + scenario);
  }
});

test('Codex hint references are unique stable ids and retain existing hidden-page hints', t => {
  const { ui } = component(t); ui.known.add(recipe(0).goal);
  const order = [...E.STARTER, ...E.TRANSMUTED], pages = ui.renderVals().pages;
  assert.equal(new Set(pages.map(page => page.hintId)).size, pages.length);
  for (let i = 0; i < order.length; i++) {
    const id = order[i], page = pages[i];
    assert.equal(page.hintId, 'codex-hint-' + id);
    if (ui.known.has(id)) assert.equal(page.whisper, E.PAGES[id].w);
    else {
      assert.equal(page.whisper, E.HINTS[id] || 'Unwritten.');
      assert.notEqual(page.name, E.NAMES[id], 'hint association must not expose a blank product name');
      assert.equal(page.leaf, '');
    }
  }
});


test('manual pin focuses the completed action when its goal becomes known in the same DOM commit', t => {
  const { ui } = component(t), goal = recipe(0).goal, dom = focusDOM(ui);
  assert.equal(ui.known.has(goal), false, 'the manual pin starts with an undiscovered goal');
  dom.outside.focus(); dom.calls.length = 0;
  ui.onCommitDOM = value => {
    if (value.experiment) {
      ui.known.add(goal);
      dom.mountPending();
      dom.complete();
    }
  };
  ui.pinExperiment(goal);
  assert.equal(ui.experimentPourRef.current, null, 'the pending action vanished during this commit');
  assert.equal(ui.experimentCodexRef.current, dom.codex);
  assert.equal(ui.renderVals().experimentComplete, true);
  assert.equal(dom.doc.activeElement, dom.codex);
  assert.deepEqual(dom.calls, ['completed codex'], 'focus waits for the mounted completed action');
});
