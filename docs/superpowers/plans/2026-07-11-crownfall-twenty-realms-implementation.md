# Crownfall: The Twenty Realms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone Vite/TypeScript/Three.js browser game where all 20 Collective AI Inc. civilizations are playable in Conquest Campaign and Endless Survival modes.

**Architecture:** Keep authoritative game state in pure TypeScript simulation modules and render it through a compact Three.js battlefield adapter. Use a data-driven civilization catalog to guarantee every selection receives unique map styling, ability kit, unit role, enemy palette and UI presentation without duplicating controller code. Menus and HUD live in DOM, and the game loop synchronizes only derived view state to them.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, CSS, local generated PNG assets, browser `localStorage`.

## Global Constraints

- All 20 active divisions are playable; divisions 21–30 do not appear.
- Both Conquest Campaign and Endless Survival work without network access.
- Desktop and touch controls must operate the same underlying actions.
- Use MeshStandardMaterial, lights, fog, terrain variation, particles and non-placeholder faction visuals.
- Persist settings, unlock state, campaign node progress and per-civilization scores in `localStorage`, with memory fallback.
- Avoid external runtime fonts, images, APIs and multiplayer claims.
- Run `npm run test`, `npm run build`, and browser smoke tests before handoff.

---

### Task 1: Create the game project, design tokens and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `src/simulation/catalog.test.ts`

**Interfaces:**
- Produces the Vite entrypoint, `npm run dev`, `npm run build`, `npm run test`, and browser-like Vitest environment.
- Consumes no prior game module.

- [ ] Write a failing catalog test asserting twenty unique civilization ids and no pending civilization names.

```ts
import { CIVILIZATIONS } from './catalog';

it('exposes exactly the twenty active civilizations', () => {
  expect(CIVILIZATIONS).toHaveLength(20);
  expect(new Set(CIVILIZATIONS.map((item) => item.id)).size).toBe(20);
  expect(CIVILIZATIONS.some((item) => /Astral Forge|Materia Nova|Aqua Meridian/.test(item.name))).toBe(false);
});
```

- [ ] Run `npm run test -- --run` and confirm it fails because the catalog module does not exist.
- [ ] Add Vite/Vitest configuration, HTML shell, CSS reset/design tokens and a minimal `main.ts` that mounts `#app`.
- [ ] Add the package scripts `dev`, `build`, `test`, and `test:watch`.
- [ ] Run `npm install`, then run `npm run test -- --run` and confirm the test harness runs.

### Task 2: Build the civilization catalog and campaign graph

**Files:**
- Create: `src/simulation/types.ts`
- Create: `src/simulation/catalog.ts`
- Create: `src/simulation/campaign.ts`
- Create: `src/simulation/catalog.test.ts`
- Create: `src/simulation/campaign.test.ts`

**Interfaces:**
- `Civilization`: `{ id, index, name, ruler, title, palette, biome, doctrine, weapon, abilities, elite, enemy, mapSeed, difficulty }`.
- `CIVILIZATIONS: readonly Civilization[]` provides all selection/campaign/battle source data.
- `buildCampaign(selectedId: CivilizationId): CampaignNode[]` returns the twenty realm graph and three initial unlocked nodes.

- [ ] Write failing tests for unique map seeds, four abilities per civilization, and a twenty-node campaign graph whose starting nodes are marked available.
- [ ] Implement type-safe catalog entries for ZenFlow through Eon Core, retaining the canon names and distinctive visual/gameplay metadata from the approved specification.
- [ ] Implement campaign graph generation with four theaters, selected homeland, adjacency, completion and lock state.
- [ ] Run `npm run test -- --run src/simulation/catalog.test.ts src/simulation/campaign.test.ts` and confirm all catalog/campaign tests pass.

### Task 3: Implement pure battle simulation and survival pacing

**Files:**
- Create: `src/simulation/battle.ts`
- Create: `src/simulation/waves.ts`
- Create: `src/simulation/battle.test.ts`
- Create: `src/simulation/waves.test.ts`

**Interfaces:**
- `createRun(config: RunConfig): RunState` initializes a campaign mission or endless arena.
- `stepRun(state, input, dt): RunState` updates player, enemies, allies, shrines, relic wells, cooldowns and objectives without Three.js dependencies.
- `createWave(wave, rivalIds, seed): SpawnPlan` produces non-empty paced enemy groups and a boss on each fifth wave.
- `deriveResults(state): RunResults` reports score/outcome/kills/rewards.

- [ ] Write failing tests proving dodge consumes stamina, primary attacks damage in range, a secured shrine produces command energy, and fifth survival waves include a boss.
- [ ] Implement state, hit detection, deterministic random generator, player resources, ability cooldown contracts, spawned allies, enemy archetypes, shrine capture and campaign objectives.
- [ ] Implement wave scaling, world events every third wave, relic draft options and boss phase thresholds.
- [ ] Run the four tests plus the existing catalog/campaign suite until green.

### Task 4: Generate and integrate original visual art direction assets

**Files:**
- Create: `public/assets/crownfall-title.webp`
- Create: `public/assets/realm-map.webp`
- Create: `public/assets/civilization-atlas.webp`
- Create: `public/assets/terrain-atlas.webp`
- Create: `src/render/assets.ts`

**Interfaces:**
- `ASSET_URLS` maps named local assets to `/assets/...` URLs.
- Render/UI modules must only refer to this asset map, never remote URLs.

- [ ] Generate an original title/key-art image with the supplied leader sheet as visual reference and verify that no text inside the image is required for navigation or accessibility.
- [ ] Generate an original panoramic ancient-realms atlas featuring distinct obsidian, gold, astral, verdant, tribunal, forge, desert and academy visual language, then save it locally.
- [ ] Generate a terrain/ornament texture source with non-textual ancient stone, mosaic, sand, vegetation, metal and magical-rune motifs, then save it locally.
- [ ] Implement the local asset registry and verify all requested file paths return HTTP 200 from the local Vite server.

### Task 5: Build the Three.js renderer, biome scenes and game actor presentation

**Files:**
- Create: `src/render/renderer.ts`
- Create: `src/render/world.ts`
- Create: `src/render/actors.ts`
- Create: `src/render/effects.ts`
- Create: `src/render/renderer.test.ts`

**Interfaces:**
- `GameRenderer(canvas, options)` owns scene/camera/renderer lifecycle and exposes `render(run)` and `dispose()`.
- `createRealmWorld(civilization, seed)` creates an orthographic 2.5D map using faction terrain, structures, shrine and relic-well placements.
- `syncActors(run)` maps pure simulation entities to meshes and VFX.

- [ ] Write a failing renderer lifecycle test using a mocked canvas, then make `dispose()` remove listeners and release scene resources.
- [ ] Build terrain from layered, colorized, texture-backed material surfaces; add faction structures, shrine, relic well, environment props, fog, directional lighting and optional shadows.
- [ ] Create original 2.5D ruler, ally, enemy and boss figures using silhouettes, generated-atlas texture treatment, weapons, flags and faction sigils instead of raw primitives.
- [ ] Add projectiles, slash trails, rune circles, dust, sparks, weather particles and camera shake driven by run state.
- [ ] Run renderer tests and a manual scene smoke test at desktop and mobile viewport sizes.

### Task 6: Build title, selection, campaign, HUD, controls and results screens

**Files:**
- Create: `src/ui/app.ts`
- Create: `src/ui/screens.ts`
- Create: `src/ui/hud.ts`
- Create: `src/ui/input.ts`
- Create: `src/ui/ui.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Interfaces:**
- `AppController` owns `ScreenState`, mode selection, active civilization and run lifecycle.
- `mountApp(root)` renders navigation and dispatches explicit actions: `chooseCivilization`, `startCampaign`, `startSurvival`, `pause`, `resume`, `restart`, `returnToTitle`.
- `createInputRouter(target)` yields the simulation `InputFrame` for pointer/keyboard/touch.

- [ ] Write failing UI tests for selecting each civilization, launching either mode, opening pause, and producing a results view after an ended run.
- [ ] Implement the title screen, how-to overlay, 20-card civilization selection hall, campaign strategic map, survival arena launch, codex and settings.
- [ ] Implement the restrained in-battle HUD, command wheel, keyboard/mouse bindings and touch joystick/action buttons, then connect all actions to the simulation.
- [ ] Implement results, unlock indicators, score display, replay/continue navigation and visible error fallback for unavailable WebGL.
- [ ] Run UI tests and verify state transitions without a rendered WebGL canvas.

### Task 7: Add persistence, settings and runtime resilience

**Files:**
- Create: `src/simulation/persistence.ts`
- Create: `src/simulation/persistence.test.ts`
- Modify: `src/ui/app.ts`
- Modify: `src/ui/screens.ts`

**Interfaces:**
- `loadProfile(storage): PlayerProfile` and `saveProfile(storage, profile): void` provide versioned local persistence with safe defaults.
- `PlayerProfile` includes settings, tutorial completion, best scores, completed nodes and unlocked civilization ids.

- [ ] Write failing tests for default profile, JSON corruption recovery and best-score replacement only when a new score is higher.
- [ ] Implement versioned persistence, adaptive quality settings, audio/motion settings, touch preference and storage failure fallback.
- [ ] Wire profile changes into campaign availability, selection locks, settings UI and post-run score updates.
- [ ] Run the complete unit suite until green.

### Task 8: Validate, visually QA, and package the standalone game

**Files:**
- Create: `README.md`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**
- `npm run build` produces a static `dist/` game.
- `npm run test -- --run` validates pure and UI modules.
- `npm run e2e` loads title -> selection -> battle -> pause -> results with no console errors.

- [ ] Write an end-to-end smoke test that opens the title screen, selects ZenFlow, starts Endless Survival, sends an attack input, opens pause and returns to the title.
- [ ] Run the smoke test at a desktop viewport and 390×844 mobile viewport; capture screenshots and record browser console output.
- [ ] Run `npm run test -- --run`, `npm run build`, and the e2e test with a fresh local server.
- [ ] Compare browser screenshots with the reference art direction and the approved design, fix readable mismatches, remove temporary QA artifacts and write concise play instructions in `README.md`.

## Self-Review

- Coverage: Tasks 2–7 implement every approved mode, civilization, map identity, screen, input path, persistence requirement and asset system. Task 8 verifies build, controls, desktop/mobile rendering and the main screen flow.
- No placeholder scan: no task defers a requirement without an explicit delivery boundary from the approved specification.
- Interface consistency: the catalog feeds campaign and run configuration; pure `RunState` feeds render/UI; `AppController` owns the transitions; persistence feeds selection/results.
- Repository note: this workspace started without a Git repository. Do not invent commits; version control may be initialized only if the user requests it.
