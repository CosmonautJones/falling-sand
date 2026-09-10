# Alcubemy deployment handoff

Recommended destination: a separate Netlify project using `alcubemy.travisjohnjones.com`, linked from the existing portfolio. This is a proposed production address, not a verified live URL. The game builds independently of the portfolio and needs no application server.

## Repository import

1. Sign into the existing Netlify team. Import `CosmonautJones/falling-sand` from GitHub into a **new project**. Do not replace the portfolio project.
2. The package currently lives on `codex/living-retort`. Use that branch for an experimental deployment; switch the production branch to `main` after the reviewed changes land there.
3. `netlify.toml` specifies `npm run build`, publish directory `dist`, and Node 22, matching local validation. Netlify installs the locked npm dependencies before building.
4. Check the assigned Netlify URL first. Verify that the intended public audience can access it; an account configured for private-by-default projects may require a visibility change.
5. Add `alcubemy.travisjohnjones.com` in the new project's domain settings. Follow the DNS record Netlify supplies for that project. Keep the portfolio's root/www records intact. Verify HTTPS at the subdomain.
6. Only after the domain works, set `og:image` and `twitter:image` to the absolute HTTPS share-image URL and add the canonical URL. Rebuild and verify metadata at the deployed origin.

The account connection, project creation, DNS change and production deployment have not been performed by this handoff. No Netlify CLI credential or linked site was found in the current environment. [Netlify repository import instructions](https://docs.netlify.com/start/quickstarts/deploy-from-repository/) and [domain setup guidance](https://docs.netlify.com/manage/domains/get-started-with-domains/) describe the account-side steps.

## Manual build upload

Run `npm ci` and `npm run build`. Upload the contents of `dist` through the existing Netlify account. The local release ZIP, when generated, contains `index.html` at its root alongside `assets/`, icons, manifest and share image. It is a static-host package; opening the HTML directly from a filesystem is not the supported launch path.

## Portfolio entry after the live smoke check

- Title: **Alcubemy**
- Description: **An experimental falling-sand art game. Paint with sand, water, heat and alchemy, then watch the vessel change.**
- Action: **Play Alcubemy**
- Secondary action: source repository on GitHub.
- Image: `public/share.png` from this repository, copied into the portfolio's public assets.
- Tags: TypeScript, Three.js, cellular simulation.
- Status: **Experimental sandbox**. Living construction remains on the roadmap.

Use the actual verified game URL for the card. Do not add a dead Play link while hosting is pending. The existing portfolio is a separate repository and has not been changed by this package.

Before promoting the project, finish the native tab-switch and physical-device checks in [release QA](release-qa.md). Record the deployed commit, live URL and smoke-test result together.
