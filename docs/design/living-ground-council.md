# Living Ground: mathematical design council

Date: 2026-10-05 (America/Detroit). Engine baseline: `18cba1e`.
Status: proposed architecture for review; no engine implementation in this change.

## Decision

Evolve Alembic into a living terrarium while retaining its 480×270 cellular world and phone-first constraints. Use a hybrid model: conservative cell transport for grains, a small separate body system for boulders, and slower resource-funded ecology. Do not promise scientific fidelity or guaranteed survival. Classify each approximation and test its consequences.

Five independent reviews covered granular mechanics, fluid transport, rigid bodies, ecology, and integration/performance. Cross-review reconciled mass ownership and rejected bolting pressure onto the existing density-swap rules. The coordinator selected the staged design below. These are engineering recommendations, not measured performance results or an implemented solver.

## What the current code actually does

`public/v2/alembic-engine-v2.js` has 129,600 cells and 43 material/entity types. A worker advances nominal 60 Hz steps with capped catch-up. It has per-cell velocities, artistic heat, material swap rankings, probabilistic friction/viscosity, and a 60×34 convection field.

Important limits:

- `DENS` is an ordering table; static-material 255 values are not physical densities. `G=.16` has effective cells/tick² units and `MAXV=7` cells/tick units. Low-speed fallback movement is not integrated from velocity, so existing motion does not obey one consistent acceleration model.
- `WP` is a convection projection potential. Liquid motion does not consult it. It cannot be relabeled water pressure.
- Equal-material water cannot swap through a packed reservoir. A pressure force on existing velocities alone will not solve communicating vessels.
- Module-global arrays, RNG, scan parity, weather, and ship state mean two `createEngine()` instances in one realm share state. Clearing the grid does not reset the complete world.
- Snapshots contain cell IDs only. They omit heat, velocities, trails, timers, RNG, and shade-encoded mite cargo. They are scene stamps, not exact checkpoints.
- Census/weather triggers, wipe progression, and some effects are message-driven. Some environmental events can happen while paused. Render batching must not decide ecosystem evolution.
- Plants, wet mud, clouds, and crystals can create biomass or water without resource debit. This suits the existing magical sandbox but is not a closed ecosystem.

Existing tests pass; they do not prove full-state replay, physical fidelity, or phone performance.

## Shared contracts before new physics

### Units

Keep lattice length L = one cell and mechanical time T = one fixed tick (1/60 simulated second). Velocities use L/T and accelerations L/T². Preserve g=.16 initially as a visual calibration, not Earth gravity. Substeps use h=1/n ticks; never apply a whole tick of gravity at every substep.

Introduce positive physical-relative density `rho` independently of material rank; water has rho=1. Mass = rho × represented volume with unit depth. Staticness is a flag. Heat remains a visual index until a separate energy model is deliberately implemented. Do not plug this byte into thermodynamic equations as Celsius or joules.

Ecological quantities use separate explicit units: nutrient-equivalent biomass NU, water inventory WU, usable energy EU, and simulated seconds. Convert tick counts to seconds at subsystem boundaries. NU is not total organism mass; a full chemical mass model would also need carbon and other elements.

### Authoritative state

Each engine owns one WorldState containing grids, bodies, organisms, tick index, scan parity, counters, and independent deterministic RNG streams. Identify every field as attached to a grain, spatial location, organism, or body. Grain metadata moves with transfers; spatial soil resources do not blindly follow swaps.

Simulation commands are ordered and tick-stamped. Rendering has no authority to spawn life or weather. Pausing freezes all simulation events. Define the checkpoint boundary after all updates of tick k commit and before tick k+1 commands apply. Proposed fixed phase order: ordered commands, scheduled events, body proposals/material reservations, ordinary material transport, thermal/reaction updates, due ecology/weather work, ledger validation, then tick commit. Transport epochs and reservations prevent duplicate advancement across phases. Version the phase order as part of the engine contract. Rendering may occur zero or many times between ticks.

Version full checkpoints and save every future-influencing value, including deferred queues and topology revisions. A world checkpoint differs from a complete session snapshot: the latter also saves pending tick-stamped commands and the host accumulator. Compare full state after equal tick counts, not equal wall time. Rebuild derived occupancy and scratch fields only when their deterministic reconstruction is specified.

Use separate random streams for physical decisions, ecology, weather, and visual decoration. Promise deterministic continuation within a documented engine/runtime contract; cross-platform floating-point bit identity requires additional work and tests.

### Transfers and ledgers

Every move is a bounded atomic transaction: validate source, destination, capacity and body ownership; reserve writes; then commit all payloads together. No subsystem may advance the same material twice. Failed moves leave authoritative state unchanged.

For closed, reaction-disabled whole-parcel mechanics tests, constituent inventories must be exact across grids, bodies, organisms and pending transfers. Derived owner masks do not add mass. Fractional-volume fluids later require volume/mass accounting rather than cell counts. Ecosystem nutrient and water inventories must balance within a declared numerical tolerance. Painting, deletion, alchemy, open boundaries and player-created meteors are explicit sources/sinks. Keep a ledger; do not pretend the full magical sandbox conserves matter.

## Granular mechanics

Retain cells rather than assigning a full contact solver to 129,600 particles.

### Integrate motion and retain small displacements

For timestep h in tick units:

    v_new = v + a*h
    residual_new = residual + v_new*h

Consume crossed cell boundaries through bounded swept traversal; preserve fractional residual. Carry residuals with grain metadata. On blocked normal motion, resolve contact and clear blocked residual so stored displacement cannot leak through walls. Two Float32 residual fields cost 1,036,800 bytes before checkpoint copies.

### Dissipate contact energy

For an incoming normal velocity at a static wall, use restitution 0≤e≤1:

    normal_speed_after = -e * normal_speed_before
    tangent_speed_after = sign(vt) * max(0, abs(vt) - mu*(1+e)*abs(vn))

On resting support, kinetic friction reduces tangential speed by at most mu_k*g*h. Settle below a small calibrated threshold. These are simplified contact rules. Test no-force collision energy cannot increase. Density-based gravity sorting must be separate from inertial collision rules; a fast grain must not phase sideways through lighter occupied matter merely because it is heavier.

### Stable slopes and wet cohesion

Estimate slope using a bounded exposed-surface stencil (initially radius 2–4 cells), then allow adjacent avalanching when:

    abs(slope) > mu_static + cohesion_normalized/max(local_depth,1)

Once sliding, stop below a lower dynamic threshold. This hysteresis supports stable piles. It is a Mohr–Coulomb-inspired gameplay rule, not a solved stress field. Unsupported grains still fall. Suspended clumps need explicit bonds or bodies and are deferred.

### Submerged settling

For an exposed grain with local liquid coverage f∈[0,1], fluid density rho_f, particle density rho_p, and estimated water velocity u:

    a_y = g*(1 - f*rho_f/rho_p)
    v_new = (v + a*h + k*h*u)/(1 + k*h)

Here k has inverse-tick units. The implicit linear drag tends toward the fluid velocity without numerical sign-flipping at large k. Coverage and velocity estimation are approximations. Never use the wind field as water velocity. Supported grains still need contact constraints. This one-way drag model does not establish two-way momentum conservation.

## Water and mixing: explicit scope boundary

The council rejected a full fluid rewrite as the first delivery. It also rejected calling a local fill-diffusion rule an incompressible pressure solver.

First prototype: conservative, topology-aware whole-parcel routing for communicating water regions. Share a per-tick transport epoch with ordinary liquid movement so a routed parcel cannot be advanced again that tick. Validate deferred work against terrain/body topology revisions. Transport must use face-connected paths, never tunnel through a wall or cross a sealed disconnected region. Donors and receivers must satisfy capacity and a downhill head criterion; relocate whole payloads atomically with fixed work limits. This is a gameplay equalization surrogate, not Navier–Stokes flow, acoustic pressure, or a reliable jet-speed model.

Use z=-y for upward height. Move from donor surface z_d toward a reachable lower receiving surface z_r only when z_d-z_r exceeds roughly one cell of hysteresis. Enforce shared per-face throughput budgets at narrow throats. Cached connectivity must be invalidated or validated after terrain edits, reactions and body movement. Component labels alone do not impose a flow-rate limit.

An optional later outlet-launch approximation can use v=C_d*sqrt(2*g*head), with 0<C_d≤1, in cells/tick. Only launch a parcel actually withdrawn from a valid donor, debit volume, and bound energy by the corresponding head loss. At 100 cells of head and g=.16, the ideal upper launch speed is about 5.66 cells/tick before collision/speed caps. This does not model sealed pressure tanks, trapped-air compression or siphon priming.

Before promoting it, require a U-tube to equalize to cell-scale tolerance, sealed tanks not to leak, exact water count, bounded operations, and stable results under mirrored layouts. A bounded search that cannot finish must defer deterministically; it must not make a false connectivity assumption.

Real pressure-driven jets are a later solver prototype. Candidate architecture: fractional fluid volume, face velocities, free-surface/solid boundary conditions and pressure projection, or a deliberately compressible conservative finite-volume model. It requires its own stability conditions, capacity treatment and body coupling. Partial-fill diffusion alone cannot reproduce inertia-driven jets or packed U-bend pressure transmission. Projection, advection, and volume conservation are separate requirements.

Keep oil/water interfaces initially. For miscible solutes, store amount q with its carrier parcel and transport both together. For equal-volume carrier parcels, symmetric diffusion across an eligible edge may transfer d=alpha*(q_i-q_j), with equal debit/credit and a simultaneous outgoing budget so a cell never exports more than it owns. Do not independently clamp both sides. Concentration is q/carrier-volume, not an extra color blend. For equal-volume unit cells on a four-neighbor explicit diffusion stencil, alpha=D*h/dx²≤1/4 is a useful positivity condition. Fractional liquid volumes require volume-aware limits; do not reuse that bound blindly. Changing acid/water miscibility intentionally changes current stratification behavior and its tests; gate that change by explicit material rules.

Erosion follows measured water movement, not wind: estimate interface shear proportional to rho_f*|u_t|² and compare a dimensionless Shields-like threshold. Coefficients are visual calibration, not published constants transplanted into arbitrary lattice units. Entrain existing grains conservatively and let settling deposit them. No water-to-sand creation to fake sediment.

## Boulders and meteors

Start with a bounded number of dry movable disks. Leave existing STONE static so containers keep working. A body owns position, velocity, angular state, material and mass; a derived owner mask prevents simultaneous grain occupancy.

For a discrete disk footprint F with equal cell mass m_cell:

    body_mass = sum(m_cell for cells in F)
    inertia = sum(m_cell * (distance_from_center² + 1/6) for cells in F)

The 1/6 term is the polar moment contribution of a unit square cell. Alternatively a continuous disk uses m=rho*pi*r² and I=m*r²/2, but geometry, displaced volume and mass must agree; do not silently mix the two definitions.

Translate a fixed footprint to keep represented volume constant. Rotation of the circular appearance can be cosmetic initially. Collision must be conservative relative to the occupancy mask, with swept movement to avoid tunneling. Resolve approaching contacts with bounded restitution and friction. Use fixed, bounded substeps or swept collision under a speed cap; if the work budget is insufficient, clamp/defer movement explicitly rather than skip collisions.

For contact normal n from body B toward A and closing relative contact speed v_rel·n<0, the normal impulse is:

    j = -(1+e)*(v_rel·n) /
        (1/mA + 1/mB + (rA cross n)²/IA + (rB cross n)²/IB)

Apply equal and opposite impulses; static terrain uses zero inverse mass/inertia and receives the world reaction. Bound tangential impulse by abs(j_t)≤mu*j. Suppress restitution near rest. A damping factor exp(-c*h) avoids changing dissipation merely by changing substep count.

First slice: all non-AIR cells block entry. This proves coherent motion, ownership, stable rest, mass and collision handling, but deliberately does not promise crushing sand or splashing water.

Second slice: displace loose material through an atomic capacity planner. No available capacity means the body cannot enter. Never erase grains under a rasterized boulder. Later fluid displacement must be owned by the fluid solver; a dry-grid relocation routine is not a buoyancy solver.

Meteors follow only after impact accounting. Initial kinetic energy is K=0.5*m*|v|² + 0.5*I*omega². Rebound retains outgoing kinetic energy. Define available impact loss from incoming minus outgoing contact/body kinetic energy, accounting for world work and impulses; allocate only that loss among fracture, bounded ejecta, heat and dissipation without spending energy twice. Current artistic heat requires a defined conversion before making energy-conservation claims. Reject spawn or fracture until all occupied destinations and mass transfers are reserved. Fragment mass sums to parent mass; reserve destinations, cap fragment count, and preserve momentum subject to documented world impulses. Structural load/fracture and trapped-gas rupture remain later projects.

## Resource-funded ecology

First slice: soil moisture, nutrient-limited plants, seeds and decomposition. Then fund existing mites and minnows with energy, biomass, age and reproduction costs. Keep magical reactions outside the closed ecological accounting test mode unless they have explicit ledger entries.

For detritus D, available nutrient N and interval dt in simulated seconds:

    mineralized = D * (1-exp(-k*dt))
    D -= mineralized; N += mineralized

Plant usable energy receives sunlight P_max*f_light*f_water*f_temp*dt and pays maintenance. Nutrient-equivalent growth is limited by every actual resource:

    growth = min(N, max(0,B_cap-B), mu*B*f_light*f_water*f_temp*dt, E/c_growth)
    N -= growth; B += growth; E -= c_growth*growth

Handle exhausted maintenance energy before growth. A seed supplies initial biomass/reserves; zero biomass does not appear spontaneously. New plant pixels and seeds require funded reserves. Shade comes from an inexpensive column light pass.

Feeding transfers a bounded bite b from prey biomass: consumer receives eta_N*b and detritus receives (1-eta_N)*b. Transfer bounded prey energy with efficiency, dissipating the remainder. Reproduction debits child biomass/energy plus birth cost from the parent; reserve habitat before committing. Death returns remaining biomass to detritus. Consumer capacity overflow becomes detritus rather than disappearing.

Track liquid, soil and atmospheric water inventories. Evaporation and rain transfer the same quantity in opposite reservoirs. A rendered cloud need not equal one fixed water unit. Fish occupancy must not delete its carrier water.

Closed-mode invariants:

    total_nutrients = sum(available + detritus + living + seed inventories)
    total_water = sum(liquid + soil + atmosphere + other tracked stores)

Energy has sunlight input and dissipative losses; it is not a closed recycling resource.

## Nature-like randomness

Use persistent environmental conditions and inherited variation rather than new independent randomness every frame.

An event with constant hazard lambda per simulated second has probability:

    p = 1-exp(-lambda*dt)

This gives a consistent isolated-event probability; interacting dynamics are not thereby timestep invariant. Slowly approach seeded weather targets:

    weather_new = target + (weather_old-target)*exp(-dt/tau)

Use bounded inherited trait variation with tradeoffs, local resource competition, and habitat refuges. Extinction is an admissible outcome. Evaluate persistence and recovery across many seeds; do not secretly respawn life to force a pretty result. Optional seed banks or assistance can be explicit features.

## Scheduling, budgets and acceptance

Initial scheduling candidates: mechanics 60 Hz, animal decisions 5–10 Hz, ecology 1–2 Hz, weather 0.2–1 Hz. These are tuning proposals. All clocks derive from simulation ticks; overload slows the entire world consistently. Deterministic work caps are based on counts, not wall-clock early exits that change outcomes across devices.

Retain 480×270 until measured otherwise. One Float32 field costs 518,400 bytes; snapshots and scratch buffers multiply this cost. Measure p50/p95/p99 worker steps, whole messages, frame time, input latency, memory growth and lost simulated time on identified iPhone Safari and Android Chrome devices. Candidate starting targets: p95 step ≤8 ms, normal-speed message ≤12 ms, input-to-visible ≤100 ms. These are unvalidated goals and may need revision after baseline measurement.

| Stage | Deliverable | Acceptance gate |
|---|---|---|
| 0 | Isolated state, full checkpoint, tick-owned events, separate RNG | Independent engines; pause invariance; checkpoint continuation; same tick commands under different render batching |
| 1 | Residual granular motion, dissipative contacts, supported slope hysteresis | Free-fall curve; stable piles; no impact energy gain; exact closed material counts |
| 2 | Dry coherent boulders | No tunneling/overlap/deletion; constant mass; stable rest; predictable collision work |
| 3 | Resource-limited plants and water stores | Positivity; nutrient/water ledger closure; drought/darkness limit growth |
| 4 | Conservative liquid connectivity and displacement prototype | U-tube; sealed-tank invariance; no wall shortcuts; material payload preservation |
| 5 | Coupled sediment, funded animals, bounded disturbances | Erosion/deposition balances; no unfunded births; multi-seed recovery/extinction statistics |
| 6 | Pressure solver, buoyant bodies, meteors/fracture | Dedicated fluid/body momentum and energy tests, plus measured sustained phone performance |

Do not claim a stage complete solely because it looks convincing. Numerical invariants, visual quality, and device performance are separate gates. The first implementation should be Stage 0; the first new visible toy is the bounded dry boulder, not an all-at-once ecosystem rewrite.

## Reference basis

The equations and staging above are council proposals adapted to this game, not implementations copied from these references. Numerical constants are provisional.

- [LAMMPS granular contact models](https://docs.lammps.org/pair_granular.html): normal/tangential/rolling contact and cohesive model distinctions; informs which expensive mechanics to omit initially.
- [Bridson, Fluid Simulation course](https://www.cs.ubc.ca/~rbridson/fluidsimulation/): incompressibility and pressure-solve framework; the routing prototype does not implement that framework.
- [Box2D simulation documentation](https://box2d.org/documentation/md_simulation.html): fixed stepping, body mass/inertia, and substep concepts. A dependency choice is not approved by this document.
- [USACE transport and erosion thresholds](https://www.hec.usace.army.mil/confluence/rasdocs/d2sd/ras2dsedtr/latest/model-description/critical-thresholds-for-transport-and-erosion): Shields-style nondimensionalization and model-specific threshold calibration.
- [NetLogo Wolf Sheep Predation](https://ccl.northwestern.edu/netlogo/models/WolfSheepPredation): energy-funded agent ecology and sensitivity to extinction in finite populations. Does not validate this game's parameters.
