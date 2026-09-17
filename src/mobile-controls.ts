export const COMPACT_QUERY = '(max-width: 700px), (max-width: 1000px) and (max-height: 500px)';

/** Reuse the same controls in a modal phone drawer and the desktop toolbar. */
export function mountMobileControls(options: {
  toolbar: HTMLElement;
  palette: HTMLElement;
  sizes: HTMLElement;
  tools: HTMLElement;
  pause: HTMLButtonElement;
  cancelGesture: () => void;
}) {
  const el = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing phone control: ${id}`);
    return node as T;
  };
  const compact = window.matchMedia(COMPACT_QUERY);
  const dock = el('mobile-dock');
  const drawer = el<HTMLDialogElement>('control-drawer');
  const brushButton = el<HTMLButtonElement>('brush-menu');
  const moreButton = el<HTMLButtonElement>('more-menu');
  const materialSection = el('drawer-materials');
  const moreSection = el('drawer-more');
  const experiment = el('first-experiment');
  const experimentHome = experiment.parentElement!;
  let opener: HTMLButtonElement | null = null;

  function close() {
    if (drawer.open) drawer.close();
  }
  function open(mode: 'materials' | 'more') {
    options.cancelGesture();
    opener = mode === 'materials' ? brushButton : moreButton;
    materialSection.hidden = mode !== 'materials';
    moreSection.hidden = mode !== 'more';
    el('drawer-title').textContent = mode === 'materials' ? 'Materials & brush' : 'The vessel';
    brushButton.setAttribute('aria-expanded', String(mode === 'materials'));
    moreButton.setAttribute('aria-expanded', String(mode === 'more'));
    drawer.showModal();
  }
  brushButton.addEventListener('click', () => open('materials'));
  moreButton.addEventListener('click', () => open('more'));
  el('drawer-close').addEventListener('click', close);
  drawer.addEventListener('close', () => {
    brushButton.setAttribute('aria-expanded', 'false');
    moreButton.setAttribute('aria-expanded', 'false');
    if (compact.matches && !document.querySelector('dialog[open]'))
      opener?.focus({ preventScroll: true });
  });
  drawer.addEventListener('click', (event) => {
    if (event.target !== drawer) return;
    const r = drawer.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      close();
  });
  options.palette.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) close();
  });
  options.tools.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) close();
  });
  experiment.addEventListener('click', close);

  function arrange() {
    close();
    options.cancelGesture();
    if (compact.matches) {
      el('drawer-palette').append(options.palette);
      el('drawer-sizes').append(options.sizes);
      el('drawer-tools').append(options.tools);
      el('drawer-experiment').append(experiment);
      dock.insertBefore(options.pause, moreButton);
    } else {
      options.toolbar.append(options.palette, options.sizes, options.tools);
      options.tools.prepend(options.pause);
      experimentHome.prepend(experiment);
    }
  }
  compact.addEventListener('change', arrange);
  arrange();
  return {
    compact,
    close,
    get open() {
      return drawer.open;
    },
    syncBrush(name: string, radius: number, color: string) {
      el('brush-current').textContent = name;
      el('brush-radius').textContent = `Size ${radius}`;
      el('brush-swatch').style.background = color;
    },
  };
}
