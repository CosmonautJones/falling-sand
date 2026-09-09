# Alembic

A niche falling-sand vessel: charge it with reagents, then let the garden
run. New stuff is transmuted, not picked from a giant palette. The Great Work
is hidden in the reactions — and in a few rites the vessel will not name.

The world is a 480×270 grain field, drawn through a Three.js nearest-neighbour
upscale: heat bloom, water caustics, gold spark, Magnum Opus aurora.

## Run

```bash
npm install
npm run dev      # http://127.0.0.1:5173/
npm test
npm run typecheck
```

## How to play

The vessel starts charged. Hold to pour — strokes interpolate, a still hold
keeps dripping. Right-click names the grain under the cursor; hold right-click and drag to
pan after zooming. Scroll zooms toward the cursor. Double-click resets the
view. Alt-click samples a grain (and unlocks it). Space pauses;
`[` / `]` change brush size; `1`–`0` pick the first ten bench reagents.
½× / 1× / 2× set the clock.

Start with sand, water, stone, seed, oil, fire, air, ice, wood, salt, lava,
acid, and lead. Everything else unlocks when the vessel makes it.

- Seed + water (or mud) → **plant**. Wet plants grow and a thicket drops more seed.
- Fire + sand → **glass**. Fire without fuel → **ash**. Fire + water → **steam**.
- Ash + water → **mud**. Moss creeps along wet stone on its own.
- Oil floats on water and burns. Water still kills fire.
- Ice freezes neighboring water and melts beside fire.
- Salt dissolves into **brine**. Hot brine leaves **crystal**.
- Wood burns to fire or falling **ember**.
- Lava swallows stone, vitrifies sand, and quenches in water as **obsidian** + steam.
- Steam rises, bubbles through water, and condenses on ice. Steam + crystal → **aether**.
- Acid eats stone to sand, and plant-matter to air. Acid + lead → **mercury**.
- Mercury + lead + fire → **gold**. Azoth turns lead to gold without the fire.
- Gold + aether + crystal → **azoth**. The Work is finished.
- Salt + ash → **powder**. Powder next to fire flashes.
- Fire boxed in eight obsidian → **void**. Void spreads through living stuff; azoth keeps it back.
- Mud + fire → **brick**. Ash on a plant is bone-meal.
- Sand resting on brine petrifies to stone.
- Powder burns as a **fuse**, one hop a tick.
- Acid biting stone sometimes yields **lead** (rarely gold).
- A tall gold column kissed by aether at the tip **strikes** fire at the base.
- Crystal hanging over air beside ice **drips**.
- An obsidian frame (inner at least 2×2) lit with fire becomes a **rift**. What touches it turns to aether.
- **Tnt** on the bench. Fire, ember, lava, or a burning fuse sets it off. Obsidian, azoth, and rifts hold. Nearby tnt chains. Sand gets thrown.
- Oil + powder → **nitro**, a meaner liquid blast.
- Sand falling into a pool **splashes** the liquid up. One grain, one step — the pile just has more to say.

Clear empties the vessel; reset restores the opening scene. Discoveries stay.

There are rites. The name on the page can be struck. Old sequences still work.
A few words from the art, typed into the dark, are answered.

## Layout

| File | Role |
| --- | --- |
| `src/grid.ts` | Cell ids + per-grain shade. Occupancy scan. Line stamps. |
| `src/materials.ts` | Palette, colour, density, kind. |
| `src/sim.ts` | Motion, growth, fire, ice, lava, the Great Work. |
| `src/secrets.ts` | Title strikes, konami, named rites, ceiling rain. |
| `src/codex.ts` | Whispered lines when a reagent is first seen. |
| `src/render.ts` | `blitGrid` (shade, flicker, sparkle, occlusion). |
| `src/stage.ts` | Three.js DataTexture quad + 2d fallback. |
| `src/world.ts` | Size, brushes, opening scene. |
| `src/main.ts` | Palette, pour, pause, keyboard, rites, RAF loop. |
| `src/rng.ts` | Seedable PRNG for shade and diagonal choice. |
