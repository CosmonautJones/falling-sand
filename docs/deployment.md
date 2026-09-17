# Alcubemy deployment

Alcubemy is an **experimental sandbox**, hosted independently from the portfolio at **https://alcubemy.travisjohnjones.com/**. It is a static Vite build with no application server or account requirement.

## Hosting

- Netlify project: `alcubemy`, in `cosmonautjones`.
- Site ID: `626dc739-26ea-4657-94ed-09374ddab730`.
- Dashboard: https://app.netlify.com/projects/alcubemy
- Default address: https://alcubemy.netlify.app
- Primary domain: https://alcubemy.travisjohnjones.com
- HTTPS is enforced. The existing Netlify DNS zone supplies the subdomain; the portfolio's root/www records are unchanged.
- `netlify.toml`: Node 22, `npm run build`, publish `dist`.

The first deployment on September 17, 2026 was built from a clean `git archive` of `a18d5f203486a56620f4a198562b98adc6f146d4`. Netlify deploy `6aabd41bb61a4e15defe3b9b` reached `ready`. The upload excluded local council notes, dependencies and QA artifacts. Source uploads do not populate Netlify's `commit_ref`; record the Git SHA alongside the deploy ID.

## Updating the game

The experimental source currently lives on `codex/living-retort`. Use only a verified commit, and deploy a clean source export through the authenticated Netlify connector, or publish a local build with the official CLI:

```sh
npm ci
npm test -- --maxWorkers=1 --minWorkers=1
npm run lint
npm run build
npx netlify-cli deploy --prod --dir=dist --site=626dc739-26ea-4657-94ed-09374ddab730
```

The CLI requires a separate Netlify login. Connector authentication does not imply a local CLI login. Never upload the workspace root as static content. `dist/` is the publish directory; opening its HTML directly from the filesystem is unsupported.

Continuous Git deployment is linked to `CosmonautJones/falling-sand`, production branch `codex/living-retort`, using the existing GitHub app permissions. Pushing that branch triggers a Netlify build with the settings above. Check both GitHub CI and the Netlify deploy before calling an update released; they run independently. Switch production to `main` only after the reviewed changes land. The manual command above is a fallback, not the normal update path.

## Publication checks

Verify the deployed origin, bundle, favicon, manifest and share card. Canonical, Open Graph and Twitter image URLs use the primary HTTPS origin. The portfolio entry belongs in the separate `CosmonautJones/Portfolio` repository and links directly to the game; its artwork comes from `public/share.png`.

DNS can take time to reach every resolver. On initial setup Google's DNS-over-HTTPS resolver returned the Netlify addresses and an HTTPS request to those addresses with the correct host returned 200; the local resolver still cached a lookup failure. Do not disable TLS checks to work around propagation.

See [release QA](release-qa.md) for browser evidence and remaining native/physical-device checks. Do not describe the experimental release as certified on mobile Safari, hardware RTX, or finished living construction.
