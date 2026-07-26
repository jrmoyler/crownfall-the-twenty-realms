import * as THREE from 'three';
import { RealmAudio } from './audio/realmAudio';
import { animateRig, createRiggedActor, disposeActor, setRigState, type ActorVariant } from './render/characterRig';
import { animateEnvironment, buildEnvironment } from './render/environment';
import { BattlefieldVfx, type Telegraph } from './render/battlefieldVfx';
import { CinematicPipeline } from './render/cinematicPipeline';
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
let activePreview: SelectionPreview | null = null;

const icon = (name: string) => `<span class="icon icon-${name}" aria-hidden="true"></span>`;
const button = (label: string, action: string, extra = '') => `<button class="button ${extra}" data-action="${action}">${label}</button>`;
const civilization = () => byId(selected);
const nav = (compact = false) => `<header class="topbar ${compact ? 'topbar--compact' : ''}"><button class="wordmark" data-action="title" aria-label="Crownfall home"><span>CROWN</span>FALL <i>XX</i></button><nav><button data-action="select-survival">Survival</button><button data-action="campaign">Conquest</button><button data-action="codex">Codex</button><button data-action="settings">${icon('settings')}</button></nav></header>`;

function setScreen(screen: Screen, mode?: Mode): void {
  activeGame?.dispose(); activeGame = null;
  activePreview?.dispose(); activePreview = null;
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
  activePreview?.dispose();
  activePreview = null;
  const current = civilization();
  app.innerHTML = `<main class="shell selection-shell">${nav()}<section class="selection-head"><div><p class="eyebrow">${mode === 'survival' ? 'ENDLESS SURVIVAL' : 'CHOOSE YOUR DYNASTY'}</p><h2>Choose the realm<br><em>that carries your crown.</em></h2></div><div class="selection-mode"><button class="mode-chip ${mode === 'campaign' ? 'active' : ''}" data-action="select-campaign">Conquest</button><button class="mode-chip ${mode === 'survival' ? 'active' : ''}" data-action="select-survival">Survival</button></div></section><section class="selection-layout"><aside class="ruler-panel" style="--realm:${current.palette.primary};--glow:${current.palette.glow};"><div class="ruler-panel__art ruler-panel__art--3d"><canvas id="ruler-preview" aria-label="Rotating 3D preview of ${current.ruler}"></canvas><span>DRAG-FREE · LIVE RIG</span></div><div class="ruler-panel__mist"></div><p class="eyebrow">${String(current.index).padStart(2, '0')} · ${current.biome}</p><h3>${current.name}</h3><p class="ruler-title">${current.title} · ${current.ruler}</p><p>${current.doctrine}</p><dl><div><dt>WEAPON</dt><dd>${current.weapon}</dd></div><div><dt>ELITE</dt><dd>${current.elite}</dd></div><div><dt>THREAT</dt><dd>${'◆'.repeat(current.difficulty)}${'◇'.repeat(4 - current.difficulty)}</dd></div></dl><div class="ability-list">${current.abilities.map((ability, index) => `<span><b>${['Q','E','R','F'][index]}</b>${ability}</span>`).join('')}</div>${button(mode === 'campaign' ? 'Open War Map' : 'Enter Survival', mode === 'campaign' ? 'campaign' : 'battle', 'button--gold button--full')}</aside><section class="civilization-grid" aria-label="Select civilization">${CIVILIZATIONS.map((c) => `<button class="civilization-card ${c.id === selected ? 'selected' : ''}" data-civ="${c.id}" style="--realm:${c.palette.primary};--glow:${c.palette.glow}"><span class="civilization-card__number">${String(c.index).padStart(2, '0')}</span><span class="civilization-card__sigil">${sigil(c.index)}</span><strong>${c.name}</strong><small>${c.biome}</small></button>`).join('')}</section></section></main>`;
  wireUi();
  const preview = app.querySelector<HTMLCanvasElement>('#ruler-preview');
  if (preview) activePreview = new SelectionPreview(preview, current);
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
  app.innerHTML = `
    <main class="battle-shell" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}">
      <canvas id="realm-canvas" aria-label="${civ.name} battlefield"></canvas>
      <div class="battle-vignette"></div>
      <div class="aim-reticle" id="aim-reticle"><i></i><b></b></div>
      <div class="wave-cinematic" id="wave-cinematic"><small>INCURSION</small><b>WAVE I</b><span>THE REALM BREACHES</span></div>
      <div class="combo-callout" id="combo-callout"><b>0</b><span>CHAIN</span><em>×1.0</em></div>
      <header class="battle-top">
        <div class="realm-chip"><i>${sigil(civ.index)}</i><div><b>${civ.name}</b><small>${mode === 'campaign' ? 'CONQUEST · REALM INCURSION' : 'ENDLESS SURVIVAL'}</small></div></div>
        <div class="objective"><small>OBJECTIVE</small><b id="objective-text">Attune the crown shrine</b><span id="wave-label">WAVE I</span></div>
        <button class="pause-button" data-battle="pause" aria-label="Pause game">Ⅱ</button>
      </header>
      <section class="boss-bar hidden" id="boss-bar"><div><small id="boss-title">RIVAL WARLORD</small><b id="boss-name">SOVEREIGN</b></div><span><i id="boss-fill"></i></span></section>
      <aside class="player-vitals">
        <div><label>VITALITY</label><span><i id="health-fill"></i></span><b id="health-text">100 / 100</b></div>
        <div><label>STAMINA</label><span><i id="stamina-fill"></i></span></div>
        <div><label>COMMAND</label><span><i id="command-fill"></i></span></div>
      </aside>
      <aside class="battle-side">
        <div class="shrine-meter"><small>SHRINE ATTUNEMENT</small><div><i id="shrine-fill"></i></div><b id="shrine-text">0%</b></div>
        <div class="threat-meter"><small>RIVAL FORCE</small><b id="threat-text">SCOUTING</b><span id="enemy-count">0 HOSTILES</span></div>
        <div class="combat-feed" id="combat-feed"><span>The realm awakens.</span></div>
      </aside>
      <footer class="battle-bottom">
        <div class="ability-bar">
          ${civ.abilities.map((ability, index) => `<button class="ability" data-ability="${index}"><kbd>${['Q','E','R','F'][index]}</kbd><i>${sigil(civ.index + index)}</i><span>${ability}</span><em id="cooldown-${index}"></em></button>`).join('')}
          <button class="ability command" data-ability="4"><kbd>C</kbd><i>✥</i><span>Call ${civ.elite}</span><em id="cooldown-4"></em></button>
        </div>
        <div class="control-hint"><span>WASD <b>Move</b></span><span>LMB <b>Combo</b></span><span>RMB / SHIFT <b>Heavy</b></span><span>SPACE <b>Phase dodge</b></span></div>
      </footer>
      <div class="touch-controls">
        <div class="touch-stick" data-touch="stick"><i></i></div>
        <div class="touch-actions">
          <button data-ability="0">Q</button><button data-ability="1">E</button><button data-ability="2">R</button><button data-ability="3">F</button>
          <button data-battle="heavy" class="touch-heavy">✦</button>
          <button data-battle="attack" class="touch-attack">⚔</button>
        </div>
      </div>
      <div class="pause-overlay hidden" id="pause-overlay"><div><p class="eyebrow">THE WORLD HOLDS ITS BREATH</p><h2>Paused</h2>${button('Resume', 'resume', 'button--gold')}${button('Restart battle', 'restart', 'button--ghost')}${button('Leave realm', 'leave', 'button--ghost')}</div></div>
    </main>`;
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
  app.querySelector<HTMLElement>('[data-battle="heavy"]')?.addEventListener('click', () => activeGame?.heavyAttack());
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

class SelectionPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, .1, 20);
  private readonly actor: THREE.Group;
  private readonly platform: THREE.Mesh;
  private readonly clock = new THREE.Clock();
  private readonly observer: ResizeObserver;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, civ: Civilization) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.position.set(0, 1.35, 4.25);
    this.camera.lookAt(0, 1.15, 0);
    this.actor = createRiggedActor(civ, true, false, 'vanguard');
    this.actor.position.y = -.02;
    this.actor.rotation.y = -.35;
    this.scene.add(this.actor);
    const key = new THREE.DirectionalLight('#fff0ce', 4.5);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    const rim = new THREE.DirectionalLight(civ.palette.glow, 5.2);
    rim.position.set(4, 2, -3);
    const fill = new THREE.HemisphereLight('#c9dbff', '#16101f', 2.1);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: '#15131d',
      emissive: civ.palette.primary,
      emissiveIntensity: .18,
      metalness: .75,
      roughness: .28,
    });
    this.platform = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.35, .18, 48), platformMaterial);
    this.platform.position.y = -.08;
    this.platform.receiveShadow = true;
    this.scene.add(key, rim, fill, this.platform);
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(canvas);
    this.fit();
    this.render();
  }

  private fit(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private render = (): void => {
    if (this.disposed) return;
    const delta = Math.min(.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.actor.rotation.y += delta * .34;
    animateRig(this.actor, time, 0);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    disposeActor(this.actor);
    this.platform.geometry.dispose();
    (this.platform.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}

type EnemyRole = ActorVariant;
type Enemy = {
  mesh: THREE.Group;
  hp: number;
  max: number;
  speed: number;
  damage: number;
  boss: boolean;
  role: EnemyRole;
  rival: Civilization;
  attackCooldown: number;
  windup: number;
  hit: number;
  strafe: number;
  phase: number;
  motion: number;
  telegraph?: Telegraph;
};
type Ally = { mesh: THREE.Group; ttl: number; attackCooldown: number; phase: number };
type Pulse = { mesh: THREE.Mesh; ttl: number; max: number; life: number };
type Projectile = { mesh: THREE.Mesh; velocity: THREE.Vector3; damage: number; hostile: boolean; ttl: number; color: string };
type Relic = { mesh: THREE.Group; velocity: THREE.Vector3; age: number; value: number };
type DelayedStrike = { ttl: number; radius: number; damage: number; color: string };
type RunResult = { victory: boolean; wave: number; kills: number; score: number; shrine: number };

class RealmGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly pipeline: CinematicPipeline;
  private readonly vfx: BattlefieldVfx;
  private readonly audio = new RealmAudio(() => profile.muted);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, .1, 120);
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly keys = new Set<string>();
  private readonly player: THREE.Group;
  private readonly enemies: Enemy[] = [];
  private readonly allies: Ally[] = [];
  private readonly pulses: Pulse[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly relics: Relic[] = [];
  private readonly delayedStrikes: DelayedStrike[] = [];
  private readonly decor = new THREE.Group();
  private readonly cameraLook = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cooldowns = [0, 0, 0, 0, 0];
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly playerVelocity = new THREE.Vector3();
  private readonly touchVector = new THREE.Vector3();

  private health = 100;
  private stamina = 100;
  private command = 35;
  private shrine = 0;
  private wave = 1;
  private kills = 0;
  private score = 0;
  private spawnTimer = 0;
  private combatTimer = 0;
  private attackCooldown = 0;
  private dodgeCooldown = 0;
  private invulnerable = 0;
  private combo = 0;
  private comboTimer = 0;
  private multiplier = 1;
  private cameraShake = 0;
  private hitStop = 0;
  private animation = 0;
  private paused = false;
  private ended = false;
  private disposed = false;

  private readonly pointerDown = (event: PointerEvent) => {
    if (event.button === 0) this.attack();
    if (event.button === 2) this.heavyAttack();
  };
  private readonly preventMenu = (event: Event) => event.preventDefault();
  private readonly keyDown = (event: KeyboardEvent) => this.onKey(event, true);
  private readonly keyUp = (event: KeyboardEvent) => this.onKey(event, false);
  private readonly movePointer = (event: PointerEvent) => this.onPointer(event);
  private readonly resize = () => this.fit();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly civ: Civilization,
    private readonly mode: Mode,
    private readonly onEnd: (result: RunResult) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.35 : 1.85));
    this.renderer.shadowMap.enabled = !profile.reducedMotion;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.pipeline = new CinematicPipeline(this.renderer, this.scene, this.camera);
    this.vfx = new BattlefieldVfx(this.scene);
    this.camera.position.set(0, 13.5, 15.8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.decor);
    this.world();
    this.player = createRiggedActor(civ, true, false, 'vanguard');
    this.player.position.set(0, 0, 5.5);
    this.scene.add(this.player);
    this.fit();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    canvas.addEventListener('pointermove', this.movePointer);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('contextmenu', this.preventMenu);
    this.canvas.style.touchAction = 'none';
    this.spawnWave();
    this.tick();
  }

  private world(): void {
    buildEnvironment({ scene: this.scene, decor: this.decor, civ: this.civ });
  }

  private spawnWave(): void {
    const bossWave = this.wave % 5 === 0;
    const rival = CIVILIZATIONS[(this.civ.index + this.wave + 5) % CIVILIZATIONS.length];
    const count = 5 + Math.min(9, Math.ceil(this.wave * 1.55));
    for (let i = 0; i < count; i += 1) {
      const roles: EnemyRole[] = ['vanguard', 'skirmisher', 'vanguard', 'mystic', 'brute'];
      this.spawnEnemy(rival, false, roles[(i + this.wave) % roles.length]);
    }
    if (bossWave) this.spawnEnemy(rival, true, 'boss');
    this.feed(bossWave ? `${rival.ruler}, ${rival.title}, breaches the field.` : `${rival.name} deploys a mixed warband.`);
    this.showWaveCinematic(bossWave ? 'WARLORD INCURSION' : 'THE REALM BREACHES');
  }

  private spawnEnemy(rival: Civilization, boss: boolean, role: EnemyRole): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 13.2 + Math.random() * 1.7;
    const mesh = createRiggedActor(rival, false, boss, role);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    if (!boss) mesh.scale.multiplyScalar(.9 + Math.random() * .14);
    this.scene.add(mesh);
    const roleHealth = { vanguard: 1, skirmisher: .72, brute: 1.7, mystic: .82, boss: 6.2 }[role];
    const roleSpeed = { vanguard: 1.65, skirmisher: 2.65, brute: 1.08, mystic: 1.45, boss: 1.18 }[role];
    const roleDamage = { vanguard: 7, skirmisher: 6, brute: 13, mystic: 9, boss: 19 }[role];
    const max = (45 + this.wave * 8) * roleHealth;
    this.enemies.push({
      mesh,
      hp: max,
      max,
      speed: roleSpeed + Math.random() * .18,
      damage: roleDamage + this.wave * .45,
      boss,
      role,
      rival,
      attackCooldown: .5 + Math.random(),
      windup: -1,
      hit: 0,
      strafe: Math.random() > .5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
      motion: 0,
    });
  }

  private showWaveCinematic(subtitle: string): void {
    const element = document.querySelector<HTMLElement>('#wave-cinematic');
    if (!element) return;
    element.querySelector('b')!.textContent = `WAVE ${roman(this.wave)}`;
    element.querySelector('span')!.textContent = subtitle;
    element.classList.remove('play');
    void element.offsetWidth;
    element.classList.add('play');
  }

  private onPointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.ray.intersectPlane(this.ground, this.target);
    const reticle = document.querySelector<HTMLElement>('#aim-reticle');
    if (reticle) reticle.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'q', 'e', 'r', 'f', 'c', 'escape'].includes(key)) event.preventDefault();
    if (down && !event.repeat) {
      if (key === ' ') this.dodge();
      if (key === 'shift') this.heavyAttack();
      if (key === 'q') this.ability(0);
      if (key === 'e') this.ability(1);
      if (key === 'r') this.ability(2);
      if (key === 'f') this.ability(3);
      if (key === 'c') this.ability(4);
      if (key === 'escape') this.togglePause();
    }
    if (down) this.keys.add(key);
    else this.keys.delete(key);
  }

  attack(): void {
    if (this.paused || this.attackCooldown > .04 || this.ended) return;
    this.combo = this.comboTimer > 0 ? this.combo % 3 + 1 : 1;
    this.comboTimer = 1.05;
    const final = this.combo === 3;
    this.attackCooldown = final ? .42 : .24;
    const direction = this.facingDirection();
    const yaw = Math.atan2(direction.x, direction.z);
    setRigState(this.player, this.combo === 2 ? 'attack2' : final ? 'heavy' : 'attack', this.animation, final ? .48 : .3);
    this.audio.cue(final ? 'heavy' : 'strike');
    this.vfx.slash(this.player.position, yaw, this.civ.palette.glow, this.combo - 1);

    const range = final ? 3.05 : 2.6;
    const arc = final ? -.15 : .12;
    let hits = 0;
    [...this.enemies].forEach((enemy) => {
      const toEnemy = enemy.mesh.position.clone().sub(this.player.position).setY(0);
      const distance = toEnemy.length();
      if (distance <= range && toEnemy.normalize().dot(direction) > arc) {
        this.damageEnemy(enemy, (final ? 37 : 19 + this.combo * 3) + this.command * .025, direction);
        hits += 1;
      }
    });
    if (hits > 0) {
      this.hitStop = final ? .075 : .035;
      this.cameraShake = Math.max(this.cameraShake, final ? .42 : .18);
      this.multiplier = Math.min(4, this.multiplier + hits * .09);
    }
  }

  heavyAttack(): void {
    if (this.paused || this.attackCooldown > 0 || this.stamina < 28 || this.ended) return;
    this.stamina -= 28;
    this.attackCooldown = .82;
    this.combo = 0;
    this.comboTimer = 0;
    setRigState(this.player, 'heavy', this.animation, .78);
    this.audio.cue('heavy');
    this.delayedStrikes.push({ ttl: .42, radius: 3.75, damage: 48 + this.command * .06, color: this.civ.palette.glow });
    this.feed('Sovereign breaker charging.');
  }

  dodge(): void {
    if (this.paused || this.dodgeCooldown > 0 || this.stamina < 18 || this.ended) return;
    this.stamina -= 18;
    this.dodgeCooldown = .62;
    this.invulnerable = .34;
    let direction = this.playerVelocity.clone().setY(0);
    if (direction.lengthSq() < .02) direction = this.facingDirection();
    direction.normalize();
    setRigState(this.player, 'dash', this.animation, .35);
    this.audio.cue('dodge');
    for (let i = 0; i < 5; i += 1) {
      this.vfx.trail(this.player.position.clone().addScaledVector(direction, i * .42), this.civ.palette.glow, .32 - i * .035);
    }
    this.player.position.addScaledVector(direction, 2.85);
    this.clampToArena(this.player.position);
    this.cameraShake = Math.max(this.cameraShake, .12);
  }

  ability(index: number): void {
    if (this.paused || this.ended || this.cooldowns[index] > 0) return;
    if (index === 4 && this.command < 30) {
      this.feed('Command energy required.');
      return;
    }
    const cooldown = [4.8, 8, 12, 18, 15][index] ?? 10;
    this.cooldowns[index] = cooldown;
    setRigState(this.player, index === 4 ? 'summon' : 'cast', this.animation, index === 3 ? .9 : .62);
    this.audio.cue(index >= 2 ? 'summon' : 'cast');
    if (index === 0) {
      const direction = this.facingDirection();
      this.player.position.addScaledVector(direction, 1.25);
      this.clampToArena(this.player.position);
      [...this.enemies].forEach((enemy) => {
        const offset = enemy.mesh.position.clone().sub(this.player.position).setY(0);
        if (offset.length() < 4.6 && offset.normalize().dot(direction) > .05) this.damageEnemy(enemy, 38, direction);
      });
      this.vfx.slash(this.player.position, Math.atan2(direction.x, direction.z), this.civ.palette.glow, 3);
      this.cameraShake = .38;
    }
    if (index === 1) {
      this.health = Math.min(100, this.health + 25);
      this.stamina = Math.min(100, this.stamina + 38);
      this.invulnerable = Math.max(this.invulnerable, 1.15);
      this.pulse(2.8, 0, '#ffffff');
      this.feed('Royal ward: damage immunity.');
    }
    if (index === 2) {
      this.summon(3);
      this.pulse(4, 17, this.civ.palette.primary);
    }
    if (index === 3) {
      this.pulse(7.4, 82 + this.wave * 2, this.civ.palette.glow);
      this.cameraShake = .9;
      this.hitStop = .12;
      this.feed(`${this.civ.abilities[3]} tears across the realm.`);
    }
    if (index === 4) {
      this.command -= 30;
      this.summon(5);
      this.feed(`${this.civ.elite} answer the crown.`);
    }
  }

  private facingDirection(): THREE.Vector3 {
    const direction = this.target.clone().sub(this.player.position).setY(0);
    if (direction.lengthSq() < .001) direction.set(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    return direction.normalize();
  }

  private summon(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const ally = createRiggedActor(this.civ, false, false, i % 3 === 0 ? 'brute' : 'skirmisher');
      const angle = (i / count) * Math.PI * 2;
      ally.position.copy(this.player.position).add(new THREE.Vector3(Math.cos(angle) * 1.4, 0, Math.sin(angle) * 1.4));
      ally.scale.multiplyScalar(.76);
      this.scene.add(ally);
      this.allies.push({ mesh: ally, ttl: 14 + Math.random() * 7, attackCooldown: Math.random() * .5, phase: angle });
    }
  }

  private pulse(radius: number, damage: number, color: string): void {
    const life = .68;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(.15, .28, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: .9,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.rotateX(-Math.PI / 2);
    mesh.position.copy(this.player.position);
    mesh.position.y = .08;
    this.scene.add(mesh);
    this.pulses.push({ mesh, ttl: life, max: radius, life });
    this.vfx.burst(this.player.position, color, radius, Math.min(2.8, .45 + radius * .22));
    if (damage > 0) {
      [...this.enemies].forEach((enemy) => {
        if (enemy.mesh.position.distanceTo(this.player.position) < radius) {
          const force = enemy.mesh.position.clone().sub(this.player.position).setY(0).normalize();
          this.damageEnemy(enemy, damage, force);
        }
      });
    }
  }

  private damageEnemy(enemy: Enemy, amount: number, force?: THREE.Vector3): void {
    if (!this.enemies.includes(enemy)) return;
    enemy.hp -= amount;
    enemy.hit = .18;
    if (force && !enemy.boss) enemy.mesh.position.addScaledVector(force, enemy.role === 'brute' ? .12 : .3);
    setRigState(enemy.mesh, 'hit', this.animation, .24);
    this.vfx.burst(enemy.mesh.position, this.civ.palette.glow, enemy.boss ? .85 : .48, enemy.boss ? .8 : .35);
    if (enemy.hp > 0) return;

    this.vfx.cancelTelegraph(enemy.telegraph);
    this.vfx.burst(enemy.mesh.position, enemy.boss ? '#ffd27a' : enemy.rival.palette.glow, enemy.boss ? 3.1 : 1.35, enemy.boss ? 2.7 : 1.1);
    this.spawnRelic(enemy.mesh.position, enemy.boss ? 6 : 1, enemy.rival.palette.glow);
    disposeActor(enemy.mesh);
    this.scene.remove(enemy.mesh);
    this.enemies.splice(this.enemies.indexOf(enemy), 1);
    this.kills += 1;
    const baseScore = enemy.boss ? 1800 : 110 + this.wave * 18;
    this.score += Math.round(baseScore * this.multiplier);
    this.multiplier = Math.min(4, this.multiplier + (enemy.boss ? .8 : .12));
    this.comboTimer = Math.max(this.comboTimer, 1.25);
    this.feed(enemy.boss ? `${enemy.rival.ruler} has fallen!` : `${enemy.role.toUpperCase()} broken · ×${this.multiplier.toFixed(1)}`);
  }

  private spawnRelic(position: THREE.Vector3, count: number, color: string): void {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: .18, metalness: .55 });
      const group = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.12, 1), material);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.19, .018, 7, 24), material);
      ring.rotation.x = Math.PI / 2;
      group.add(gem, ring);
      group.position.copy(position).add(new THREE.Vector3((Math.random() - .5) * .6, .35 + Math.random() * .4, (Math.random() - .5) * .6));
      this.scene.add(group);
      this.relics.push({
        mesh: group,
        velocity: new THREE.Vector3((Math.random() - .5) * 2.2, 1.5 + Math.random(), (Math.random() - .5) * 2.2),
        age: 0,
        value: count > 1 ? 7 : 4,
      });
    }
  }

  private fireProjectile(enemy: Enemy): void {
    const color = enemy.rival.palette.glow;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3,
      transparent: true,
      opacity: .95,
      roughness: .12,
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(enemy.boss ? .2 : .14, 1), material);
    mesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, 1.05, 0));
    this.scene.add(mesh);
    const velocity = this.player.position.clone().add(new THREE.Vector3(0, .55, 0)).sub(mesh.position).normalize().multiplyScalar(enemy.boss ? 8 : 6.2);
    this.projectiles.push({ mesh, velocity, damage: enemy.damage, hostile: true, ttl: 4, color });
  }

  private hurtPlayer(amount: number, source: THREE.Vector3): void {
    if (this.invulnerable > 0 || this.ended) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = .32;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = Math.max(1, this.multiplier - .45);
    const knock = this.player.position.clone().sub(source).setY(0).normalize();
    this.player.position.addScaledVector(knock, .42);
    this.clampToArena(this.player.position);
    setRigState(this.player, 'hit', this.animation, .28);
    this.vfx.burst(this.player.position, '#ff405f', 1.05, .85);
    this.audio.cue('hit');
    this.cameraShake = .72;
    this.hitStop = .07;
  }

  private beginEnemyAttack(enemy: Enemy): void {
    const duration = enemy.boss ? 1.05 : enemy.role === 'brute' ? .72 : enemy.role === 'mystic' ? .58 : .36;
    const radius = enemy.boss ? 3.25 : enemy.role === 'brute' ? 1.75 : enemy.role === 'mystic' ? .72 : 1.25;
    enemy.windup = duration;
    enemy.telegraph = this.vfx.telegraph(enemy.mesh.position, radius, enemy.rival.palette.glow, duration);
    setRigState(enemy.mesh, enemy.boss || enemy.role === 'brute' ? 'heavy' : enemy.role === 'mystic' ? 'cast' : 'attack', this.animation, duration + .18);
    if (enemy.boss) this.audio.cue('warning');
  }

  private resolveEnemyAttack(enemy: Enemy): void {
    this.vfx.cancelTelegraph(enemy.telegraph);
    enemy.telegraph = undefined;
    enemy.windup = -1;
    enemy.attackCooldown = enemy.boss ? 1.6 : enemy.role === 'mystic' ? 1.9 : enemy.role === 'brute' ? 1.35 : .82;
    if (enemy.role === 'mystic') {
      this.fireProjectile(enemy);
      return;
    }
    const radius = enemy.boss ? 3.35 : enemy.role === 'brute' ? 1.85 : 1.34;
    this.vfx.burst(enemy.mesh.position, enemy.rival.palette.glow, radius, enemy.boss ? 1.9 : .75);
    if (enemy.mesh.position.distanceTo(this.player.position) <= radius) this.hurtPlayer(enemy.damage, enemy.mesh.position);
  }

  private updatePlayer(dt: number): void {
    const movement = new THREE.Vector3(
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) + this.touchVector.x,
      0,
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) + this.touchVector.z,
    );
    if (movement.lengthSq() > 0) movement.normalize();
    const speed = this.invulnerable > .16 && this.dodgeCooldown > .25 ? 6.2 : 5.15;
    this.playerVelocity.lerp(movement.multiplyScalar(speed), 1 - Math.exp(-12 * dt));
    this.player.position.addScaledVector(this.playerVelocity, dt);
    this.clampToArena(this.player.position);
    const facing = this.facingDirection();
    const desiredYaw = Math.atan2(facing.x, facing.z);
    let deltaYaw = desiredYaw - this.player.rotation.y;
    deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
    this.player.rotation.y += deltaYaw * Math.min(1, dt * 18);

    const distanceToShrine = this.player.position.length();
    const enemiesAtShrine = this.enemies.filter((enemy) => enemy.mesh.position.length() < 3.5).length;
    if (distanceToShrine < 3.25 && enemiesAtShrine < 2) this.shrine = Math.min(1, this.shrine + dt * .145);
    else this.shrine = Math.max(0, this.shrine - dt * .012);
  }

  private updateEnemies(dt: number): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.attackCooldown -= dt;
      const toPlayer = this.player.position.clone().sub(enemy.mesh.position).setY(0);
      const distance = toPlayer.length();
      const direction = distance > .001 ? toPlayer.clone().multiplyScalar(1 / distance) : new THREE.Vector3(0, 0, 1);
      enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      enemy.motion = 0;

      if (enemy.windup >= 0) {
        enemy.windup -= dt;
        if (enemy.telegraph) enemy.telegraph.mesh.position.copy(enemy.mesh.position).setY(.075);
        if (enemy.windup <= 0) this.resolveEnemyAttack(enemy);
        animateRig(enemy.mesh, this.animation, 0);
        continue;
      }

      let move = direction.clone();
      const tangent = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(enemy.strafe);
      if (enemy.role === 'mystic') {
        if (distance < 5.2) move.multiplyScalar(-.7);
        else if (distance < 7.2) move.set(0, 0, 0);
        move.addScaledVector(tangent, .55);
      } else if (enemy.role === 'skirmisher') {
        move.addScaledVector(tangent, distance < 4 ? .75 : .25).normalize();
      } else if (enemy.boss && distance < 4.2) {
        move.addScaledVector(tangent, .42).normalize();
      }

      const attackRange = enemy.role === 'mystic' ? 8.3 : enemy.boss ? 3.15 : enemy.role === 'brute' ? 1.7 : 1.28;
      if (enemy.attackCooldown <= 0 && distance <= attackRange) {
        this.beginEnemyAttack(enemy);
      } else if (enemy.hit <= 0 && (distance > attackRange * .8 || enemy.role === 'mystic')) {
        const step = enemy.speed * dt;
        enemy.mesh.position.addScaledVector(move.normalize(), step);
        enemy.motion = enemy.speed;
        this.clampToArena(enemy.mesh.position, 15);
      }

      // Soft body separation keeps readable silhouettes instead of one enemy pile.
      for (let otherIndex = index - 1; otherIndex >= Math.max(0, index - 5); otherIndex -= 1) {
        const other = this.enemies[otherIndex];
        const separation = enemy.mesh.position.clone().sub(other.mesh.position).setY(0);
        const length = separation.length();
        if (length > .001 && length < .8) {
          separation.multiplyScalar((.8 - length) * .025 / length);
          enemy.mesh.position.add(separation);
          other.mesh.position.sub(separation);
        }
      }
      animateRig(enemy.mesh, this.animation, enemy.motion);
    }
  }

  private updateAllies(dt: number): void {
    for (let index = this.allies.length - 1; index >= 0; index -= 1) {
      const ally = this.allies[index];
      ally.ttl -= dt;
      ally.attackCooldown -= dt;
      let motion = 0;
      const target = this.nearestEnemy(ally.mesh.position);
      if (target) {
        const direction = target.mesh.position.clone().sub(ally.mesh.position).setY(0);
        const distance = direction.length();
        ally.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        if (distance > 1.45) {
          ally.mesh.position.addScaledVector(direction.normalize(), dt * 3.2);
          motion = 3.2;
        } else if (ally.attackCooldown <= 0) {
          ally.attackCooldown = .68;
          setRigState(ally.mesh, 'attack', this.animation, .34);
          this.damageEnemy(target, 11 + this.wave * .35, direction.normalize());
        }
      } else {
        const orbit = this.player.position.clone().add(new THREE.Vector3(Math.cos(this.animation + ally.phase) * 1.6, 0, Math.sin(this.animation + ally.phase) * 1.6));
        ally.mesh.position.lerp(orbit, dt * 1.8);
      }
      animateRig(ally.mesh, this.animation, motion);
      if (ally.ttl <= 0) {
        this.vfx.burst(ally.mesh.position, this.civ.palette.glow, .8, .45);
        disposeActor(ally.mesh);
        this.scene.remove(ally.mesh);
        this.allies.splice(index, 1);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.ttl -= dt;
      if (projectile.hostile) {
        const desired = this.player.position.clone().add(new THREE.Vector3(0, .55, 0)).sub(projectile.mesh.position).normalize().multiplyScalar(projectile.velocity.length());
        projectile.velocity.lerp(desired, dt * 1.15);
      }
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      projectile.mesh.rotation.x += dt * 8;
      projectile.mesh.rotation.y += dt * 11;
      this.vfx.trail(projectile.mesh.position, projectile.color, .09);
      if (projectile.hostile && projectile.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0, .6, 0))) < .62) {
        this.hurtPlayer(projectile.damage, projectile.mesh.position);
        this.removeProjectile(index, true);
      } else if (projectile.ttl <= 0) {
        this.removeProjectile(index, false);
      }
    }
  }

  private removeProjectile(index: number, impact: boolean): void {
    const projectile = this.projectiles[index];
    if (impact) this.vfx.burst(projectile.mesh.position, projectile.color, .75, .65);
    projectile.mesh.geometry.dispose();
    (projectile.mesh.material as THREE.Material).dispose();
    this.scene.remove(projectile.mesh);
    this.projectiles.splice(index, 1);
  }

  private updateRelics(dt: number): void {
    for (let index = this.relics.length - 1; index >= 0; index -= 1) {
      const relic = this.relics[index];
      relic.age += dt;
      relic.velocity.y -= dt * 3.4;
      if (relic.mesh.position.y < .22) {
        relic.mesh.position.y = .22;
        relic.velocity.y = Math.abs(relic.velocity.y) * .42;
      }
      if (relic.age > .38) {
        const attraction = this.player.position.clone().add(new THREE.Vector3(0, .5, 0)).sub(relic.mesh.position);
        const distance = attraction.length();
        relic.velocity.lerp(attraction.normalize().multiplyScalar(4.5 + Math.max(0, 4 - distance)), dt * 4.2);
        if (distance < .72) {
          this.command = Math.min(100, this.command + relic.value);
          this.stamina = Math.min(100, this.stamina + relic.value * .65);
          this.audio.cue('pickup');
          this.vfx.burst(relic.mesh.position, this.civ.palette.glow, .55, .45);
          relic.mesh.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              (object.material as THREE.Material).dispose();
            }
          });
          this.scene.remove(relic.mesh);
          this.relics.splice(index, 1);
          continue;
        }
      }
      relic.mesh.position.addScaledVector(relic.velocity, dt);
      relic.mesh.rotation.y += dt * 4.5;
      relic.mesh.rotation.x += dt * 1.7;
    }
  }

  private updateTransient(dt: number): void {
    for (let index = this.delayedStrikes.length - 1; index >= 0; index -= 1) {
      const strike = this.delayedStrikes[index];
      strike.ttl -= dt;
      if (strike.ttl <= 0) {
        this.pulse(strike.radius, strike.damage, strike.color);
        this.audio.cue('heavy');
        this.cameraShake = .85;
        this.hitStop = .11;
        this.delayedStrikes.splice(index, 1);
      }
    }
    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      pulse.ttl -= dt;
      const t = 1 - pulse.ttl / pulse.life;
      pulse.mesh.scale.setScalar(1 + t * pulse.max * 4);
      (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pulse.ttl / pulse.life);
      if (pulse.ttl <= 0) {
        pulse.mesh.geometry.dispose();
        (pulse.mesh.material as THREE.Material).dispose();
        this.scene.remove(pulse.mesh);
        this.pulses.splice(index, 1);
      }
    }
  }

  private updateCamera(dt: number): void {
    const speed = this.playerVelocity.length();
    const fovTarget = 46 + Math.min(3, speed * .42) + (this.cameraShake > .45 ? 1.5 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fovTarget, dt * 4);
    this.camera.updateProjectionMatrix();
    this.cameraPosition.set(this.player.position.x * .34, 13.3, 15.5 + this.player.position.z * .34);
    if (this.cameraShake > .001 && !profile.reducedMotion) {
      const power = this.cameraShake * this.cameraShake;
      this.cameraPosition.x += (Math.random() - .5) * power;
      this.cameraPosition.y += (Math.random() - .5) * power * .45;
      this.cameraPosition.z += (Math.random() - .5) * power;
    }
    this.camera.position.lerp(this.cameraPosition, 1 - Math.exp(-5.6 * dt));
    this.cameraLook.set(this.player.position.x * .3, .45, this.player.position.z * .3);
    this.camera.lookAt(this.cameraLook);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.65);
  }

  private nearestEnemy(position: THREE.Vector3): Enemy | undefined {
    let nearest: Enemy | undefined;
    let best = Number.POSITIVE_INFINITY;
    this.enemies.forEach((enemy) => {
      const distance = enemy.mesh.position.distanceToSquared(position);
      if (distance < best) {
        best = distance;
        nearest = enemy;
      }
    });
    return nearest;
  }

  private clampToArena(position: THREE.Vector3, radius = 14.3): void {
    const horizontal = Math.hypot(position.x, position.z);
    if (horizontal <= radius) return;
    position.x = position.x / horizontal * radius;
    position.z = position.z / horizontal * radius;
  }

  private tick = (): void => {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), .05);
    if (!this.paused && !this.ended) this.update(delta);
    this.vfx.update(delta);
    this.pipeline.render(delta);
    requestAnimationFrame(this.tick);
  };

  private update(realDt: number): void {
    this.hitStop = Math.max(0, this.hitStop - realDt);
    const dt = this.hitStop > 0 ? realDt * .09 : realDt;
    this.animation += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) {
      this.combo = 0;
      this.multiplier = THREE.MathUtils.lerp(this.multiplier, 1, dt * 2.2);
    }
    this.cooldowns.forEach((_, index) => { this.cooldowns[index] = Math.max(0, this.cooldowns[index] - dt); });
    this.stamina = Math.min(100, this.stamina + dt * 14);
    this.command = Math.min(100, this.command + dt * (this.shrine > .65 ? 2.6 : .45));

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateAllies(dt);
    this.updateProjectiles(dt);
    this.updateRelics(dt);
    this.updateTransient(dt);
    this.updateCamera(realDt);

    if (this.enemies.length === 0) {
      this.spawnTimer += dt;
      if (this.mode === 'campaign' && this.wave >= 5 && this.shrine >= .75) {
        this.end(true);
      } else if (this.spawnTimer > 2.25 && !(this.mode === 'campaign' && this.wave >= 5)) {
        this.spawnTimer = 0;
        this.wave += 1;
        this.spawnWave();
      }
    } else {
      this.spawnTimer = 0;
    }

    animateRig(this.player, this.animation, this.playerVelocity.length());
    animateEnvironment(this.decor, this.animation, Math.min(1, this.enemies.length / 11 + this.cameraShake * .2));
    if (this.health <= 0) this.end(false);
    this.combatTimer += realDt;
    if (this.combatTimer > .075) {
      this.combatTimer = 0;
      this.paintHud();
    }
  }

  private paintHud(): void {
    const setWidth = (selector: string, value: number) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    };
    setWidth('#health-fill', this.health);
    setWidth('#stamina-fill', this.stamina);
    setWidth('#command-fill', this.command);
    setWidth('#shrine-fill', this.shrine * 100);
    const healthText = document.querySelector('#health-text');
    if (healthText) healthText.textContent = `${Math.max(0, Math.ceil(this.health))} / 100`;
    const shrineText = document.querySelector('#shrine-text');
    if (shrineText) shrineText.textContent = `${Math.round(this.shrine * 100)}%`;
    const wave = document.querySelector('#wave-label');
    if (wave) wave.textContent = `WAVE ${roman(this.wave)}`;
    const enemyCount = document.querySelector('#enemy-count');
    if (enemyCount) enemyCount.textContent = `${this.enemies.length} HOSTILE${this.enemies.length === 1 ? '' : 'S'}`;
    const threat = document.querySelector('#threat-text');
    if (threat) threat.textContent = this.enemies.some((enemy) => enemy.boss) ? 'SOVEREIGN THREAT' : this.enemies.length > 10 ? 'OVERWHELMING' : this.enemies.length > 5 ? 'CONTESTED' : 'BREAKING';
    const objective = document.querySelector('#objective-text');
    if (objective) {
      objective.textContent = this.mode === 'campaign' && this.wave >= 5 && this.enemies.length === 0 && this.shrine < .75
        ? `Hold the shrine · ${Math.round(this.shrine * 100)} / 75%`
        : this.shrine < 1
          ? `Attune shrine · ${Math.round(this.shrine * 100)}%`
          : this.enemies.length
            ? `Break ${this.enemies.length} rival forces`
            : 'The field falls silent';
    }

    const combo = document.querySelector<HTMLElement>('#combo-callout');
    if (combo) {
      combo.classList.toggle('active', this.comboTimer > 0 && this.multiplier > 1.05);
      combo.querySelector('b')!.textContent = String(Math.max(0, this.combo));
      combo.querySelector('em')!.textContent = `×${this.multiplier.toFixed(1)}`;
    }

    const boss = this.enemies.find((enemy) => enemy.boss);
    const bossBar = document.querySelector<HTMLElement>('#boss-bar');
    if (bossBar) {
      bossBar.classList.toggle('hidden', !boss);
      if (boss) {
        const name = bossBar.querySelector<HTMLElement>('#boss-name');
        const title = bossBar.querySelector<HTMLElement>('#boss-title');
        if (name) name.textContent = boss.rival.ruler;
        if (title) title.textContent = boss.rival.title;
        setWidth('#boss-fill', boss.hp / boss.max * 100);
      }
    }

    this.cooldowns.forEach((cooldown, index) => {
      const element = document.querySelector<HTMLElement>(`#cooldown-${index}`);
      if (!element) return;
      element.style.setProperty('--cooldown', `${Math.min(1, cooldown / [4.8, 8, 12, 18, 15][index])}`);
      element.classList.toggle('active', cooldown > 0);
    });
  }

  private feed(text: string): void {
    const feed = document.querySelector('#combat-feed');
    if (!feed) return;
    const line = document.createElement('span');
    line.textContent = text;
    feed.prepend(line);
    while (feed.children.length > 3) feed.lastElementChild?.remove();
  }

  setTouchVector(x: number, z: number): void {
    this.touchVector.set(x, 0, z);
    if (this.touchVector.lengthSq() > 1) this.touchVector.normalize();
  }

  togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    document.querySelector('#pause-overlay')?.classList.toggle('hidden', !this.paused);
  }

  private end(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    setTimeout(() => this.onEnd({
      victory,
      wave: this.wave,
      kills: this.kills,
      score: this.score + Math.floor(this.shrine * 750),
      shrine: this.shrine,
    }), 700);
  }

  private fit(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.pipeline.resize(width, height);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.ended = true;
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.canvas.removeEventListener('pointermove', this.movePointer);
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('contextmenu', this.preventMenu);
    this.enemies.forEach((enemy) => disposeActor(enemy.mesh));
    this.allies.forEach((ally) => disposeActor(ally.mesh));
    disposeActor(this.player);
    this.projectiles.forEach((projectile) => {
      projectile.mesh.geometry.dispose();
      (projectile.mesh.material as THREE.Material).dispose();
    });
    this.relics.forEach((relic) => relic.mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    }));
    this.pipeline.dispose();
    this.vfx.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}

function roman(number: number): string { const values: [number, string][] = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; return values.reduce((result, [value, symbol]) => { while (number >= value) { result += symbol; number -= value; } return result; }, ''); }

renderTitle();
