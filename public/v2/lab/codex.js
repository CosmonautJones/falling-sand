import * as E from '../engine/world.js';
import { MILESTONES, hintFor, pageFor } from './discovery.js';

const starter = new Set(E.STARTER);

const label = id => E.NAMES[id] ? E.NAMES[id][0].toUpperCase() + E.NAMES[id].slice(1) : `Material ${id}`;
const provenance = (id, state) => starter.has(id) ? 'Starter reagent' : state.inherited.has(id) ? 'Carried from V2' : state.supplied.has(id) ? 'Research supply' : state.made.has(id) ? 'Discovered here' : 'Unwritten';

function normaliseState(value) {
  return {
    known: new Set(value.known), made: new Set(value.made), inherited: new Set(value.inherited), supplied: new Set(value.supplied),
    completed: new Set(value.completed), mode: value.mode, next: value.next,
  };
}

export function createCodex({ onSelect = () => {}, onTry = () => {}, onMode = () => {} } = {}) {
  let state = { known: new Set(), made: new Set(), inherited: new Set(), supplied: new Set(), completed: new Set(), mode: 'discovery', next: null }, lastFocus = null, toastTimer = null;
  const root = document;
  const ui = { dialog: root.getElementById('codex-dialog'), button: root.getElementById('codex-button'), milestones: root.getElementById('codex-milestones'), pages: root.getElementById('codex-pages') };
  if (!ui.dialog || !ui.button || !ui.milestones || !ui.pages) throw new Error('Matter Codex markup is missing');
  const progressNodes = () => ({
    progress: root.getElementById('codex-progress'), count: root.getElementById('codex-count'), mode: root.getElementById('codex-mode'), access: root.getElementById('material-access'), next: root.getElementById('next-experiment'), nextText: root.getElementById('next-experiment-text'),
  });
  const pageIds = () => Array.from({ length: E.COUNT - 1 }, (_, i) => i + 1);

  function renderProgress() {
    const n = progressNodes(), total = E.COUNT - 1, discovered = pageIds().filter(id => state.known.has(id)).length;
    if (n.progress) { n.progress.value = discovered; n.progress.max = total; n.progress.setAttribute('aria-label', `${discovered} of ${total} codex pages revealed`); }
    if (n.count) n.count.textContent = `${discovered} / ${total} pages revealed`;
    if (n.mode) n.mode.textContent = state.mode === 'workshop' ? 'Workshop access' : 'Discovery first';
    if (n.access && n.access.value !== state.mode) n.access.value = state.mode;
    if (n.next && n.nextText) {
      const next = state.next;
      n.next.hidden = !next;
      if (next) n.nextText.textContent = next.text || hintFor(next.goal) || 'Try a new combination.';
      const button = n.next?.querySelector('button'); if (button) button.hidden = !next;
    }
  }

  function pageMarkup(id) {
    const known = state.known.has(id), safeId = `codex-page-${id}`, hint = hintFor(id) || E.HINTS[id] || 'A blank page waits for an experiment.';
    if (!known) return `<article class="codex-page codex-page-locked" aria-labelledby="${safeId}"><div class="codex-page-number">${String(id).padStart(2, '0')}</div><h2 id="${safeId}">Unknown reagent</h2><p class="codex-hint">${hint}</p><span class="codex-lock">Discover through a reaction or research milestone.</span></article>`;
    const p = pageFor(id);
    return `<article class="codex-page" data-codex-material="${id}"><div class="codex-page-number">${String(id).padStart(2, '0')}</div><h2 id="${safeId}">${label(id)}</h2><p class="codex-whisper">${p.w || ''}</p><p>${p.l || ''}</p><div class="codex-page-footer"><span>${provenance(id, state)}</span><button type="button" data-codex-pour="${id}">Pour ${label(id)}</button></div></article>`;
  }

  function milestoneMarkup(milestone) {
    const done = state.completed.has(milestone.id), requires = Array.isArray(milestone.requires) ? milestone.requires : [];
    const recorded = requires.filter(id => state.known.has(id)).length;
    const rewardCount = Array.isArray(milestone.rewards) ? milestone.rewards.length : 0;
    const title = done ? (milestone.name || 'Research milestone') : 'Unfinished research';
    const detail = done ? `Supply unlocked · ${rewardCount} new material${rewardCount === 1 ? '' : 's'}` : `${recorded} of ${requires.length} ingredients recorded`;
    const hint = done ? (milestone.hint || 'The laboratory has a new lead.') : (milestone.hint || 'Keep experimenting with the materials you have.');
    return `<article class="codex-milestone${done ? ' complete' : ''}"><div class="codex-milestone-mark" aria-hidden="true">${done ? '✓' : '◇'}</div><div><h2>${title}</h2><p>${detail}</p><span>${hint}</span></div></article>`;
  }

  function renderMilestones() {
    if (!ui.milestones) return;
    ui.milestones.replaceChildren();
    if (!Array.isArray(MILESTONES) || !MILESTONES.length) return;
    ui.milestones.append(document.createRange().createContextualFragment(MILESTONES.map(milestoneMarkup).join('')));
  }

  function renderPages() {
    const focused = document.activeElement?.dataset?.codexPour;
    ui.pages.replaceChildren();
    const fragment = document.createRange().createContextualFragment(pageIds().map(pageMarkup).join(''));
    ui.pages.append(fragment);
    ui.pages.querySelectorAll('[data-codex-pour]').forEach(button => button.addEventListener('click', () => { onSelect(+button.dataset.codexPour); ui.dialog.close(); }));
    if (focused) ui.pages.querySelector(`[data-codex-pour="${focused}"]`)?.focus();
  }

  function render(nextState = state) {
    state = normaliseState(nextState); renderProgress(); renderMilestones();
    if (ui.dialog.open) renderPages();
    return state;
  }

  function open(material) {
    if (!ui.dialog.open) lastFocus = document.activeElement;
    renderPages();
    if (!ui.dialog.open) ui.dialog.showModal();
    if (material != null) ui.dialog.querySelector(`[data-codex-material="${material}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function celebrate(records = []) {
    const fresh = [...new Set(records.map(record => Number(record?.m)).filter(id => id > 0 && id < E.COUNT))];
    if (!fresh.length) return;
    const toast = root.getElementById('codex-toast');
    if (!toast) return;
    const message = toast.querySelector('span');
    if (message) message.textContent = fresh.length === 1 ? `Codex page written: ${label(fresh[0])}` : `${fresh.length} codex pages written`;
    const action = root.getElementById('codex-toast-open');
    toast.classList.add('visible'); toast.setAttribute('aria-hidden', 'false'); toast.removeAttribute('inert'); toast.inert = false; if (action) action.tabIndex = 0;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => {
      if (document.activeElement === action) ui.button.focus();
      toast.classList.remove('visible'); toast.setAttribute('aria-hidden', 'true'); toast.setAttribute('inert', ''); toast.inert = true; if (action) action.tabIndex = -1;
    }, 5200);
  }

  ui.button.addEventListener('click', () => open());
  ui.dialog.addEventListener('close', () => { (lastFocus?.isConnected && !lastFocus.closest('[inert],[hidden]') ? lastFocus : ui.button).focus(); lastFocus = null; });
  const nodes = progressNodes();
  nodes.access?.addEventListener('change', () => { const mode = nodes.access.value === 'workshop' ? 'workshop' : 'discovery'; onMode(mode); render({ ...state, mode }); });
  nodes.next?.querySelector('button')?.addEventListener('click', () => { if (state.next) onTry(state.next); });
  root.getElementById('codex-toast-open')?.addEventListener('click', () => open());
  render();
  return { render, open, isOpen: () => ui.dialog.open, celebrate };
}

