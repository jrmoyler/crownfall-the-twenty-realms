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
- Touch: drag the stick, then Strike, Break, Dodge, and the rite buttons.

Progress stays in this browser (`localStorage`). Mute and reduced motion live in Settings.

## What changed in this build

The previous battlefield was one shared kit wearing twenty palettes. This one is a campaign:

- Each ruler has four rites that actually differ: lances, arcs, wards, snares, chains, summons, marks, dashes, meteors, banners, volleys.
- Conquest is a connected atlas. Beating a realm opens its neighbors. Rematches do not mint a second dominion.
- Survival drafts a relic after every clear. Rares are in the pool.
- The crown forge keeps five seals across runs.
- A first-march manual pauses the opening battle until you skip or finish it.

## Project

- `src/crownfall/` — catalog, battle simulation, diorama stage, UI, audio, save.
- `src/main.ts` — mounts the game.
- `android/` and `ios/` — Capacitor shells. Sync after `npm run build`.

## Mobile shells

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android release signing is done in Android Studio. iOS archive needs macOS, Xcode, and a developer team.
