# Crownfall: The Twenty Realms

Standalone HTML5/WebGL survival-strategy game built around Collective AI Inc.'s 20 active civilizations.

## Play

Open `dist/index.html` through a local static server, then:

- Choose any civilization from the 20-realm selection hall.
- Use **Conquest** for a five-wave realm incursion and **Endless Survival** for escalating waves.
- Desktop: `WASD`/arrows move, left-click chains directional attacks, right-click/`Shift` unleashes a heavy breaker, `Space` phase-dodges, `Q E R F` trigger ruler abilities, and `C` summons elite allies.
- Touch: use the lower-left movement stick, lower-right attack button, and ability buttons.

## Veteran combat overhaul

- Three-hit directional weapon chains, stamina heavy attacks, phase-dodge invulnerability, hit-stop, knockback and adaptive camera impact.
- Mixed enemy warbands: circling skirmishers, shielded vanguards, telegraphed brutes, kiting projectile mystics and sovereign boss encounters.
- Command-shard pickups, score multipliers, independently targeting elite allies, boss health presentation and wave cinematics.
- Layered PBR ruler rigs with articulated anatomy, cloth, armor, shields, realm headgear and separate weapons visibly held in hand.
- Five realm-architecture families—observatory gates, gilded basilicas, foundry pylons, ancient groves and rune monoliths—combined with each civilization's seeded biome.
- A live rotating 3D ruler preview on the civilization selection screen.

## Structure

- `src/simulation/catalog.ts` — all 20 active civilizations, personalities, maps, abilities, elites and visual palettes.
- `src/main.ts` — game screens, Three.js battlefield, combat loop, tactical summons, campaign/survival logic and local progress.
- `src/render/characterRig.ts` — layered articulated PBR ruler rigs, held weapons, shields, realm silhouettes and combat animation states.
- `src/render/environment.ts` — seeded 3D realm environments: noise-displaced terrain with a mountain rim, gradient/eclipse skydome, biome props, ruined pillars, waving banners and the central shrine.
- `src/render/` also holds combat telegraphs, directional weapon trails, pooled impact VFX and the adaptive cinematic image pipeline.
- `android/` and `ios/` — Capacitor-native projects with branded icons and splash screens.
- `src/styles.css` — desktop/mobile game UI.
- `public/assets/` — original generated title and civilization/terrain art used locally by the game.
- `dist/` — browser-ready production build.

## Run locally

```bash
npm install
npm run dev
```

For a production check:

```bash
npm run build
npm run test:run
```

## Visual diagnostics

- Add `?quality=cinematic`, `?quality=balanced`, or `?quality=battery` to force a rendering tier.
- Press `P` during battle to toggle the no-post baseline used for visual regression checks.
- Realm layouts, material variation, particles and environmental motion are seeded from each civilization's catalog entry.

## Mobile builds

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android release signing is completed in Android Studio. iOS archive/signing requires macOS, Xcode and an Apple Developer team; the generated Xcode project is ready for those credentials.
