// The build stamp every shipped page shows, so the live build can be told apart at a glance.
// The version comes from package.json; the short commit comes from the build host when it
// provides one (Netlify sets COMMIT_REF, GitHub Actions sets GITHUB_SHA). Local builds show the
// version alone.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** The short commit from the build environment, or '' when there is none. */
export function buildCommit(env = process.env) {
  const sha = String(env.COMMIT_REF || env.GITHUB_SHA || '').trim();
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : '';
}

export function buildLabel(version, commit = '') {
  return `v${version}${commit ? ` · ${commit}` : ''}`;
}

export function buildInfo(env = process.env) {
  const version = pkg.version;
  const commit = buildCommit(env);
  return { version, commit, label: buildLabel(version, commit) };
}

// A classic script, so the static pages can load it before their own code runs. It exposes the
// stamp as globalThis.ALCUBEMY_BUILD, fills every [data-build-label] element and logs it once.
export function buildInfoScript(info = buildInfo()) {
  return `/* Alcubemy build stamp, generated at build time from package.json. */
(function () {
  var build = ${JSON.stringify(info)};
  globalThis.ALCUBEMY_BUILD = build;
  console.info('Alcubemy ' + build.label);
  function paint() {
    var nodes = document.querySelectorAll('[data-build-label]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = build.label;
      nodes[i].title = 'Build ' + build.version + (build.commit ? ' (commit ' + build.commit + ')' : '');
    }
  }
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();
`;
}

/** Vite plugin: compile-time constants for src/, and build-info.js for the static pages. */
export function buildInfoPlugin() {
  const info = buildInfo();
  return {
    name: 'alcubemy-build-info',
    config: () => ({
      define: {
        __APP_VERSION__: JSON.stringify(info.version),
        __APP_COMMIT__: JSON.stringify(info.commit),
      },
    }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== '/build-info.js') return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.end(buildInfoScript(info));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.js', source: buildInfoScript(info) });
    },
  };
}
