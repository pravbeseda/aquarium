# Aquarium — agent notes

A browser game: first-person life of a small fish in a planted aquarium. Vite + TypeScript + three.js (WebGL 2).

## Commands

- `npm run dev` — dev server; add `-- --host` to open it from a phone on the same Wi-Fi.
- `npm test` — Vitest unit tests (pure logic and shader-patch anchors).
- `npm run build` — typecheck and production build into `dist/`.

## Layout

- `src/sim` — pure simulation (tank bounds, swimming, school, wanderers, food). No rendering; unit-tested.
- `src/render` — render pipeline: scene → `ShaftsPass` (half-res light shafts) → `WaterPass` (absorption, glass, room, reflections) → bloom → `FinalPass` (lens, tone mapping).
- `src/render/underwaterMaterial.ts` — patches three.js materials (caustics, translucency, plant sway, fish swimming) through anchors in three's shader chunks. `shaderPatch.test.ts` fails loudly when a three.js upgrade moves an anchor; fix the anchor, do not delete the test.
- `src/world` — scene content; `environment.ts` holds the art direction (water colour, lamp, room placement).
- `src/input`, `src/ui`, `src/app` — controls, DOM overlay, composition root.

## Conventions

- World units are metres; the tank interior is `TANK` in `src/sim/tank.ts`, Y up, front glass at +Z.
- The scene target's alpha carries two signals for `WaterPass`: values in `[0, 1]` are coverage over the alpha-0 clear (MSAA edges, fins, bubbles), and the water surface writes `1 + F`, its mirror reflectance; the half-float target keeps values above 1. Additive effects must use `ADDITIVE_KEEP_ALPHA` so they do not overwrite it.
- Randomness that shapes the scene is seeded (`mulberry32`) so every load looks the same.

## Debug URL parameters

`?autostart` skips the start screen, `quality=low|medium|high` overrides the detected tier, `cam=x,y,z,yaw,pitch` sets the start pose, `touch` forces the touch UI, `stats` logs fps and render size to the console.

## Assets

`public/assets` holds CC0 assets from Poly Haven: the `lythwood_room` HDRI, `rock_moss_set_01` model, `ganges_river_pebbles` and `bark_willow_02` textures. Everything else (plants, fish, driftwood, caustics) is procedural.

## Deploy

`.github/workflows/pages.yml` builds on pull requests and deploys `dist/` to GitHub Pages on pushes to `main`.
