import * as E from '../engine/world.js';
import { encodeCheckpoint, decodeCheckpoint, MAX_CHECKPOINT_BYTES } from '../engine/checkpoint.js';
import { createLabRenderer } from './render.js';
import { builtInBlueprints, validateBlueprint, transformBlueprint, placeBlueprint, captureBlueprint, createSetup } from './blueprints.js';

const $ = id => document.getElementById(id);
const world = E.createWorld({ scene: 'empty', seed: 0xabad1dea, ambientEmbers: false, weather: false });
const renderer = createLabRenderer($('world')), overlay = $('overlay'), pen = overlay.getContext('2d');
const savedKey = 'alembic-lab-blueprints-v1';
let running = true, speed = 1, lens = 'natural', tool = 'paint', selected = E.SAND, brush = 6;
let hover = null, pointer = null, captureStart = null, captureEnd = null;
let placement = null, placementId = null, turns = 0, mirrored = false, pendingCapture = null;
let tab = 'materials', filter = 'All', orbit = false, gravityAngle = 90, gravityStrength = 1;
let undo = [], custom = [], accumulator = 0, lastTime = 0, renderTime = 0, tickCount = 0, sampleTime = 0, statusTimer = null;
let keyboardCursor = { x: E.W >> 1, y: E.H >> 1 };
const builtins = builtInBlueprints();
const descriptions = {
  sand: 'Loose grains. Build dunes or bury a structure.', water: 'Pour, pool, freeze, boil. Try it on lava.', stone: 'Build a foundation. Cut it free to send it falling.',
  fire: 'Light fuel, wake a fuse, or burn a path.', oil: 'Floats on water and feeds a fire.', wood: 'Build a beam, then put its strength to the test.',
  'liquid nitrogen': 'A cryogenic liquid. Chills its neighbors and boils away.', nitrogen: 'Gas left behind as liquid nitrogen warms.',
  copper: 'A fast heat conductor. Compare it with aerogel in the Heat lens.', steel: 'A dense structural metal for walls and beams.',
  helium: 'A light, buoyant gas. Zero gravity changes its journey.', tungsten: 'A very dense, heat-resistant metal.',
  ferrofluid: 'A magnetic liquid. Place a magnet and watch it gather.', magnet: 'Pulls nearby ferrofluid. Build a magnetic fountain.',
  aerogel: 'An exceptionally light insulating solid.',
  aether: 'Alchemical gas: playful rules, curious reactions.', azoth: 'An alchemical catalyst. Turns nearby lead into gold.', void: 'A fictional hungry darkness. Handle with curiosity.',
  rift: 'A fictional portal material. Reality is flexible here.', plasma: 'A bright energetic material with alchemical behavior.',
  mite: 'A tiny forager. Give it plants and nourishing mud.', minnow: 'A living swimmer. Place it in water.', beetle: 'A terrestrial creature that wanders and forages.', newt: 'A small pond creature. Give it land and water.',
  'c-4': 'A fixed explosive. Light it for a chain reaction.', tnt: 'A compact way to test a building.', fuse: 'Draw a path for fire to follow.',
};
const living = new Set(['plant','seed','moss','wood','mite','minnow','bloom','visitor','fungus','spore','firefly','coral','beetle','newt']);
const exotic = new Set(['aether','azoth','void','rift','plasma','ichor','relic','pearl','cryo','font','ferrofluid','magnet','aerogel','liquid nitrogen','nitrogen','helium','tungsten','copper','steel']);
const energy = new Set(['fire','lava','ember','powder','tnt','nitro','napalm','methane','c-4','fuse','plasma']);
const label = name => name ? name[0].toUpperCase() + name.slice(1) : '';
const rgb = m => `rgb(${E.COLORS[m].join(',')})`;

function announce(message, error = false) {
  $('status').textContent = message;
  $('status').className = `status visible${error ? ' error' : ''}`;
  clearTimeout(statusTimer); statusTimer = setTimeout(() => $('status').classList.remove('visible'), error ? 7000 : 4200);
}
function safe(action) { try { return action(); } catch (error) { announce(error.message || 'That action could not be completed.', true); } }
function remember() { undo.push(world.captureState()); if (undo.length > 4) undo.shift(); $('undo').disabled = false; }
function setRunning(value) {
  running = value; accumulator = 0;
  $('play').textContent = running ? 'Pause' : 'Play'; $('play').setAttribute('aria-pressed', String(!running));
  $('paused-label').hidden = running;
}
function syncGravity() {
  const g = world.getGravity(); gravityStrength = Math.hypot(g.x, g.y);
  if (gravityStrength > .00001) gravityAngle = ((Math.atan2(g.y, g.x) * 180 / Math.PI) + 360) % 360;
  $('gravity-strength').value = String(gravityStrength); $('gravity-angle').value = String(gravityAngle);
  const direction = gravityStrength < .001 ? 'Weightless' : gravityAngle >= 45 && gravityAngle < 135 ? 'Down' : gravityAngle >= 135 && gravityAngle < 225 ? 'Left' : gravityAngle >= 225 && gravityAngle < 315 ? 'Up' : 'Right';
  $('gravity-value').textContent = `${gravityStrength.toFixed(2)} g · ${direction}`;
  $('gravity-readout').textContent = `${gravityStrength.toFixed(2)} g`;
  $('gravity-arrow').textContent = gravityStrength < .001 ? '○' : '↓';
  $('gravity-arrow').style.transform = `rotate(${gravityAngle - 90}deg)`;
}
function setGravity(strength, angle) {
  const radians = angle * Math.PI / 180;
  world.setGravity({ x: Math.cos(radians) * strength, y: Math.sin(radians) * strength });
  syncGravity();
}
function selectTool(next) {
  tool = next; placement = null; placementId = null; captureStart = null; captureEnd = null;
  document.querySelectorAll('[data-tool]').forEach(button => { const yes = button.dataset.tool === next; button.classList.toggle('selected', yes); button.setAttribute('aria-pressed', String(yes)); });
  if (next === 'capture') { setRunning(false); $('hint').textContent = 'Drag a rectangle around your invention. Name and save it in Blueprints.'; }
  else $('hint').textContent = next === 'blast' ? 'Click to blast. Erase a support first to make a structure fall.' : 'Drag to draw. Hold Shift while pouring to throw the grains with your stroke.';
}
function showTab(next, open = true) {
  tab = next;
  for (const name of ['materials', 'blueprints', 'setups']) {
    $(name + '-tab').setAttribute('aria-selected', String(name === next));
    $(name + '-panel').hidden = name !== next;
  }
  if (open) { $('library').classList.add('open'); $('library-toggle').setAttribute('aria-expanded', 'true'); }
}
function closeMobileLibrary() {
  if (matchMedia('(max-width:760px)').matches) { $('library').classList.remove('open'); $('library-toggle').setAttribute('aria-expanded', 'false'); }
}
function selectMaterial(m) {
  selected = m; selectTool('paint');
  $('selected-name').textContent = label(E.NAMES[m]); $('selected-swatch').style.background = rgb(m);
  $('selected-description').textContent = descriptions[E.NAMES[m]] || (E.KIND[m] === 1 ? 'A loose granular material. Try it under changing gravity.' : E.KIND[m] === 2 ? 'A flowing liquid. Mix it with other matter and watch.' : E.KIND[m] === 3 ? 'A drifting gas. Try a change in gravity or temperature.' : 'A structural material. Build, heat, break and experiment.');
  document.querySelectorAll('[data-material]').forEach(button => { const yes = +button.dataset.material === m; button.classList.toggle('selected', yes); button.setAttribute('aria-pressed', String(yes)); });
}
function renderMaterials() {
  const search = $('material-search').value.trim().toLowerCase(), container = $('materials'); container.replaceChildren();
  for (let m = 1; m < E.COUNT; m++) {
    const name = E.NAMES[m];
    const matches = filter === 'All' || filter === 'Everyday' && !living.has(name) && !exotic.has(name) && !energy.has(name) || filter === 'Liquids' && E.KIND[m] === 2 || filter === 'Life' && living.has(name) || filter === 'Exotic' && exotic.has(name) || filter === 'Energy' && energy.has(name);
    if (!matches || !name.includes(search)) continue;
    const button = document.createElement('button'); button.dataset.material = m; button.title = descriptions[name] || label(name); button.setAttribute('aria-pressed', String(m === selected));
    button.classList.toggle('selected', m === selected);
    const swatch = document.createElement('i'); swatch.style.setProperty('--swatch', rgb(m)); const text = document.createElement('span'); text.textContent = name;
    button.append(swatch, text); button.addEventListener('click', () => { selectMaterial(m); closeMobileLibrary(); }); container.append(button);
  }
  $('no-materials').hidden = container.childElementCount !== 0;
}
function thumbnail(blueprint) {
  const canvas = document.createElement('canvas'); canvas.width = blueprint.width; canvas.height = blueprint.height;
  const context = canvas.getContext('2d');
  for (const [x, y, m] of blueprint.cells) { context.fillStyle = rgb(m); context.fillRect(x, y, 1, 1); }
  return canvas;
}
function selectBlueprint(blueprint, id) {
  placement = blueprint; placementId = id; turns = 0; mirrored = false; captureStart = null; captureEnd = null;
  tool = 'blueprint'; document.querySelectorAll('[data-tool]').forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
  $('hint').textContent = `${blueprint.name}: click to place. R rotates, M mirrors, Esc cancels. The whole outline must fit.`;
  $('export-blueprint').disabled = false; closeMobileLibrary(); renderBlueprints();
  $('delete-blueprint').disabled = !id?.startsWith('custom-');
}
function renderBlueprints() {
  const container = $('blueprints'); container.replaceChildren();
  const items = [...builtins, ...custom.map((blueprint, index) => ({ id: `custom-${index}`, blueprint, description: 'Your saved invention. Place, transform or export it.' }))];
  for (const item of items) {
    const button = document.createElement('button'); button.className = 'blueprint-item'; button.classList.toggle('selected', item.id === placementId);
    const text = document.createElement('span'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = item.blueprint.name; small.textContent = item.description; text.append(strong, small); button.append(thumbnail(item.blueprint), text);
    button.addEventListener('click', () => selectBlueprint(item.blueprint, item.id)); container.append(button);
  }
}
function transformed() { return placement ? transformBlueprint(placement, turns, mirrored) : null; }
function placementPosition(point, blueprint) { return { x: Math.round(point.x - blueprint.width / 2), y: Math.round(point.y - blueprint.height / 2) }; }
function captureSelection() {
  if (!captureStart || !captureEnd) return;
  safe(() => {
    pendingCapture = captureBlueprint(world, captureStart.x, captureStart.y, captureEnd.x, captureEnd.y, $('blueprint-name').value.trim() || 'My invention');
    $('save-blueprint').disabled = false; $('export-blueprint').disabled = false; showTab('blueprints');
    announce(`Captured ${pendingCapture.cells.length.toLocaleString()} grains. Name it and save it to your library.`);
  });
}
function act(point, previous = point, fling = false) {
  if (tool === 'blueprint') {
    const blueprint = transformed(), position = placementPosition(point, blueprint);
    placeBlueprint(world, blueprint, position.x, position.y); announce(`Placed ${blueprint.name}.`); return;
  }
  if (tool === 'blast') { world.inspect().detonate(point.x, point.y, Math.max(5, brush * 2)); return; }
  if (tool === 'heat' || tool === 'cool') { world.applyOperations([{ t: tool, x: point.x, y: point.y, r: brush }]); return; }
  const op = { t: 'l', x0: previous.x, y0: previous.y, x1: point.x, y1: point.y, r: brush, m: tool === 'erase' ? E.AIR : selected };
  if (fling && tool === 'paint') { op.vx = Math.max(-6, Math.min(6, (point.x - previous.x) * .3)); op.vy = Math.max(-6, Math.min(6, (point.y - previous.y) * .3)); }
  world.applyOperations([op]);
}
function coordinates(event) {
  const rect = overlay.getBoundingClientRect();
  return { x: Math.max(0, Math.min(E.W - 1, Math.floor((event.clientX - rect.left) * E.W / rect.width))), y: Math.max(0, Math.min(E.H - 1, Math.floor((event.clientY - rect.top) * E.H / rect.height))) };
}
function updateProbe(point) {
  if (!point) return;
  const sim = world.inspect(), i = point.y * E.W + point.x, heat = sim.heat[i], m = sim.cells[i], velocity = Math.hypot(sim.VX[i], sim.VY[i]);
  const temperature = heat < 15 ? 'cryogenic' : heat < 45 ? 'cool' : heat < 90 ? 'warm' : heat < 160 ? 'hot' : 'incandescent';
  $('probe').textContent = `${label(E.NAMES[m])} · ${temperature} (${heat}/255) · ${velocity.toFixed(1)} cells/tick`;
}
function drawOverlay() {
  pen.clearRect(0, 0, E.W, E.H);
  if (captureStart && captureEnd) {
    const x = Math.min(captureStart.x, captureEnd.x), y = Math.min(captureStart.y, captureEnd.y), w = Math.abs(captureStart.x - captureEnd.x) + 1, h = Math.abs(captureStart.y - captureEnd.y) + 1;
    pen.fillStyle = '#b5dfff22'; pen.fillRect(x, y, w, h); pen.strokeStyle = '#b5dfff'; pen.lineWidth = 1; pen.strokeRect(x + .5, y + .5, w, h);
  }
  if (!hover) return;
  if (placement) {
    let blueprint; try { blueprint = transformed(); } catch { return; }
    const p = placementPosition(hover, blueprint), valid = p.x >= 0 && p.y >= 0 && p.x + blueprint.width <= E.W && p.y + blueprint.height <= E.H;
    pen.globalAlpha = .55;
    for (const [x, y, m] of blueprint.cells) { pen.fillStyle = rgb(m); pen.fillRect(p.x + x, p.y + y, 1, 1); }
    pen.globalAlpha = 1; pen.strokeStyle = valid ? '#d0f4d2' : '#ff987d'; pen.lineWidth = 1; pen.strokeRect(p.x + .5, p.y + .5, blueprint.width, blueprint.height);
  } else if (tool !== 'capture') {
    pen.beginPath(); pen.arc(hover.x + .5, hover.y + .5, tool === 'blast' ? Math.max(5, brush * 2) : brush, 0, Math.PI * 2);
    pen.strokeStyle = tool === 'blast' || tool === 'heat' ? '#ffb697' : tool === 'cool' ? '#a0e7ff' : '#e6eef3aa'; pen.lineWidth = .7; pen.stroke();
  }
}

overlay.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer !== null) return;
  if (event.pointerType === 'mouse') event.preventDefault();
  overlay.focus({ preventScroll: true }); pointer = event.pointerId; overlay.setPointerCapture(pointer);
  hover = coordinates(event); keyboardCursor = hover;
  if (tool === 'capture') { captureStart = hover; captureEnd = hover; }
  else safe(() => { remember(); act(hover, hover, event.shiftKey); });
});
overlay.addEventListener('pointermove', event => {
  const next = coordinates(event); updateProbe(next);
  if (pointer === event.pointerId) {
    if (tool === 'capture') captureEnd = next;
    else if (tool !== 'blueprint' && tool !== 'blast') safe(() => act(next, hover || next, event.shiftKey));
  }
  hover = next; keyboardCursor = next;
});
function releasePointer(event) {
  if (pointer !== event.pointerId) return;
  if (tool === 'capture' && event.type !== 'pointercancel') captureSelection();
  if (overlay.hasPointerCapture(pointer)) overlay.releasePointerCapture(pointer);
  pointer = null;
}
overlay.addEventListener('pointerup', releasePointer); overlay.addEventListener('pointercancel', releasePointer);
overlay.addEventListener('lostpointercapture', () => { pointer = null; });
overlay.addEventListener('pointerleave', () => { if (pointer === null) hover = null; });
overlay.addEventListener('contextmenu', event => event.preventDefault());
document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => selectTool(button.dataset.tool)));
$('brush').addEventListener('input', () => { brush = +$('brush').value; $('brush-value').textContent = brush; });
$('play').addEventListener('click', () => setRunning(!running));
$('step').addEventListener('click', () => { setRunning(false); world.step(); });
$('speed').addEventListener('change', () => { speed = +$('speed').value; });
$('lens').addEventListener('change', () => { lens = $('lens').value; });
$('undo').addEventListener('click', () => safe(() => {
  if (!undo.length) return;
  world.restore(undo.pop()); syncGravity(); $('undo').disabled = !undo.length; announce('Restored the world before your last edit.');
}));
for (const input of [$('gravity-strength'), $('gravity-angle')]) {
  input.addEventListener('pointerdown', remember, { passive: true });
  input.addEventListener('input', () => safe(() => setGravity(+$('gravity-strength').value, +$('gravity-angle').value)));
}
document.querySelectorAll('[data-gravity]').forEach(button => button.addEventListener('click', () => safe(() => {
  remember(); const preset = button.dataset.gravity;
  if (preset === 'earth') setGravity(1, 90); else if (preset === 'moon') setGravity(.165, 90); else if (preset === 'zero') setGravity(0, gravityAngle); else setGravity(gravityStrength || 1, (gravityAngle + 180) % 360);
})));
$('gravity-spin').addEventListener('click', () => { orbit = !orbit; $('gravity-spin').setAttribute('aria-pressed', String(orbit)); $('gravity-spin').classList.toggle('selected', orbit); });
$('library-toggle').addEventListener('click', () => { const open = $('library').classList.toggle('open'); $('library-toggle').setAttribute('aria-expanded', String(open)); if (open) $('library').scrollIntoView({ block: 'nearest', behavior: 'instant' }); });
for (const name of ['materials', 'blueprints', 'setups']) $(name + '-tab').addEventListener('click', () => showTab(name));
$('material-search').addEventListener('input', renderMaterials);
for (const name of ['All', 'Everyday', 'Liquids', 'Life', 'Exotic', 'Energy']) {
  const button = document.createElement('button'); button.textContent = name; button.classList.toggle('selected', name === filter); button.setAttribute('aria-pressed', String(name === filter));
  button.addEventListener('click', () => { filter = name; for (const b of $('categories').children) { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); } renderMaterials(); }); $('categories').append(button);
}
function rotatePlacement() { if (placement) safe(() => { transformBlueprint(placement, turns + 1, mirrored); turns = (turns + 1) % 4; }); }
function mirrorPlacement() { if (placement) mirrored = !mirrored; }
$('rotate').addEventListener('click', rotatePlacement); $('mirror').addEventListener('click', mirrorPlacement);
$('cancel-placement').addEventListener('click', () => { selectTool('paint'); renderBlueprints(); });
function saveCapture() {
  if (!pendingCapture) return;
  const blueprint = validateBlueprint({ ...pendingCapture, name: $('blueprint-name').value.trim() || pendingCapture.name });
  if (custom.length >= 12) throw new Error('Your library has 12 captures. Export and delete a saved blueprint to make room.');
  const next = [...custom, blueprint], serialized = JSON.stringify(next);
  if (serialized.length > 1_500_000) throw new Error('Your blueprint library is full. Export this capture as a file instead.');
  try { localStorage.setItem(savedKey, serialized); } catch { throw new Error('Browser storage is full or unavailable. Export your blueprint instead.'); }
  custom = next; pendingCapture = null; $('save-blueprint').disabled = true; selectBlueprint(blueprint, `custom-${custom.length - 1}`); announce('Blueprint saved in this browser.');
}
$('save-blueprint').addEventListener('click', () => safe(saveCapture));
// A touch release can dismiss the name field without producing a compatibility click.
// Clearing pendingCapture inside saveCapture also makes a subsequent click harmless.
$('save-blueprint').addEventListener('pointerup', event => { if (event.pointerType === 'touch' && event.isPrimary) safe(saveCapture); });
$('delete-blueprint').addEventListener('click', () => safe(() => {
  if (!placementId?.startsWith('custom-')) return;
  const index = Number(placementId.slice(7));
  const next = custom.filter((_, i) => i !== index);
  localStorage.setItem(savedKey, JSON.stringify(next)); custom = next;
  selectTool('paint'); $('delete-blueprint').disabled = true; renderBlueprints(); announce('Saved blueprint deleted. Existing grains in the vessel are unchanged.');
}));
function download(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('export-blueprint').addEventListener('click', () => safe(() => {
  const blueprint = pendingCapture || transformed();
  if (!blueprint) throw new Error('Select or capture a blueprint first.');
  const out = validateBlueprint({ ...blueprint, name: pendingCapture ? $('blueprint-name').value.trim() || blueprint.name : blueprint.name });
  download(out, `${out.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.blueprint.json`); announce('Blueprint exported.');
}));
document.querySelectorAll('[data-setup]').forEach(button => button.addEventListener('click', () => safe(() => {
  remember(); createSetup(world, button.dataset.setup); selectTool('paint'); syncGravity(); $('scene-label').textContent = button.querySelector('strong').textContent;
  closeMobileLibrary(); announce('Setup loaded. Undo restores your previous world.');
})));
$('clear-world').addEventListener('click', () => safe(() => { remember(); world.applyOperations([{ t: 'clear' }]); $('scene-label').textContent = 'Your experiment'; announce('Vessel cleared. Undo brings it back.'); }));
function checkpoint() {
  const state = world.captureState();
  return encodeCheckpoint({ format: 'alembic-world', version: 1, width: E.W, height: E.H, tick: state.tickIndex, state });
}
function restoreCheckpoint(value) {
  const decoded = decodeCheckpoint(value); remember(); world.restore(decoded.state); if (!decoded.state.gravity) world.setGravity({ x: 0, y: 1 });
  orbit = false; $('gravity-spin').setAttribute('aria-pressed', 'false'); $('gravity-spin').classList.remove('selected');
  syncGravity(); selectTool('paint'); $('scene-label').textContent = 'Restored experiment';
}
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alembic-matter-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('worlds');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Browser storage is unavailable. Export your world instead.'));
  });
}
async function storedWorld(write) {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const transaction = db.transaction('worlds', write === undefined ? 'readonly' : 'readwrite'), store = transaction.objectStore('worlds');
    const request = write === undefined ? store.get('current') : store.put(write, 'current');
    let result; request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result); transaction.onerror = transaction.onabort = () => reject(new Error('Could not access the saved world. Export a file to keep your experiment.'));
  }); } finally { db.close(); }
}
$('save-world').addEventListener('click', async () => {
  try { const save = checkpoint(); await storedWorld(save); announce('World saved in this browser, including gravity and particle motion.'); } catch (error) { announce(error.message, true); }
});
$('load-world').addEventListener('click', async () => {
  try { const save = await storedWorld(); if (!save) throw new Error('No saved world yet. Use Save world first.'); restoreCheckpoint(save); announce('Saved world restored.'); } catch (error) { announce(error.message, true); }
});
$('export-world').addEventListener('click', () => safe(() => { download(checkpoint(), 'alembic-matter-lab.world.json'); announce('World exported with its exact particle state.'); }));
$('import-file').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async () => {
  const file = $('file-input').files[0]; $('file-input').value = ''; if (!file) return;
  try {
    if (file.size > MAX_CHECKPOINT_BYTES) throw new Error('Files must be smaller than 16 MB.');
    const value = JSON.parse(await file.text());
    if (value?.format === 'alembic-blueprint') {
      pendingCapture = validateBlueprint(value); $('blueprint-name').value = pendingCapture.name; $('save-blueprint').disabled = false;
      selectBlueprint(pendingCapture, 'imported'); showTab('blueprints'); announce('Blueprint imported. Place it, or save it to your library.');
    } else { restoreCheckpoint(value); announce('World imported. Undo restores your previous experiment.'); }
  } catch (error) { announce(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message, true); }
});
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea') || $('help-dialog').open) return;
  const key = event.key.toLowerCase();
  if (key === ' ') { event.preventDefault(); setRunning(!running); }
  else if ({ p: 'paint', e: 'erase', h: 'heat', c: 'cool', b: 'blast', x: 'capture' }[key]) selectTool({ p: 'paint', e: 'erase', h: 'heat', c: 'cool', b: 'blast', x: 'capture' }[key]);
  else if (key === 'r') rotatePlacement(); else if (key === 'm') mirrorPlacement(); else if (key === 'z' && undo.length) $('undo').click();
  else if (key === 'escape') { selectTool('paint'); closeMobileLibrary(); }
  if (event.target !== overlay) return;
  if (event.key.startsWith('Arrow')) {
    event.preventDefault(); const amount = event.shiftKey ? 12 : 2;
    keyboardCursor.x = Math.max(0, Math.min(E.W - 1, keyboardCursor.x + (key === 'arrowright' ? amount : key === 'arrowleft' ? -amount : 0)));
    keyboardCursor.y = Math.max(0, Math.min(E.H - 1, keyboardCursor.y + (key === 'arrowdown' ? amount : key === 'arrowup' ? -amount : 0)));
    hover = { ...keyboardCursor }; if (tool === 'capture' && captureStart) captureEnd = hover; updateProbe(hover);
  } else if (key === 'enter') {
    event.preventDefault(); hover = { ...keyboardCursor };
    if (tool === 'capture') { if (!captureStart) { captureStart = hover; captureEnd = hover; } else { captureEnd = hover; captureSelection(); captureStart = null; } }
    else safe(() => { remember(); act(hover); });
  }
});
document.addEventListener('visibilitychange', () => { accumulator = 0; lastTime = 0; pointer = null; });
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pagehide', event => { if (!event.persisted) renderer.dispose(); });

try {
  const raw = localStorage.getItem(savedKey);
  if (raw && raw.length <= 1_500_000) { const values = JSON.parse(raw); if (Array.isArray(values) && values.length <= 12) custom = values.map(validateBlueprint); }
} catch { announce('Saved blueprints could not be read. You can still import an exported file.', true); }
createSetup(world, 'chaos'); syncGravity(); renderMaterials(); renderBlueprints(); selectMaterial(E.SAND);
$('hint').textContent = 'Try Blast on the bridge, or Reverse gravity. Cut a structure loose and watch it fall together.';
renderer.resize();
function frame(now) {
  if (!lastTime) lastTime = now;
  const elapsed = Math.min(100, now - lastTime); lastTime = now;
  if (!document.hidden && running) {
    accumulator = Math.min(accumulator + elapsed * speed, 100);
    let steps = 0;
    while (accumulator >= 1000 / 60 && steps < 4) {
      if (pointer !== null && hover && !['capture', 'blueprint', 'blast'].includes(tool)) act(hover);
      if (orbit) setGravity(gravityStrength || 1, (gravityAngle + .3) % 360);
      world.step(); accumulator -= 1000 / 60; steps++; tickCount++;
    }
  }
  if (!document.hidden && now - renderTime >= 1000 / 30) {
    renderer.render(world, { lens, time: now / 1000 }); drawOverlay(); renderTime = now;
    if (now - sampleTime > 1000) { $('performance').textContent = `${Math.round(tickCount * 1000 / Math.max(1, now - sampleTime))} ticks/s`; sampleTime = now; tickCount = 0; if (hover) updateProbe(hover); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
