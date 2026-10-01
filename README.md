# Crownfall: The Twenty Realms

A browser action game. Twenty rulers, one war table. Pick a civilization, march on its neighbors, and keep what you take.

## Play

```bash
npm install
npm run dev
```

Open the local address Vite prints. A production build is `npm run build`, then any static server pointed at `dist/`.

- **Conquest** opens the war table. Neighboring realms are the only roads. A mission is a shrine, two relic wells, and the rival warlord.
- **Endless survival** throws warbands at you until you fall. Between waves, draft one relic. A warlord arrives every fifth wave.
- **Forge** spends shards from either mode on permanent seals.
- Desktop: `WASD` moves relative to the camera (A left, D right). The pointer aims. Click chains a strike, right-click or Shift is a stamina breaker, Space phase-dodges, `Q E R F` are that ruler's rites, `C` calls elites.
- Touch: put a thumb anywhere on the left half to drag the stick. Strike, Break, Dodge, the four rites and Elites sit around your right thumb. Taps on the field never steer you; strikes and rites auto-face the nearest enemy.
- Gamepad (standard mapping): left stick moves, right stick aims, A strike, B dodge, X breaker, Y elites, LB/RB/LT/RT the four rites, Start pauses.

Progress stays in this browser (`localStorage`). Mute and reduced motion live in Settings.

## Art

Characters and weapons are rigged, textured models from Sketchfab artists (CC BY 4.0); battlefields are photoscanned ground, rock, tree and statue scans plus HDR skies from Poly Haven (CC0). Full attribution is in `CREDITS.md` and on the Settings screen.

Skeletons come from several tools (Biped, Mixamo, Blender rigs), so `src/crownfall/rig.ts` animates them procedurally: each limb is aimed at a direction in the character's own space, which makes one set of run, strike, cast, dodge and flinch poses work on every model.

`npm run assets` rebuilds `public/realm/` from the sources in `tools/assets/sources.mjs`: download, strip animation and morph data, simplify to a triangle budget, re-encode textures as WebP, meshopt-compress. A battle loads only its own realm and cast.

## Project

- `src/crownfall/` — catalog, battle simulation, stage (renderer, terrain, figures), rig, UI, audio, save.
- `tools/assets/` — the asset pipeline.
- `src/main.ts` — mounts the game.
- `android/` and `ios/` — Capacitor shells. Sync after `npm run build`.

## Mobile shells

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android release signing is done in Android Studio. iOS archive needs macOS, Xcode, and a developer team.
