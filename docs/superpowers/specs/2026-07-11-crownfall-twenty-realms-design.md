# Crownfall: The Twenty Realms — Game Design Specification

## Product Intent

Create a premium, standalone HTML5 browser game inspired by the supplied Collective AI Inc. ancient-civilization leader reference. The game must feel like an authored 2.5D WebGL action-survival strategy game rather than a static website or shallow prototype. It is playable on desktop and mobile, runs locally from a static server, and uses only original game art, UI, icons, VFX, audio synthesis, and code.

## Canon and Scope

- The 20 active Collective AI Inc. divisions are the playable civilizations. Pending divisions 21–30 are excluded.
- Every civilization is selectable and has an individual ruler, color identity, homeland map, doctrine, primary weapon, four ability labels, summoned unit type, rival encounter, environmental hazards, relic pool, and victory motif.
- Choosing a civilization makes all other civilizations potential enemies. Enemy composition changes by realm and campaign progression.
- There are two fully playable modes: Conquest Campaign and Endless Survival.
- The supplied leader sheet is the art-direction reference only. Game characters and maps are original, readable game assets derived from division themes and colors.

## Game Pillars

1. **Embodied command:** move, aim, strike, dodge and cast as a legendary ruler while deploying and ordering a small warband.
2. **Civilizations with identity:** no shared player kits or interchangeable maps; every choice visibly changes combat, architecture, enemy pressure and tactical opportunity.
3. **Survival with conquest stakes:** defend shrines, capture relic wells and survive wave escalation to earn resources used on the conquest map.
4. **Cinematic legibility:** dense, material-rich battlefield art and effects, but clean silhouettes, strong contrast, clear telegraphs and accessible HUD readability.

## Technical Direction

- **Runtime:** Vite + TypeScript + Three.js, with a 2.5D orthographic/isometric battlefield, HTML UI overlay and Canvas/WebGL render loop.
- **Rendering:** MeshStandardMaterial/mesh physical cues, directional moon/sun light, fog, shadows, procedural terrain decals, parallax particles, bloom-like post processing only when the device permits it, and adaptive quality settings.
- **Input:** keyboard/mouse (WASD/arrows, pointer aim, left attack, right ability/guard, Q/E/R ability keys, Space dodge, 1–3 command groups) plus touch joystick, attack/ability buttons, pause and command wheel.
- **Persistence:** `localStorage` for unlocked civilizations, best survival score by civilization, campaign progress, quality/audio settings and tutorial completion.
- **No network dependency:** all gameplay and art must load from local project assets; no API calls or web fonts required for play.

## Experience Flow

### Title and onboarding

1. Animated title screen: **CROWN FALL** with the subtitle **The Twenty Realms**. The background is a living obsidian-and-gold mosaic map with drifting embers and a monumental civilization sigil.
2. Primary actions: Begin Conquest, Endless Survival, Civilization Codex, How to Play, Settings.
3. First-run tutorial overlay teaches movement, attack, dodge, summon, command and shrine capture in less than 45 seconds. It can be skipped and replayed.

### Civilization selection

The selection hall is a 20-card gallery with lockable campaign progression and an accessible compact list. Each card includes ruler title, civilization name, doctrine, map biome, four ability glyphs, elite unit, difficulty rating and palette. Hover/touch focus brings forward a rendered leader portrait, stat bars and a short lore line. Selection works for every card and feeds both modes.

### Conquest Campaign

- A strategic map of the Twenty Realms shows the selected homeland at the center of the player’s opening route, with 19 rival realm nodes, four directional theaters and progressive banners.
- A realm mission is a 7–10 minute multi-objective battle: establish at a shrine, secure two relic wells, survive an assault, then defeat a rival Warlord or defended monolith.
- Success rewards Dominion, relic unlocks, campaign map intel and a new arena modifier. Defeat still records earned progression but does not falsely report victory.
- The initial release contains a complete campaign loop with at least three linked realms available per chosen civilization and replayable remaining realm skirmishes; campaign data and all 20 nodes are modeled so additional authored missions extend without rewrites.

### Endless Survival

- Choose an unlocked civilization and a homeland arena.
- Waves combine rival infantry, ranged hunters, elite commanders and a boss every fifth wave; a rotating world event triggers every third wave.
- Between waves, choose one of three drafted relic upgrades, repair/empower a shrine, or recruit a unit formation.
- Score derives from wave, kills, shrine integrity, relic streak and elite eliminations. Per-civilization best scores persist locally.

## Battlefield Rules

### Player controller

- Eight-direction movement with acceleration/deceleration, facing toward mouse/right-stick/touch aim.
- Primary attack is a timed three-step combo. Ranged civilizations use an aimed projectile chain; melee civilizations use arc strikes. A universal guard/parry window is exposed when their doctrine permits it.
- Dodge uses a stamina charge with brief invulnerability and directionality.
- Four named abilities have cooldowns and visible telegraphs. Ability visuals are themed by civilization but share a consistent combat contract: area control, burst, defense/mobility and ultimate/summon.
- Health, stamina, command energy and temporary ward are distinct resources. Death enters a brief downed state before run end; campaign missions offer one revival at a shrine.

### Command system

- Summon costs command energy earned by kills, shrine control and relic wells.
- Three tactical orders: Rally (follow and defend player), Advance (push toward target), and Hold (protect a target point).
- The command wheel is opened with a keyboard key or touch button. Commands are contextual and have cooldowns to avoid uncontrolled spam.
- Each civilization’s elite unit has a different role: shield phalanx, scout, medic, siege, drone construct, skirmisher, oracle or shock guard.

### Objectives and enemies

- Shrines have three phases: contested, attuning and secured. Capture requires the player or allies nearby and is interrupted by enemies.
- Relic wells produce command energy and tempt enemy assaults.
- Enemies use clear archetypes: vanguard, archer, raider, sentinel, elite and boss. Rival civilizations apply unique visual and mechanical modifiers, but all use safe shared AI interfaces.
- Bosses use staged health thresholds, a clearly signaled arena attack, summon phase and one faction signature move.

## Civilization Roster

| # | Civilization | Ruler archetype | Homeland biome | Doctrine / gameplay accent | Elite unit |
|---:|---|---|---|---|---|
| 01 | ZenFlow | Oracle-King | violet astral observatory | temporal echoes, prediction wards | Lattice Sentinels |
| 02 | The Collective | Sovereign Architect | gold basilica capital | rallying banners, balanced command | Guild Phalanx |
| 03 | Hybrid Living | Scholar-Queen | blue academy terraces | adaptive shields, learning runes | Lore Wardens |
| 04 | Nexus Labs | Crimson Showmaster | ember amphitheater | spectacle bursts, illusion decoys | Stage Blades |
| 05 | Terra Axis | City Empress | copper citadel ravines | fortifications, seismic traps | Stone Surveyors |
| 06 | Vital Helix | Gene-Seer | teal healing wetlands | regeneration, venom spores | Helix Medics |
| 07 | Binary Loom | Code Regent | lime circuit gardens | construct summons, linked damage | Loom Constructs |
| 08 | Gaia Synthesis | Verdant Warden | ancient canopy basin | roots, beast allies, restoration | Grove Guardians |
| 09 | Animus Prime | Steel Titan | cyan forge basin | shock impact, mechanical companions | Prime Automata |
| 10 | Aether Link | Signal Matriarch | amber beacon desert | chain lightning, fast orders | Relay Riders |
| 11 | Obsidian Arc | Black-Eye Warlord | obsidian breach fortress | stealth, fear, counterattacks | Arc Stalkers |
| 12 | Kinetic Edge | Arena Champion | emerald sun arena | momentum, parries, dash strikes | Velocity Runners |
| 13 | Civic Core | Dove Emissary | rose civic gardens | protective auras, ally cohesion | Peacekeepers |
| 14 | Quantum Ledger | Balance Magister | silver vault catacombs | calculated risk, debt marks | Ledger Wardens |
| 15 | Signal Velocity | Flame Herald | scarlet signal mesas | critical chains, tempo surges | Broadcast Raiders |
| 16 | Juris Guard | Ivory Justiciar | marble tribunal ruins | judgments, barriers, restraints | Oath Knights |
| 17 | Cognara Mind | Mindweaver | wine-red memory forest | charm, fear, perception control | Thought Scribes |
| 18 | Vector Shift | Iron Marshal | storm foundry plateau | heavy blows, artillery orders | Forge Breakers |
| 19 | Nomad Nexus | Horizon Cartographer | ochre caravan sea | mobility, scouting, supply caches | Dune Rovers |
| 20 | Eon Core | Chronarch Elder | pale-gold infinity ruins | delayed impact, long-cycle boons | Epoch Keepers |

## Individual Asset Plan

Each civilization has a unique visual kit generated from the roster reference: leader portrait, gameplay character, elite unit, vanguard, ranger, boss, champion sigil, ability glyphs, HUD accent, shrine, relic well, dominant architecture, terrain texture treatment, prop set, map backdrop and one weather/event treatment. Asset creation will use generated source art where it materially improves fidelity, then compose optimized in-game assets from it. Procedural geometry is allowed only for terrain foundation, particles, collision and distant environmental dressing; it must not stand in for final characters or key structures.

The first playable build will include full visual assets and playable mechanics for all 20 rulers, with the 20 maps implemented as distinctive arena layouts and biomes. The most expensive staged art—individual high-detail enemy portraits and bespoke boss meshes for all 20 factions—will be represented by unique original 2.5D sprite/portrait compositions and themed gameplay silhouettes, then designed for later GLB substitution without changing combat code.

## UI and Screen Specification

- **Title:** animated logo, selected civilization sigil, primary/secondary navigation and ambient settings access.
- **Selection hall:** 20 civilization cards, active leader tableau, compact stat comparison, mode selection and start button.
- **Campaign map:** realm nodes, theater legend, mission intel panel, Dominion count, unlock path and return action.
- **Battle HUD:** health/stamina/command bars, ability cards with cooldown rings, summon count, tactical order indicator, objective ribbon, minimap, wave timer, boss health, pause control and touch controls when appropriate.
- **Pause/settings:** resume, controls, visual quality, motion reduction, audio, restart and return-to-title confirmation.
- **Results:** score, wave/objective outcome, kills, shrine integrity, relic choices, new best indicator, rewards and replay/continue actions.
- **Codex:** all 20 civilizations with themes, stat summaries, map, doctrine, unit and lore.

## Accessibility, Reliability and Performance

- Respect reduced-motion preference, expose audio mute/volume sliders and minimum 4.5:1 contrast for important UI text.
- Avoid color-only mechanics: abilities, factions and objectives use labels, icons and distinct shapes.
- Responsive layout supports 320 px wide touch screens through large controls and collapsible HUD panels; desktop uses pointer-rich layout.
- Target 60 FPS on contemporary desktop and a stable 30 FPS on mobile. Adaptive quality toggles particles, shadow resolution, terrain layers and post effects.
- Use deterministic seeded random values per run for terrain dressing and wave composition so retries are reproducible when desired.
- Handle WebGL failure with a user-facing fallback message and graceful menu state. Handle `localStorage` failure with session-only progress.

## Acceptance Criteria

1. A user can open the local HTML5 build, reach a polished title screen and select any of the 20 civilizations.
2. Every selection opens a differentiated map and playable combat kit with a named ruler, four abilities, unique palette, elite unit and factional enemy presentation.
3. Conquest Campaign and Endless Survival can both start, progress, end, display results and return to navigation without reload.
4. Battle input works with keyboard/mouse and touch controls; pause/restart/return actions preserve or reset state appropriately.
5. HUD values, cooldowns, objectives, score, missions, waves, relic drafts and local progress visibly update from actual game state.
6. There are no non-functional primary controls, broken screen paths, console errors during supported play, missing local assets or dead-end flows.
7. The build is visually authored: material-rich environments, factional character/structure compositions, atmospheric lighting, weather/particles, screen transitions and readable premium UI—not generic rectangles on an empty field.

## Known Delivery Boundary

The first deliverable is a complete playable browser game foundation and vertical-slice campaign experience with all twenty playable civilization paths and distinctive map kits. It will be production-structured so additional story chapters, network multiplayer, fully rigged GLB character animation, voice acting, external leaderboards and a 20-chapter linear campaign can be added as later releases. Those larger systems are not falsely represented as complete in the initial standalone HTML5 deliverable.
