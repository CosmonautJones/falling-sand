import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');
const L = E.CLIMATE.spell, SEASON = L * E.CLIMATE.seasonSpells, YEAR = SEASON * 4;

function engineAt(seed, tick, options = {}) {
  const e = E.createEngine({ seed, scene: 'empty', ambientEmbers: false, ...options });
  const cp = e.checkpoint(); cp.tick = cp.state.tickIndex = tick; e.restore(cp);
  return e;
}
const findSpell = (seed, season, level) => { for (let k = 2; k < 400; k++) if (E.seasonOf(k) === season && E.climateLevel(seed, k) === level && E.climateLevel(seed, k - 1) === level) return k; return -1; };

// ---------- the calendar ----------
test('a year is four seasons of three spells, sixteen minutes at 1x, and it opens in spring', () => {
  assert.deepEqual([...E.SEASONS], ['spring', 'summer', 'autumn', 'winter']);
  assert.equal(YEAR, 16 * 60 * 60, 'sixteen minutes of 60 Hz ticks');
  assert.equal(E.seasonAt(0), 0);
  assert.equal(E.seasonAt(SEASON - 1), 0);
  assert.equal(E.seasonAt(SEASON), 1);
  assert.equal(E.seasonAt(3 * SEASON), 3);
  assert.equal(E.seasonAt(YEAR), 0, 'the year wraps back to spring');
});

test('each season brings its own weather: no cold in summer, no warmth in winter, winter mostly cold', () => {
  const n = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let seed = 1; seed < 300; seed++) for (let k = 2; k < 120; k++) n[E.seasonOf(k)][E.climateLevel(Math.imul(seed, 2654435761) >>> 0, k) + 1]++;
  const share = (s, kind) => n[s][kind + 1] / (n[s][0] + n[s][1] + n[s][2]);
  assert.equal(share(1, -1), 0, 'summer never snaps cold');
  assert.equal(share(3, 1), 0, 'winter never turns warm');
  assert.ok(share(3, -1) > 0.4 && share(3, -1) < 0.6, `winter is about half cold snaps (${share(3, -1).toFixed(2)})`);
  assert.ok(share(1, 1) > 0.4 && share(1, 1) < 0.6, `summer is about half warm spells (${share(1, 1).toFixed(2)})`);
  assert.ok(share(0, -1) < 0.2 && share(2, -1) > share(0, -1), 'autumn is colder than spring');
  for (let k = 0; k < E.CLIMATE.calmSpells; k++) assert.equal(E.climateLevel(12345, k), 0, 'the opening stays calm');
});

// ---------- the forecast ----------
test('the almanac forecasts the next spell inside the omen window and nowhere else', () => {
  let checked = 0;
  for (let k = 2; k < 60; k++) {
    const now = E.climateLevel(7, k), next = E.climateLevel(7, k + 1), start = (k + 1) * L;
    const before = E.almanac(7, start - E.CLIMATE.omenLead - 1), inside = E.almanac(7, start - E.CLIMATE.omenLead), late = E.almanac(7, start - 1);
    assert.equal(before.omen, 0, 'no omen before the window');
    const expected = next !== now && next !== 0 ? next : 0;
    assert.equal(inside.omen, expected); assert.equal(late.omen, expected);
    assert.equal(inside.next, next); assert.equal(inside.now, now);
    assert.equal(late.spellLeft, 1);
    if (expected) checked++;
  }
  assert.ok(checked > 5, 'the seed has several omens to check');
  const a = E.almanac(7, SEASON + 100);
  assert.equal(a.season, 1); assert.equal(a.seasonLeft, SEASON - 100); assert.equal(a.year, 0);
  assert.ok(Math.abs(a.yearPhase - (SEASON + 100) / YEAR) < 1e-9);
});

test('the engine announces omens forty seconds ahead and each new season as it turns', () => {
  const k = (() => { for (let j = 2; j < 200; j++) if (E.climateLevel(4, j + 1) === -1 && E.climateLevel(4, j) !== -1) return j; return -1; })();
  assert.ok(k > 0);
  const e = engineAt(4, (k + 1) * L - E.CLIMATE.omenLead - 5);
  const events = e.advanceTicks(20);
  assert.deepEqual(events.filter(ev => ev.t === 'omen'), [{ t: 'omen', v: -1 }]);
  const s = engineAt(4, SEASON * 3 - 3);
  const turn = s.advanceTicks(10).filter(ev => ev.t === 'season');
  assert.deepEqual(turn, [{ t: 'season', v: 3 }], 'winter is announced');
  const frame = s.tick({ dt: 1000 / 60, speed: 1 }, ...Array.from({ length: 3 }, () => new Uint8Array(E.N * 4)));
  assert.equal(frame.almanac.season, 3, 'frames carry the almanac to the page');
});

test('seasons and omens replay exactly from a checkpoint and are off where weather is off', () => {
  const a = engineAt(9, SEASON * 3 - 200), w = a.inspect();
  for (let y = 230; y < 260; y++) for (let x = 120; x < 260; x++) w.setc(x, y, E.WATER, 0);
  a.advanceTicks(100);
  const b = E.createEngine({ seed: 9, scene: 'empty', ambientEmbers: false }); b.restore(a.checkpoint());
  const ea = a.advanceTicks(400), eb = b.advanceTicks(400);
  assert.deepEqual(ea, eb);
  assert.equal(fingerprint(a.captureState()), fingerprint(b.captureState()));
  const calm = engineAt(9, SEASON * 3 - 3, { weather: false });
  assert.ok(!calm.advanceTicks(10).some(ev => ev.t === 'season' || ev.t === 'omen'));
  const frame = calm.tick({ dt: 1000 / 60, speed: 1 }, ...Array.from({ length: 3 }, () => new Uint8Array(E.N * 4)));
  assert.equal(frame.almanac, null);
});

// ---------- what the seasons do ----------
test('gardens grow fastest in spring and slowly in winter', () => {
  const grow = tick => {
    const e = engineAt(5, tick), w = e.inspect();
    for (let x = 0; x < 480; x++) for (let y = 260; y < 270; y++) w.setc(x, y, E.STONE, 0);
    for (let y = 250; y < 260; y++) for (let x = 100; x < 380; x++) w.setc(x, y, E.MUD, 0);
    for (let y = 247; y < 250; y++) for (let x = 100; x < 380; x++) w.setc(x, y, E.WATER, 0);
    for (let x = 110; x < 380; x += 30) w.setc(x, 246, E.SEED, 0);
    e.advanceTicks(60 * 25);
    return w.cells.reduce((n, c) => n + (c === E.PLANT || c === E.BLOOM), 0);
  };
  const spring = findSpell(5, 0, 0), winter = findSpell(5, 3, 0);
  assert.ok(spring > 0 && winter > 0, 'calm spring and calm winter spells exist');
  const sp = grow(spring * L + 100), wi = grow(winter * L + 100);
  assert.ok(sp > wi * 1.5, `spring garden ${sp} vs winter garden ${wi}`);
  assert.deepEqual([...E.SEASON_LIFE.plantGate], [5, 6, 10, 18]);
});

test('mites slow down for winter', () => {
  const src = readFileSync(new URL('../public/v2/engine/world.js', import.meta.url), 'utf8');
  assert.match(src, /random\.ecology\.int\(\(sKin >= 2 \? 8 : 3\) \* SEASON_LIFE\.miteRest\[season\]\)/);
  assert.equal(E.SEASON_LIFE.miteRest[3], 4, 'four times as idle in winter');
  assert.equal(E.SEASON_LIFE.miteRest[0], 1, 'spring mites are as busy as ever');
});

// ---------- in the page ----------
function pageFns() {
  const start = html.indexOf('const SEASON_NAME'), end = html.indexOf('\n}', html.indexOf('function almanacDial')) + 2;
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(html.slice(start, end) + '\nthis.almanacText = almanacText; this.almanacDial = almanacDial;', ctx);
  return ctx;
}

test('the almanac reads the season and counts down to a coming spell at the current speed', () => {
  const { almanacText, almanacDial } = pageFns();
  const base = { season: 3, seasonLeft: 100, year: 0, yearPhase: 0.8, now: 0, next: -1, spellLeft: 1800, omen: -1 };
  assert.equal(almanacText(base, 1), 'winter · cold snap in 30 s');
  assert.equal(almanacText(base, 2), 'winter · cold snap in 15 s');
  assert.equal(almanacText({ ...base, omen: 0, now: 1, season: 1 }, 1), 'summer · warm spell');
  assert.equal(almanacText({ ...base, omen: 0, season: 0 }, 1), 'spring · calm');
  assert.equal(almanacText(null, 1), '');
  assert.match(almanacDial(base), /^<svg[^>]*>(<path [^>]+\/>){4}<circle /);
});

test('the page shows the almanac, whispers seasons and omens, and frosts or warms the glass', () => {
  assert.match(html, /<span class="almanac" ref="\{\{ almanacRef \}\}"/);
  assert.match(html, /phoneHud\.textContent = `\$\{this\.almanac \? almanacText\(this\.almanac, this\.state\.speed\)/);
  assert.match(html, /case 'season': this\.setState\(\{ whisper: SEASON_WHISPER\[e\.v\]/);
  assert.match(html, /case 'omen': this\.setState\(\{ whisper: OMEN_WHISPER\[e\.v\]/);
  assert.match(html, /<div ref="\{\{ frostRef \}\}" class="omen-frost"/);
  assert.match(html, /<div ref="\{\{ warmRef \}\}" class="omen-warm"/);
  assert.match(html, /this\.almanac = r\.almanac \|\| null;\n\s*this\.paintOmens\(\);/);
  for (const k of ['almanacRef', 'frostRef', 'warmRef']) assert.match(html, new RegExp(`${k}: this\\.${k}`));
});

test('the status lines name the weather once: the almanac replaces the old weather label', () => {
  assert.equal((html.match(/\$\{this\.almanac \? '' : climateLabel\(this\.climate\)\}/g) || []).length, 2);
});
