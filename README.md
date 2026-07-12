# Crownfall: The Twenty Realms

Standalone HTML5/WebGL survival-strategy game built around Collective AI Inc.'s 20 active civilizations.

## Play

Open `dist/index.html` through a local static server, then:

- Choose any civilization from the 20-realm selection hall.
- Use **Conquest** for a five-wave realm incursion and **Endless Survival** for escalating waves.
- Desktop: `WASD`/arrows move, click attacks, `Space` dodges, `Q E R F` trigger the ruler abilities, and `C` summons elite allies.
- Touch: use the lower-left movement stick, lower-right attack button, and ability buttons.

## Structure

- `src/simulation/catalog.ts` — all 20 active civilizations, personalities, maps, abilities, elites and visual palettes.
- `src/main.ts` — game screens, Three.js 2.5D battlefield, combat loop, tactical summons, campaign/survival logic and local progress.
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
