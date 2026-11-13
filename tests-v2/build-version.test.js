import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildCommit, buildInfo, buildInfoScript } from '../scripts/build-info.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const v2 = read('../public/v2/index.html');
const dcScript = v2.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];

// Run the generated build-info.js against a stand-in DOM and report what it showed.
function runStamp(info, nodes = []) {
  const logged = [];
  const context = {
    console: { info: (...args) => logged.push(args.join(' ')) },
    document: { readyState: 'complete', querySelectorAll: sel => (sel === '[data-build-label]' ? nodes : []) },
  };
  vm.createContext(context);
  vm.runInContext(buildInfoScript(info), context);
  return { build: context.ALCUBEMY_BUILD, logged };
}

// The V2 component, as pinned-experiment.test.js builds it, with or without a build stamp loaded.
function v2Component(t, build) {
  const values = new Map();
  const context = {
    DCLogic: class {
      constructor() { this.props = {}; }
      setState(value, done) { Object.assign(this.state, value); done?.(); }
    },
    React: { createRef: () => ({ current: null }) },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    performance, console, Uint8Array, Float32Array, ArrayBuffer, Blob, Response, btoa, atob, URL,
    location: { href: 'https://example.test/v2/', hash: '' }, navigator: {},
    setTimeout: () => 0, clearTimeout() {}, cancelAnimationFrame() {},
  };
  if (build) context.ALCUBEMY_BUILD = build;
  vm.createContext(context);
  vm.runInContext(dcScript + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  t.after(() => ui.componentWillUnmount());
  return ui;
}

test('the build stamp carries the package.json version', () => {
  const info = buildInfo({});
  assert.equal(info.version, pkg.version);
  assert.equal(info.commit, '');
  assert.equal(info.label, `v${pkg.version}`);
});

test('the short commit comes from Netlify or GitHub Actions and is ignored when absent or malformed', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(buildCommit({ COMMIT_REF: sha }), '0123456');
  assert.equal(buildCommit({ GITHUB_SHA: sha.toUpperCase() }), '0123456');
  assert.equal(buildCommit({ COMMIT_REF: 'fedcba9876', GITHUB_SHA: sha }), 'fedcba9', 'Netlify wins on Netlify');
  assert.equal(buildCommit({}), '');
  assert.equal(buildCommit({ COMMIT_REF: 'HEAD' }), '');
  assert.equal(buildInfo({ COMMIT_REF: sha }).label, `v${pkg.version} · 0123456`);
});

test('build-info.js fills every label slot and logs the build once', () => {
  const nodes = [{}, {}];
  const { build, logged } = runStamp(buildInfo({}), nodes);
  assert.equal(build.label, `v${pkg.version}`);
  for (const node of nodes) assert.equal(node.textContent, `v${pkg.version}`);
  assert.deepEqual(logged, [`Alcubemy v${pkg.version}`]);
});

test('V2 loads the stamp before its component and shows it in More and in the phone Options sheet', t => {
  assert.ok(v2.indexOf('<script src="../build-info.js"></script>') > 0, 'V2 loads ../build-info.js');
  assert.ok(v2.indexOf('../build-info.js') < v2.indexOf('data-dc-script'), 'stamp loads before the component');
  const markup = v2.slice(0, v2.indexOf('<script type="text/x-dc"'));
  const more = markup.slice(markup.indexOf('class="more-panel"'), markup.indexOf('</details>', markup.indexOf('class="more-panel"')));
  const options = markup.slice(markup.indexOf('data-sheet="options"'));
  assert.match(more, /<span class="build-label"[^>]*>\{\{ buildLabel \}\}<\/span>/);
  assert.match(options, /<div class="sheet-label">Version <span class="build-label"[^>]*>\{\{ buildLabel \}\}<\/span>/);

  const { build } = runStamp(buildInfo({}));
  assert.equal(v2Component(t, build).renderVals().buildLabel, `v${pkg.version}`);
  assert.equal(v2Component(t, null).renderVals().buildLabel, '', 'no stamp, no label');
});

test('Matter Lab and Waterworks load the stamp and have a label slot', () => {
  for (const page of ['../public/v2/lab/index.html', '../public/v2/catch/index.html']) {
    const html = read(page);
    assert.ok(html.includes('<script src="../../build-info.js"></script>'), page);
    assert.match(html, /class="build-label" data-build-label><\/(span|p)>/, page);
  }
});
