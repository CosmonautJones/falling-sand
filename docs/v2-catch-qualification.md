# Catch the Pour qualification

The candidate starts at main `1f4a9b3b080ee9760490a87faf0d6e602983e8f5`. Existing V2 physics, the sandbox worker adapter, V3 and workflows are unchanged. The change adds one optional authored challenge and a small sandbox entry/mobile-label change.

## Automated proof

Local Node 22.16.0, using existing installed dependencies copied to E: without installation. Top-level installed versions match the candidate lockfile; the audit is in the external packet.

| Gate | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test -- --maxWorkers=1 --minWorkers=1` | 168 pass |
| `node --test --test-concurrency=1 tests-v2/*.test.js` | 331 pass |
| `node --test --test-concurrency=1 tests-v3/*.test.js` | 37 pass |
| `npm run build` | Pass; existing large original-game bundle warning |
| `git diff --check` | Pass |

The eleven new Node cases cover finite initial state and instance isolation; no-op overlap/protected/OOB placement; atomic budget rejection and preview; invalid/late commands; exact undo; 59/60-tick hold and streak reset; baseline failure; two distinct wins; batching equality; complete retry; and bounded FIFO worker messages/rendering. Tests were added before the implementation and initially failed for the missing challenge module.

Deterministic committed-tick receipts:

| Construction | Stone used | Outcome | Tick | Retained water | Hold |
|---|---:|---|---:|---:|---:|
| None | 0 | Lost | 900 | 1,206 | 0 |
| Cap near left outlet | 16 | Won | 466 | 1,356 | 60 |
| Upstream divider | 78 | Won | 301 | 1,824 | 60 |

The cheaper solution is slower. These are acceptance runs, not benchmark timings or a claim about campaign depth.

## Browser and independent review

Headless desktop Chrome 155.0.8059.82 passed 32 focused checks with isolated fresh browsers per desktop/touch class. The packet includes screenshots, original source SHA-256, and the full check report. Checks cover actual line inputs and budgets, protected placement, atomic rejection, undo, win/lose, exact retry, separate/blocked record storage, sandbox-key sentinels, pause/step, controlled worker runtime error and explicit retry, 320/360px controls and 568px landscape layout. Desktop 1100×760 keeps the vessel and Retry in view.

The runtime fault is an actual exception scheduled inside the worker. It freezes visible state and offers Retry rather than silently replacing the world. Visibility and restored-tab checks dispatch controlled DOM events; they verify the handlers, not native OS background scheduling or a real bfcache navigation.

Council10 independently played the actual worker UI: rejected 231-cell construction; placed 11 cells and refunded all 11; won with the 16-cell cap; and retried to tick zero with the full inventories. The reviewer inspected source and screenshots without implementing or running tests. Final exact-commit review is recorded in the external packet.

Two earlier combined browser runs stopped at mobile Undo. Diagnostic input traces showed touch events reaching the enabled button but no synthesized click, before the application handler. Fresh-mobile-only play passed. An A/B control reproduced the same sequence and recovered the first click by restarting Chrome between desktop and touch emulation. The final harness uses that isolation; failed reports and traces remain in the packet. No product workaround was added for this browser/harness behavior.

## Limits

This is one authored puzzle. The alternatives and creature follow-on are analytical. Physical phones, browser/device diversity, native bfcache/background behavior, sustained sessions and calibrated performance/stress/mobile thermal behavior are unproven. Existing short sandbox performance receipts do not qualify this mode. No merge, deployment or public preview is part of this qualification.
