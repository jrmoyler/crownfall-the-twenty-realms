import * as THREE from 'three';
import { animateLivingWorld, animateRig, buildMaterialWorld, createRiggedActor, setRigState } from './render/assetRigs';
import { CIVILIZATIONS, byId } from './simulation/catalog';
import type { Civilization, CivilizationId } from './simulation/types';
import './styles.css';
import './polish.css';

type Mode = 'campaign' | 'survival';
type Screen = 'title' | 'select' | 'campaign' | 'codex' | 'settings' | 'battle' | 'results';

const app = document.querySelector<HTMLDivElement>('#app')!;

const profileKey = 'crownfall-profile-v1';
type Profile = { best: Record<string, number>; completed: string[]; reducedMotion: boolean; muted: boolean };
const getProfile = (): Profile => {
  try { return { best: {}, completed: [], reducedMotion: false, muted: false, ...JSON.parse(localStorage.getItem(profileKey) ?? '{}') }; }
  catch { return { best: {}, completed: [], reducedMotion: false, muted: false }; }
};
const saveProfile = (profile: Profile) => { try { localStorage.setItem(profileKey, JSON.stringify(profile)); } catch { /* session fallback */ } };
let profile = getProfile();
let selected: CivilizationId = 'collective';
let activeMode: Mode = 'survival';
let activeGame: RealmGame | null = null;

const icon = (name: string) => `<span class="icon icon-${name}" aria-hidden="true"></span>`;
const button = (label: string, action: string, extra = '') => `<button class="button ${extra}" data-action="${action}">${label}</button>`;
const civilization = () => byId(selected);
const nav = (compact = false) => `<header class="topbar ${compact ? 'topbar--compact' : ''}"><button class="wordmark" data-action="title" aria-label="Crownfall home"><span>CROWN</span>FALL <i>XX</i></button><nav><button data-action="select-survival">Survival</button><button data-action="campaign">Conquest</button><button data-action="codex">Codex</button><button data-action="settings">${icon('settings')}</button></nav></header>`;

function setScreen(screen: Screen, mode?: Mode): void {
  activeGame?.dispose(); activeGame = null;
  if (mode) activeMode = mode;
  if (screen === 'title') renderTitle();
  if (screen === 'select') renderSelect(activeMode);
  if (screen === 'campaign') renderCampaign();
  if (screen === 'codex') renderCodex();
  if (screen === 'settings') renderSettings();
  if (screen === 'results') renderResults();
}

function renderTitle(): void {
  app.innerHTML = `<main class="title-screen"><div class="title-screen__art"></div><div class="title-screen__veil"></div>${nav()}<section class="title-copy"><p class="eyebrow">THE TWENTY REALMS</p><h1><span>CROWN</span>FALL</h1><p class="subtitle">Lead a civilization. Command its legions. Survive the age of rivals.</p><div class="title-actions">${button('Begin Conquest', 'select-campaign', 'button--gold')}${button('Endless Survival', 'select-survival', 'button--ghost')}</div><p class="controls-line">20 playable civilizations · desktop + touch controls</p></section><aside class="title-seal"><span class="seal-ring"></span><b>XX</b><small>REALMS IN CONFLICT</small></aside></main>`;
  wireUi();
}

function renderSelect(mode: Mode): void {
  const current = civilization();
  app.innerHTML = `<main class="shell selection-shell">${nav()}<section class="selection-head"><div><p class="eyebrow">${mode === 'survival' ? 'ENDLESS SURVIVAL' : 'CHOOSE YOUR DYNASTY'}</p><h2>Choose the realm<br><em>that carries your crown.</em></h2></div><div class="selection-mode"><button class="mode-chip ${mode === 'campaign' ? 'active' : ''}" data-action="select-campaign">Conquest</button><button class="mode-chip ${mode === 'survival' ? 'active' : ''}" data-action="select-survival">Survival</button></div></section><section class="selection-layout"><aside class="ruler-panel" style="--realm:${current.palette.primary};--glow:${current.palette.glow};"><div class="ruler-panel__art"><img src="/assets/civilization-atlas.png" alt="Original ancient civilization asset atlas" /></div><div class="ruler-panel__mist"></div><p class="eyebrow">${String(current.index).padStart(2, '0')} · ${current.biome}</p><h3>${current.name}</h3><p class="ruler-title">${current.title} · ${current.ruler}</p><p>${current.doctrine}</p><dl><div><dt>WEAPON</dt><dd>${current.weapon}</dd></div><div><dt>ELITE</dt><dd>${current.elite}</dd></div><div><dt>THREAT</dt><dd>${'◆'.repeat(current.difficulty)}${'◇'.repeat(4 - current.difficulty)}</dd></div></dl><div class="ability-list">${current.abilities.map((ability, index) => `<span><b>${['Q','E','R','F'][index]}</b>${ability}</span>`).join('')}</div>${button(mode === 'campaign' ? 'Open War Map' : 'Enter Survival', mode === 'campaign' ? 'campaign' : 'battle', 'button--gold button--full')}</aside><section class="civilization-grid" aria-label="Select civilization">${CIVILIZATIONS.map((c) => `<button class="civilization-card ${c.id === selected ? 'selected' : ''}" data-civ="${c.id}" style="--realm:${c.palette.primary};--glow:${c.palette.glow}"><span class="civilization-card__number">${String(c.index).padStart(2, '0')}</span><span class="civilization-card__sigil">${sigil(c.index)}</span><strong>${c.name}</strong><small>${c.biome}</small></button>`).join('')}</section></section></main>`;
  wireUi();
}

function renderCampaign(): void {
  const leader = civilization();
  const realmNodes = CIVILIZATIONS.map((c, index) => {
    const angle = (index / 20) * Math.PI * 2 - Math.PI / 2;
    const radius = index === leader.index - 1 ? 0 : 33 + (index % 4) * 7;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius * .68;
    const done = profile.completed.includes(c.id);
    return `<button class="realm-node ${c.id === selected ? 'realm-node--home' : ''} ${done ? 'realm-node--done' : ''}" data-civ="${c.id}" style="--x:${x}%;--y:${y}%;--realm:${c.palette.primary};--glow:${c.palette.glow}" title="${c.name}"><i>${sigil(c.index)}</i><span>${c.name}</span></button>`;
  }).join('');
  app.innerHTML = `<main class="shell campaign-shell">${nav()}<section class="campaign-intro"><div><p class="eyebrow">CONQUEST CAMPAIGN</p><h2>The war map<br><em>awaits a sovereign.</em></h2></div><div class="dominion"><small>DOMINION</small><b>${profile.completed.length.toString().padStart(2, '0')}</b><span>/ 20 REALMS</span></div></section><section class="war-map"><img src="/assets/crownfall-title.png" alt="Ancient world map under eclipse"/><div class="war-map__grid"></div>${realmNodes}<div class="war-map__legend"><span>${sigil(leader.index)}</span><div><b>${leader.name}</b><small>${leader.biome}</small></div></div></section><section class="mission-console"><div><p class="eyebrow">NEXT INCURSION</p><h3>${leader.name}: ${leader.biome}</h3><p>Secure two relic wells. Hold the shrine. Break the rival warlord on Wave V.</p></div><div class="mission-rewards"><span>+ Dominion</span><span>+ Relic draft</span><span>+ Rival intel</span></div>${button('Enter Realm', 'battle', 'button--gold')}</section></main>`;
  wireUi();
}

function renderCodex(): void {
  app.innerHTML = `<main class="shell codex-shell">${nav()}<section class="codex-heading"><p class="eyebrow">THE CIVILIZATION CODEX</p><h2>Twenty crowns.<br><em>Twenty ways to survive.</em></h2></section><section class="codex-grid">${CIVILIZATIONS.map((c) => `<article class="codex-entry" style="--realm:${c.palette.primary};--glow:${c.palette.glow}"><div><span>${String(c.index).padStart(2,'0')}</span><i>${sigil(c.index)}</i></div><h3>${c.name}</h3><p>${c.ruler}, ${c.title}</p><small>${c.biome}</small><hr/><b>${c.doctrine}</b><ul>${c.abilities.map((a) => `<li>${a}</li>`).join('')}</ul><button data-civ="${c.id}">Choose realm →</button></article>`).join('')}</section></main>`;
  wireUi();
}

function renderSettings(): void {
  app.innerHTML = `<main class="shell settings-shell">${nav()}<section class="settings-panel"><p class="eyebrow">FIELD SETTINGS</p><h2>Prepare the realm.</h2><label class="toggle-row"><span><b>Reduced motion</b><small>Limits camera shake and weather particles</small></span><input type="checkbox" data-setting="motion" ${profile.reducedMotion ? 'checked' : ''}/></label><label class="toggle-row"><span><b>Audio muted</b><small>Silences browser-synthesized battle cues</small></span><input type="checkbox" data-setting="mute" ${profile.muted ? 'checked' : ''}/></label><div class="settings-actions">${button('Return to title', 'title', 'button--ghost')}</div></section></main>`;
  wireUi();
}

function renderResults(): void {
  const last = (window as Window & { crownfallResult?: RunResult }).crownfallResult;
  const win = last?.victory ?? false;
  const civ = civilization();
  app.innerHTML = `<main class="results-screen" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}"><div class="results-screen__art"></div><section class="results-card"><p class="eyebrow">${win ? 'REALM SECURED' : 'THE CROWN ENDURES'}</p><h2>${win ? 'Victory.' : 'Fallen, not forgotten.'}</h2><p class="results-lore">${win ? `${civ.name} has claimed another horizon.` : `${civ.ruler} returns to the war table stronger than before.`}</p><div class="score-grid"><div><small>WAVE</small><b>${last?.wave ?? 1}</b></div><div><small>ENEMIES</small><b>${last?.kills ?? 0}</b></div><div><small>SCORE</small><b>${(last?.score ?? 0).toLocaleString()}</b></div><div><small>SHRINE</small><b>${Math.round((last?.shrine ?? 0) * 100)}%</b></div></div><div class="result-actions">${button('Fight again', 'battle', 'button--gold')}${button('Choose civilization', 'select-survival', 'button--ghost')}${button('War map', 'campaign', 'button--ghost')}</div></section></main>`;
  wireUi();
}

function sigil(index: number): string { return ['✦','◉','⌘','✹','◈','⌬','⬡','❋','◌','⌁','◉','✧','❖','⚖','↗','✦','◍','▰','✥','∞'][index - 1] ?? '✦'; }

function wireUi(): void {
  app.querySelectorAll<HTMLElement>('[data-civ]').forEach((element) => element.addEventListener('click', () => { selected = element.dataset.civ as CivilizationId; if (element.classList.contains('realm-node')) renderCampaign(); else setScreen('select', activeMode); }));
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => {
    const action = element.dataset.action;
    if (action === 'title') setScreen('title');
    if (action === 'select-survival') setScreen('select', 'survival');
    if (action === 'select-campaign') setScreen('select', 'campaign');
    if (action === 'campaign') setScreen('campaign', 'campaign');
    if (action === 'codex') setScreen('codex');
    if (action === 'settings') setScreen('settings');
    if (action === 'battle') startBattle(activeMode);
  }));
  app.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => input.addEventListener('change', () => { if (input.dataset.setting === 'motion') profile.reducedMotion = input.checked; if (input.dataset.setting === 'mute') profile.muted = input.checked; saveProfile(profile); }));
}

function startBattle(mode: Mode): void {
  activeMode = mode;
  const civ = civilization();
  app.innerHTML = `<main class="battle-shell" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}"><canvas id="realm-canvas" aria-label="${civ.name} battlefield"></canvas><div class="battle-vignette"></div><header class="battle-top"><div class="realm-chip"><i>${sigil(civ.index)}</i><div><b>${civ.name}</b><small>${mode === 'campaign' ? 'CONQUEST · REALM INCURSION' : 'ENDLESS SURVIVAL'}</small></div></div><div class="objective"><small>OBJECTIVE</small><b id="objective-text">Attune the first shrine</b><span id="wave-label">WAVE I</span></div><button class="pause-button" data-battle="pause" aria-label="Pause game">Ⅱ</button></header><aside class="player-vitals"><div><label>VITALITY</label><span><i id="health-fill"></i></span><b id="health-text">100 / 100</b></div><div><label>STAMINA</label><span><i id="stamina-fill"></i></span></div><div><label>COMMAND</label><span><i id="command-fill"></i></span></div></aside><aside class="battle-side"><div class="shrine-meter"><small>SHRINE ATTUNEMENT</small><div><i id="shrine-fill"></i></div><b id="shrine-text">0%</b></div><div class="combat-feed" id="combat-feed"><span>The realm awakens.</span></div></aside><footer class="battle-bottom"><div class="ability-bar">${civ.abilities.map((ability, index) => `<button class="ability" data-ability="${index}"><kbd>${['Q','E','R','F'][index]}</kbd><i>${sigil(civ.index + index)}</i><span>${ability}</span><em id="cooldown-${index}"></em></button>`).join('')}<button class="ability command" data-ability="4"><kbd>C</kbd><i>✥</i><span>Call ${civ.elite}</span><em id="cooldown-4"></em></button></div><div class="control-hint"><span>WASD <b>Move</b></span><span>CLICK <b>Strike</b></span><span>SPACE <b>Dodge</b></span></div></footer><div class="touch-controls"><div class="touch-stick" data-touch="stick"><i></i></div><div class="touch-actions"><button data-ability="0">Q</button><button data-ability="1">E</button><button data-ability="2">R</button><button data-ability="3">F</button><button data-battle="attack" class="touch-attack">⚔</button></div></div><div class="pause-overlay hidden" id="pause-overlay"><div><p class="eyebrow">THE WORLD HOLDS ITS BREATH</p><h2>Paused</h2>${button('Resume', 'resume', 'button--gold')}${button('Restart battle', 'restart', 'button--ghost')}${button('Leave realm', 'leave', 'button--ghost')}</div></div></main>`;
  const canvas = document.querySelector<HTMLCanvasElement>('#realm-canvas');
  if (!canvas) return;
  activeGame = new RealmGame(canvas, civ, mode, (result) => {
    (window as Window & { crownfallResult?: RunResult }).crownfallResult = result;
    if (result.victory && mode === 'campaign' && !profile.completed.includes(civ.id)) profile.completed.push(civ.id);
    profile.best[civ.id] = Math.max(profile.best[civ.id] ?? 0, result.score); saveProfile(profile); setScreen('results');
  });
  app.querySelectorAll<HTMLElement>('[data-ability]').forEach((item) => item.addEventListener('click', () => activeGame?.ability(Number(item.dataset.ability))));
  app.querySelector<HTMLElement>('[data-battle="pause"]')?.addEventListener('click', () => activeGame?.togglePause());
  app.querySelector<HTMLElement>('[data-battle="attack"]')?.addEventListener('click', () => activeGame?.attack());
  app.querySelector<HTMLElement>('[data-action="resume"]')?.addEventListener('click', () => activeGame?.togglePause());
  app.querySelector<HTMLElement>('[data-action="restart"]')?.addEventListener('click', () => startBattle(mode));
  app.querySelector<HTMLElement>('[data-action="leave"]')?.addEventListener('click', () => setScreen('title'));
  const stick = app.querySelector<HTMLElement>('[data-touch="stick"]');
  if (stick) {
    let stickPointer: number | null = null;
    const updateStick = (event: PointerEvent) => { const bounds = stick.getBoundingClientRect(); const x = Math.max(-1, Math.min(1, (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2))); const z = Math.max(-1, Math.min(1, (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2))); activeGame?.setTouchVector(x, z); const knob = stick.querySelector<HTMLElement>('i'); if (knob) knob.style.transform = `translate(${x * 18}px, ${z * 18}px)`; };
    stick.addEventListener('pointerdown', (event) => { stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); updateStick(event); });
    stick.addEventListener('pointermove', (event) => { if (event.pointerId === stickPointer) updateStick(event); });
    const clear = (event: PointerEvent) => { if (event.pointerId !== stickPointer) return; stickPointer = null; activeGame?.setTouchVector(0, 0); const knob = stick.querySelector<HTMLElement>('i'); if (knob) knob.style.transform = ''; };
    stick.addEventListener('pointerup', clear); stick.addEventListener('pointercancel', clear);
  }
}

type Enemy = { mesh: THREE.Group; hp: number; max: number; speed: number; damage: number; boss: boolean; hit: number; phase: number };
type Ally = { mesh: THREE.Group; ttl: number; hit: number };
type Pulse = { mesh: THREE.Mesh; ttl: number; max: number };
type RunResult = { victory: boolean; wave: number; kills: number; score: number; shrine: number };

class RealmGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, .1, 100);
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly keys = new Set<string>();
  private readonly player: THREE.Group;
  private readonly enemies: Enemy[] = [];
  private readonly allies: Ally[] = [];
  private readonly pulses: Pulse[] = [];
  private readonly decor = new THREE.Group();
  private health = 100; private stamina = 100; private command = 35; private shrine = 0;
  private wave = 1; private kills = 0; private score = 0; private spawnTimer = 0; private combatTimer = 0;
  private attackCooldown = 0; private dodgeCooldown = 0; private invulnerable = 0; private paused = false; private ended = false;
  private readonly cooldowns = [0, 0, 0, 0, 0];
  private target = new THREE.Vector3(); private playerVelocity = new THREE.Vector3(); private touchVector = new THREE.Vector3(); private animation = 0; private disposed = false;
  private readonly pointerDown = (event: PointerEvent) => { if (event.button === 0) this.attack(); };
  private readonly keyDown = (event: KeyboardEvent) => this.onKey(event, true);
  private readonly keyUp = (event: KeyboardEvent) => this.onKey(event, false);
  private readonly movePointer = (event: PointerEvent) => this.onPointer(event);
  private readonly resize = () => this.fit();
  constructor(private readonly canvas: HTMLCanvasElement, private readonly civ: Civilization, private readonly mode: Mode, private readonly onEnd: (result: RunResult) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = !profile.reducedMotion; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1; this.scene.fog = new THREE.FogExp2(civ.palette.ground, .035);
    this.camera.position.set(0, 14, 15); this.camera.lookAt(0, 0, 0); this.scene.add(this.decor);
    this.world(); this.player = this.createActor(civ.palette.primary, civ.palette.glow, true); this.player.position.set(0, 0, 0); this.scene.add(this.player);
    this.fit(); window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp); canvas.addEventListener('pointermove', this.movePointer); canvas.addEventListener('pointerdown', this.pointerDown); this.canvas.style.touchAction = 'none';
    this.spawnWave(); this.tick();
  }
  private world(): void {
    const ambient = new THREE.HemisphereLight('#dce7ff', this.civ.palette.ground, 2.1); this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(this.civ.palette.glow, 3.2); sun.position.set(-8, 15, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); this.scene.add(sun);
    const floorMat = new THREE.MeshStandardMaterial({ color: this.civ.palette.ground, roughness: .87, metalness: .22 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(17, 80), floorMat); floor.rotateX(-Math.PI / 2); floor.receiveShadow = true; this.decor.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(16.7, .22, 10, 96), new THREE.MeshStandardMaterial({ color: this.civ.palette.primary, emissive: this.civ.palette.primary, emissiveIntensity: .35, metalness: .7, roughness: .23 })); rim.rotateX(Math.PI / 2); this.decor.add(rim);
    const shrine = this.createShrine(); this.decor.add(shrine);
    const relics = [new THREE.Vector3(-7, 0, -4), new THREE.Vector3(8, 0, 4)]; relics.forEach((position, index) => { const well = this.createWell(index); well.position.copy(position); this.decor.add(well); });
    const rng = seeded(this.civ.seed); for (let i = 0; i < 74; i += 1) { const a = rng() * Math.PI * 2; const r = 5 + rng() * 11; const h = .25 + rng() * 1.8; const prop = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(.13 + rng() * .28, .28 + rng() * .36, h, 6), new THREE.MeshStandardMaterial({ color: rng() > .65 ? this.civ.palette.primary : '#15151a', roughness: .8, metalness: .35 })); base.position.y = h / 2; base.castShadow = true; prop.add(base); if (rng() > .68) { const cap = new THREE.Mesh(new THREE.OctahedronGeometry(.25 + rng() * .25), new THREE.MeshStandardMaterial({ color: this.civ.palette.glow, emissive: this.civ.palette.glow, emissiveIntensity: .75 })); cap.position.y = h + .22; prop.add(cap); } prop.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); this.decor.add(prop); }
    const stars = new THREE.BufferGeometry(); const points = Array.from({ length: profile.reducedMotion ? 40 : 160 }, () => [(Math.random() - .5) * 42, 1 + Math.random() * 7, (Math.random() - .5) * 42]).flat(); stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); const dust = new THREE.Points(stars, new THREE.PointsMaterial({ color: this.civ.palette.glow, size: .055, transparent: true, opacity: .55 })); this.decor.add(dust);
  }
  private createShrine(): THREE.Group { const shrine = new THREE.Group(); const stone = new THREE.MeshStandardMaterial({ color: '#20212b', roughness: .5, metalness: .42 }); const glow = new THREE.MeshStandardMaterial({ color: this.civ.palette.primary, emissive: this.civ.palette.glow, emissiveIntensity: 1.7, metalness: .7 }); const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, .45, 10), stone); dais.position.y = .22; shrine.add(dais); const core = new THREE.Mesh(new THREE.OctahedronGeometry(.58), glow); core.position.y = 1.22; shrine.add(core); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .08, 8, 32), glow); ring.rotateX(Math.PI / 2); ring.position.y = .48; shrine.add(ring); for (let i = 0; i < 4; i += 1) { const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.12, .21, 1.35, 6), stone); pillar.position.set(Math.cos(i * Math.PI / 2) * 1.46, .67, Math.sin(i * Math.PI / 2) * 1.46); shrine.add(pillar); } return shrine; }
  private createWell(index: number): THREE.Group { const well = new THREE.Group(); const stone = new THREE.MeshStandardMaterial({ color: '#1b1c24', roughness: .55, metalness: .35 }); const glow = new THREE.MeshStandardMaterial({ color: this.civ.palette.glow, emissive: this.civ.palette.glow, emissiveIntensity: 1.25 }); const base = new THREE.Mesh(new THREE.CylinderGeometry(.7, .95, .25, 8), stone); base.position.y = .12; well.add(base); const crystal = new THREE.Mesh(new THREE.ConeGeometry(.28, .8, 5), glow); crystal.position.y = .64; crystal.rotation.y = index; well.add(crystal); const ring = new THREE.Mesh(new THREE.TorusGeometry(.68, .035, 6, 24), glow); ring.rotateX(Math.PI / 2); ring.position.y = .3; well.add(ring); return well; }
  private createActor(primary: string, glow: string, player = false): THREE.Group { const actor = new THREE.Group(); const dark = new THREE.MeshStandardMaterial({ color: player ? '#171724' : '#20141a', roughness: .45, metalness: .5 }); const color = new THREE.MeshStandardMaterial({ color: primary, emissive: primary, emissiveIntensity: .2, roughness: .32, metalness: .6 }); const lit = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.2, roughness: .22, metalness: .7 }); const shadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 18), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: .35 })); shadow.rotateX(-Math.PI / 2); shadow.position.y = .01; actor.add(shadow); const cloak = new THREE.Mesh(new THREE.ConeGeometry(.54, 1.28, 7), color); cloak.position.y = .67; cloak.scale.z = 1.12; cloak.castShadow = true; actor.add(cloak); const torso = new THREE.Mesh(new THREE.CylinderGeometry(.26, .35, .62, 7), dark); torso.position.y = 1.05; actor.add(torso); const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.23, 2), new THREE.MeshStandardMaterial({ color: '#d2b39b', roughness: .7 })); head.position.y = 1.47; actor.add(head); const crown = new THREE.Mesh(new THREE.TorusGeometry(.26, .045, 5, 12), lit); crown.position.y = 1.65; crown.rotateX(Math.PI / 2); actor.add(crown); const halo = new THREE.Mesh(new THREE.TorusGeometry(.63, .025, 6, 32), lit); halo.position.set(0, 1.4, .1); halo.rotateX(Math.PI / 2); actor.add(halo); const staff = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.42, 6), dark); shaft.position.y = .95; staff.add(shaft); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.13), lit); gem.position.y = 1.7; staff.add(gem); staff.position.set(.48, 0, .06); staff.rotation.z = -.18; actor.add(staff); if (player) { const banner = new THREE.Mesh(new THREE.PlaneGeometry(.55, .72), color); banner.position.set(-.48, 1.08, .12); banner.rotation.y = .3; actor.add(banner); } return actor; }
  private spawnWave(): void { const count = 5 + this.wave * 2; const rival = CIVILIZATIONS[(this.civ.index + this.wave + 5) % CIVILIZATIONS.length]; for (let i = 0; i < count; i += 1) this.spawnEnemy(rival, false); if (this.wave % 5 === 0) this.spawnEnemy(rival, true); this.feed(this.wave % 5 === 0 ? `${rival.title} enters the field.` : `${rival.name} advances on the shrine.`); }
  private spawnEnemy(rival: Civilization, boss: boolean): void { const a = Math.random() * Math.PI * 2; const r = 13 + Math.random() * 2; const mesh = this.createActor(rival.palette.primary, rival.palette.glow); mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); mesh.scale.setScalar(boss ? 1.7 : .86 + Math.random() * .18); this.scene.add(mesh); this.enemies.push({ mesh, hp: boss ? 230 + this.wave * 20 : 42 + this.wave * 8, max: boss ? 230 + this.wave * 20 : 42 + this.wave * 8, speed: boss ? 1.12 : 1.35 + Math.random() * .38, damage: boss ? 16 : 6, boss, hit: 0, phase: 0 }); }
  private onPointer(event: PointerEvent): void { const rect = this.canvas.getBoundingClientRect(); this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera); this.raycaster.ray.intersectPlane(this.ground, this.target); }
  private onKey(event: KeyboardEvent, down: boolean): void { const key = event.key.toLowerCase(); if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','q','e','r','f','c','escape'].includes(key)) event.preventDefault(); if (down) { if (key === ' ') this.dodge(); if (key === 'q') this.ability(0); if (key === 'e') this.ability(1); if (key === 'r') this.ability(2); if (key === 'f') this.ability(3); if (key === 'c') this.ability(4); if (key === 'escape') this.togglePause(); } if (down) this.keys.add(key); else this.keys.delete(key); }
  attack(): void { if (this.paused || this.attackCooldown > 0 || this.ended) return; this.attackCooldown = .33; this.pulse(2.1, 18 + this.command * .05, this.civ.palette.glow); this.enemies.forEach((enemy) => { if (enemy.mesh.position.distanceTo(this.player.position) < 2.45) this.damage(enemy, 18 + Math.random() * 8); }); this.feed('Crown strike.'); }
  dodge(): void { if (this.paused || this.dodgeCooldown > 0 || this.stamina < 20) return; this.stamina -= 20; this.dodgeCooldown = .75; this.invulnerable = .3; const direction = this.playerVelocity.lengthSq() > .01 ? this.playerVelocity.clone().normalize() : this.target.clone().sub(this.player.position).setY(0).normalize(); this.player.position.addScaledVector(direction, 2.05); this.pulse(.95, 0, this.civ.palette.primary); }
  ability(index: number): void { if (this.paused || this.ended || this.cooldowns[index] > 0) return; const cooldown = [5, 8, 13, 19, 15][index] ?? 10; this.cooldowns[index] = cooldown; if (index === 0) { this.pulse(3.2, 35, this.civ.palette.glow); }
    if (index === 1) { this.health = Math.min(100, this.health + 28); this.stamina = Math.min(100, this.stamina + 35); this.pulse(2.8, 0, '#ffffff'); this.feed('Ward restored vitality.'); }
    if (index === 2) { this.summon(3); this.pulse(4, 16, this.civ.palette.primary); }
    if (index === 3) { this.pulse(6.1, 75, this.civ.palette.glow); this.feed(`${this.civ.abilities[3]} unleashed.`); }
    if (index === 4) { if (this.command < 30) { this.cooldowns[index] = 0; this.feed('Command energy required.'); return; } this.command -= 30; this.summon(5); this.feed(`${this.civ.elite} answer the call.`); }
  }
  private summon(count: number): void { for (let i = 0; i < count; i += 1) { const ally = this.createActor(this.civ.palette.primary, this.civ.palette.glow); const a = (i / count) * Math.PI * 2; ally.position.copy(this.player.position).add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); ally.scale.setScalar(.72); this.scene.add(ally); this.allies.push({ mesh: ally, ttl: 15 + Math.random() * 8, hit: 0 }); } }
  private pulse(radius: number, damage: number, color: string): void { const mesh = new THREE.Mesh(new THREE.RingGeometry(.15, .25, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide })); mesh.rotateX(-Math.PI / 2); mesh.position.copy(this.player.position); mesh.position.y = .08; this.scene.add(mesh); this.pulses.push({ mesh, ttl: .65, max: radius }); if (damage > 0) this.enemies.forEach((enemy) => { if (enemy.mesh.position.distanceTo(this.player.position) < radius) this.damage(enemy, damage); }); }
  private damage(enemy: Enemy, amount: number): void { enemy.hp -= amount; enemy.hit = .16; if (enemy.hp <= 0) { this.scene.remove(enemy.mesh); this.enemies.splice(this.enemies.indexOf(enemy), 1); this.kills += 1; this.command = Math.min(100, this.command + (enemy.boss ? 35 : 5)); this.score += enemy.boss ? 1200 : 100 + this.wave * 15; this.feed(enemy.boss ? 'Warlord shattered!' : 'Rival defeated.'); } }
  private tick = (): void => { if (this.disposed) return; const delta = Math.min(this.clock.getDelta(), .05); if (!this.paused && !this.ended) this.update(delta); this.renderer.render(this.scene, this.camera); requestAnimationFrame(this.tick); };
  private update(dt: number): void { this.animation += dt; this.attackCooldown -= dt; this.dodgeCooldown -= dt; this.invulnerable -= dt; this.cooldowns.forEach((_, i) => { this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt); }); this.stamina = Math.min(100, this.stamina + dt * 13); this.command = Math.min(100, this.command + dt * (this.shrine > .65 ? 3 : .7));
    const movement = new THREE.Vector3((this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) + this.touchVector.x, 0, (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) + this.touchVector.z); if (movement.lengthSq() > 0) movement.normalize(); this.playerVelocity.lerp(movement.multiplyScalar(5), 1 - Math.exp(-10 * dt)); this.player.position.addScaledVector(this.playerVelocity, dt); if (this.player.position.length() > 14.2) this.player.position.setLength(14.2); const facing = this.target.clone().sub(this.player.position).setY(0); if (facing.lengthSq() > .01) this.player.rotation.y = Math.atan2(facing.x, facing.z);
    this.player.position.y = Math.sin(this.animation * 2.5) * .04; this.camera.position.lerp(new THREE.Vector3(this.player.position.x * .33, 14, 15 + this.player.position.z * .33), .05); this.camera.lookAt(this.player.position.x * .3, 0, this.player.position.z * .3);
    const distanceToShrine = this.player.position.length(); if (distanceToShrine < 3.1 && this.enemies.filter((enemy) => enemy.mesh.position.length() < 3.3).length < 2) this.shrine = Math.min(1, this.shrine + dt * .12); else this.shrine = Math.max(0, this.shrine - dt * .022);
    this.enemies.forEach((enemy) => { const vector = this.player.position.clone().sub(enemy.mesh.position).setY(0); const distance = vector.length(); vector.normalize(); enemy.mesh.position.addScaledVector(vector, enemy.speed * dt); enemy.mesh.rotation.y = Math.atan2(vector.x, vector.z); enemy.mesh.position.y = Math.sin(this.animation * 3 + enemy.max) * .035; if (enemy.hit > 0) { enemy.hit -= dt; enemy.mesh.scale.multiplyScalar(1 + dt * .85); } if (distance < 1.25 && enemy.hit <= 0 && this.invulnerable <= 0) { enemy.hit = enemy.boss ? .65 : .9; this.health -= enemy.damage; this.pulse(.7, 0, '#ff5c6e'); } });
    this.allies.forEach((ally) => { ally.ttl -= dt; const target = this.enemies[0]; if (target) { const direction = target.mesh.position.clone().sub(ally.mesh.position).setY(0); const distance = direction.length(); ally.mesh.rotation.y = Math.atan2(direction.x, direction.z); if (distance > 1.3) ally.mesh.position.addScaledVector(direction.normalize(), dt * 3); else if (ally.hit <= 0) { ally.hit = .72; this.damage(target, 9); } } else ally.mesh.position.lerp(this.player.position.clone().add(new THREE.Vector3(1.3, 0, 1.3)), dt * 1.5); ally.hit -= dt; if (ally.ttl <= 0) { this.scene.remove(ally.mesh); this.allies.splice(this.allies.indexOf(ally), 1); } });
    this.pulses.forEach((pulse) => { pulse.ttl -= dt; const t = 1 - pulse.ttl / .65; pulse.mesh.scale.setScalar(1 + t * pulse.max * 4); (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pulse.ttl / .65); if (pulse.ttl <= 0) { this.scene.remove(pulse.mesh); this.pulses.splice(this.pulses.indexOf(pulse), 1); } });
    if (this.enemies.length === 0) { this.spawnTimer += dt; if (this.spawnTimer > 2.2) { this.spawnTimer = 0; if (this.mode === 'campaign' && this.wave >= 5) return this.end(true); this.wave += 1; this.spawnWave(); } }
    if (this.health <= 0) this.end(false); this.combatTimer += dt; if (this.combatTimer > .09) { this.combatTimer = 0; this.paintHud(); }
  }
  private paintHud(): void { const set = (id: string, value: number) => { const element = document.querySelector<HTMLElement>(id); if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`; }; set('#health-fill', this.health); set('#stamina-fill', this.stamina); set('#command-fill', this.command); set('#shrine-fill', this.shrine * 100); const healthText = document.querySelector('#health-text'); if (healthText) healthText.textContent = `${Math.max(0, Math.ceil(this.health))} / 100`; const shrineText = document.querySelector('#shrine-text'); if (shrineText) shrineText.textContent = `${Math.round(this.shrine * 100)}%`; const wave = document.querySelector('#wave-label'); if (wave) wave.textContent = `WAVE ${roman(this.wave)}`; const objective = document.querySelector('#objective-text'); if (objective) objective.textContent = this.shrine < 1 ? `Attune the shrine · ${Math.round(this.shrine * 100)}%` : this.enemies.length ? `Defeat the ${this.enemies.length} rival forces` : 'The field falls silent'; this.cooldowns.forEach((cooldown, index) => { const el = document.querySelector<HTMLElement>(`#cooldown-${index}`); if (el) { el.style.setProperty('--cooldown', `${Math.min(1, cooldown / [5,8,13,19,15][index])}`); el.classList.toggle('active', cooldown > 0); } }); }
  private feed(text: string): void { const feed = document.querySelector('#combat-feed'); if (!feed) return; const line = document.createElement('span'); line.textContent = text; feed.prepend(line); while (feed.children.length > 3) feed.lastElementChild?.remove(); }
  setTouchVector(x: number, z: number): void { this.touchVector.set(x, 0, z); if (this.touchVector.lengthSq() > 1) this.touchVector.normalize(); }
  togglePause(): void { if (this.ended) return; this.paused = !this.paused; document.querySelector('#pause-overlay')?.classList.toggle('hidden', !this.paused); }
  private end(victory: boolean): void { if (this.ended) return; this.ended = true; setTimeout(() => this.onEnd({ victory, wave: this.wave, kills: this.kills, score: this.score + Math.floor(this.shrine * 500), shrine: this.shrine }), 650); }
  private fit(): void { const width = this.canvas.clientWidth; const height = this.canvas.clientHeight; this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(height, 1); this.camera.updateProjectionMatrix(); }
  dispose(): void { this.ended = true; this.disposed = true; window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); this.canvas.removeEventListener('pointermove', this.movePointer); this.canvas.removeEventListener('pointerdown', this.pointerDown); this.renderer.dispose(); }
}

function seeded(seed: number): () => number { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function roman(number: number): string { const values: [number, string][] = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; return values.reduce((result, [value, symbol]) => { while (number >= value) { result += symbol; number -= value; } return result; }, ''); }

const realmPrototype = RealmGame.prototype as unknown as Record<string, unknown>;
const originalUpdate = realmPrototype.update as (this: RealmGame, dt: number) => void;
const originalAttack = realmPrototype.attack as (this: RealmGame) => void;
const originalAbility = realmPrototype.ability as (this: RealmGame, index: number) => void;
realmPrototype.world = function worldOverride(this: RealmGame): void {
  const instance = this as unknown as { scene: THREE.Scene; decor: THREE.Group; civ: Civilization };
  buildMaterialWorld(instance);
};
realmPrototype.createActor = function actorOverride(this: RealmGame, primary: string, glow: string, player = false): THREE.Group {
  const instance = this as unknown as { civ: Civilization };
  const identity = player ? instance.civ : CIVILIZATIONS.find((item) => item.palette.primary === primary) ?? instance.civ;
  return createRiggedActor({ ...identity, palette: { ...identity.palette, primary, glow } }, player);
};
realmPrototype.update = function updateOverride(this: RealmGame, dt: number): void {
  originalUpdate.call(this, dt);
  const instance = this as unknown as { player: THREE.Group; playerVelocity: THREE.Vector3; enemies: Array<{ mesh: THREE.Group; hit: number }>; allies: Array<{ mesh: THREE.Group; hit: number }>; animation: number; decor: THREE.Group };
  animateRig(instance.player, instance.animation, instance.playerVelocity.length());
  instance.enemies.forEach((enemy) => { if (enemy.hit > 0) setRigState(enemy.mesh, 'hit', instance.animation, .22); animateRig(enemy.mesh, instance.animation, 1.15); });
  instance.allies.forEach((ally) => { if (ally.hit > .5) setRigState(ally.mesh, 'attack', instance.animation, .3); animateRig(ally.mesh, instance.animation, 1); });
  animateLivingWorld(instance.decor, instance.animation, instance.enemies.length / 10);
};
realmPrototype.attack = function attackOverride(this: RealmGame): void {
  const instance = this as unknown as { player: THREE.Group; animation: number };
  setRigState(instance.player, 'attack', instance.animation, .34);
  originalAttack.call(this);
};
realmPrototype.ability = function abilityOverride(this: RealmGame, index: number): void {
  const instance = this as unknown as { player: THREE.Group; animation: number };
  setRigState(instance.player, index === 4 ? 'summon' : 'cast', instance.animation, index === 3 ? .9 : .62);
  originalAbility.call(this, index);
};

renderTitle();
