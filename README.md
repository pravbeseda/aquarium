# Aquarium

A first-person aquarium in the browser: you are a small fish in a planted tank.

**▶ Play: https://pravbeseda.github.io/aquarium/**

![Inside the tank: angelfish drift through moving light shafts, caustics play over the gravel and the room behind the glass is out of focus](docs/aquarium.gif)

Swim through Vallisneria, hairgrass and Rotala that part around you, past driftwood and mossy stones, with a school of neon tetras and a few angelfish. Flakes drop in from time to time — catch them before the neons do. Above you is the underside of the water surface with the lamp in Snell's window; through the glass you see the room outside, out of focus.

## Controls

**Desktop** — click *Dive in*, then:

| Action | Keys |
| --- | --- |
| Swim | `W` `A` `S` `D` or arrow keys |
| Look around | mouse |
| Up / down | `Space` / `C` (also `E` / `Q`) |
| Faster | `Shift` |
| Fullscreen | `F` or the button in the corner |
| Pause | `Esc` |

**Phone and tablet** — the left thumb swims with a floating joystick (push it past the rim to dash), the right thumb looks around. The button in the corner switches to fullscreen; on iPhone, use *Share → Add to Home Screen* to run it fullscreen.

The game picks a quality level for the device and adjusts its render resolution to keep the frame rate up. It needs a browser with WebGL 2.

## Running locally

```sh
npm install
npm run dev        # add `-- --host` to open it from a phone on the same Wi-Fi
npm test
npm run build      # typecheck and build into dist/
```

Handy URL parameters while developing: `?quality=low|medium|high`, `?autostart`, `?cam=x,y,z,yaw,pitch`, `?touch`, `?stats`.

## Built with

The game has one runtime dependency; everything on screen is drawn with it.

- [three.js](https://threejs.org/) 0.187 — the WebGL 2 renderer, with these of its add-ons:
  - `GLTFLoader` — loads the scanned rocks;
  - `HDRLoader` and `PMREMGenerator` — load the room panorama and prefilter it into the blurred cube map seen through the glass;
  - `UnrealBloomPass` — the glow around the lamp and bright highlights;
  - `HorizontalBlurShader` and `VerticalBlurShader` — the half-resolution blur behind the light shafts and the distance blur;
  - `FullScreenQuad` (from `postprocessing/Pass.js`) — draws the post-processing passes;
  - `BufferGeometryUtils` — merges the driftwood branches and fish fins into single meshes.

Development and delivery:

- [TypeScript](https://www.typescriptlang.org/) 7 — the language of the whole codebase.
- [Vite](https://vite.dev/) 8 — dev server and production build.
- [Vitest](https://vitest.dev/) 5 — unit tests for the simulation and the shader patches.
- [GitHub Actions](https://github.com/features/actions) and [GitHub Pages](https://pages.github.com/) — every push to `main` is tested, built and published.

The water, caustics, light shafts, glass, plants, fish and their animation are this project's own shaders and code. The caustic pattern follows the well-known tileable water-caustic shader by joltz0r, as adapted by Dave Hoskins on [Shadertoy](https://www.shadertoy.com/).

## Credits

The living-room HDRI (`lythwood_room`), the mossy rocks (`rock_moss_set_01`) and the gravel and bark textures (`ganges_river_pebbles`, `bark_willow_02`) are from [Poly Haven](https://polyhaven.com/), released under CC0. Plants, fish, driftwood, caustics and water are procedural.
