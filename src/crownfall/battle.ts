import * as THREE from "three";
import type { RealmAudio } from "./audio";
import { byIndex } from "./catalog";
import { draftOptions } from "./relics";
import { preloadRival } from "./assets";
import { buildFigurine, poseFigurine, RealmStage, type FigParts } from "./stage";
import type { Ability, Civilization, EnemyRole, HudState, Mode, RelicDef, RunResult, Seals } from "./types";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      getPosition?: () => { x: number; z: number };
    };
  }
}

interface Actor {
  parts: FigParts;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  max: number;
  radius: number;
  speed: number;
  damage: number;
  role: EnemyRole | "boss" | "ally";
  team: "enemy" | "ally";
  cd: number;
  windup: number;
  slow: number;
  fear: number;
  poison: number;
  poisonDps: number;
  mark: number;
  branded: boolean;
  userDamage: number;
  boss: boolean;
  p1: boolean;
  p2: boolean;
  ttl: number;
  action: string;
  actionAge: number;
  phase: number;
  strafe: number;
  rival: Civilization;
}

interface Shot {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  hostile: boolean;
  life: number;
  radius: number;
  pierce: number;
  poison: number;
}

interface Zone {
  x: number;
  z: number;
  radius: number;
  life: number;
  dps: number;
  slow: boolean;
  pull: boolean;
  hurtPlayer: boolean;
}

interface Boom {
  x: number;
  z: number;
  life: number;
  radius: number;
  damage: number;
  hostile: boolean;
}

interface Floater {
  el: HTMLElement;
  x: number;
  z: number;
  y: number;
  life: number;
}

export interface BattleOptions {
  host: HTMLElement;
  floats: HTMLElement;
  civ: Civilization;
  rival: Civilization;
  mode: Mode;
  seals: Seals;
  muted: () => boolean;
  reducedMotion: boolean;
  audio: RealmAudio;
  onDraft: (options: RelicDef[], title: string) => void;
  onEnd: (result: RunResult) => void;
  onBanner: (kicker: string, title: string) => void;
  onTogglePause: () => void;
  onHud: (hud: HudState) => void;
}

const ARENA = 14.6;
const WELLS: readonly [number, number][] = [[-7, 4.6], [7.2, -3.8]];

export class Battle {
  private readonly stage: RealmStage;
  private readonly canvas: HTMLCanvasElement;
  private readonly ray = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aim = new THREE.Vector3(0, 0, 4);
  private readonly look = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private injected: Set<string> | null = null;
  private readonly enemies: Actor[] = [];
  private readonly allies: Actor[] = [];
  private readonly shots: Shot[] = [];
  private readonly zones: Zone[] = [];
  private readonly booms: Boom[] = [];
  private readonly floaters: Floater[] = [];
  private readonly owned: Record<string, number> = {};
  private readonly cd = [0, 0, 0, 0, 0];
  private readonly cdMax: number[];
  private px = 0;
  private pz = 6.2;
  private yaw = Math.PI;
  private hp: number;
  private hpMax: number;
  private stamina = 100;
  private command = 28;
  private shrine = 0;
  private wells = [0, 0];
  private wellDone = [false, false];
  private wave = 1;
  private kills = 0;
  private score = 0;
  private multiplier = 1;
  private comboTimer = 0;
  private attackCd = 0;
  private dodgeCd = 0;
  private iframes = 0;
  private echo = 0;
  private dr = 0;
  private adaptCd = 0;
  private momentum = 0;
  private quiet = 0;
  private reflect = 0;
  private eclipse = 0;
  private trauma = 0;
  private hitstop = 0;
  private speed = 0;
  private acc = 0;
  private hudTick = 0;
  private banner = 0;
  private spawnGrace = 1.1;
  private clearArm = 0;
  private endArm = 0;
  private ended = false;
  private hardPause = false;
  private softPause = false;
  private pending: (() => void) | null = null;
  private phase: "attune" | "wells" | "boss" | "waves" = "waves";
  private pressure = 5;
  private wellPacks = 0;
  private pointerAimed = false;
  private mouseAttack = false;
  private padAttack = false;
  private padWas: boolean[] = [];
  private padAim = false;
  private lastInput: "mouse" | "touch" | "pad" | "keys" = "keys";
  private touchX = 0;
  private touchY = 0;
  private action = "idle";
  private actionAge = 0;
  private combo = 0;
  private feed: string[] = ["The realm holds its breath."];
  private time = 0;
  private raf = 0;
  private last = performance.now();
  private rngState: number;
  private disposed = false;
  private objective = "Hold the field";

  constructor(private readonly opt: BattleOptions) {
    this.stage = new RealmStage(opt.host, opt.civ, opt.rival, opt.mode, opt.reducedMotion);
    this.canvas = this.stage.canvas;
    this.hpMax = 100 + opt.seals.vitality * 12;
    this.hp = this.hpMax;
    if (opt.seals.reliquary >= 3) this.owned["honed"] = 1;
    this.cdMax = [...opt.civ.abilities.map((ability) => ability.cooldown), 12];
    this.rngState = (opt.civ.index * 9973 + opt.rival.index * 131) >>> 0;
    this.phase = opt.mode === "campaign" ? "attune" : "waves";
    this.objective = opt.mode === "campaign" ? "Attune the crown shrine" : "Break the warband";
    this.stage.player.root.position.set(this.px, 0, this.pz);
    if (opt.mode === "campaign") this.spawnPack(opt.rival, 5, false);
    else this.spawnWave();
    this.pushFeed(`${opt.rival.name} answers the incursion.`);
    if (opt.mode === "campaign") this.flash("INCURSION", opt.rival.biome);
    this.bind();
    this.publish();
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(paused: boolean): void {
    if (!this.hardPause) this.softPause = paused;
  }

  setStick(x: number, y: number): void {
    this.touchX = x;
    this.touchY = y;
    if (x !== 0 || y !== 0) this.useTouch();
  }

  // A thumb has no cursor: forget any old mouse aim and let the stick and auto-aim steer.
  useTouch(): void {
    this.lastInput = "touch";
    this.pointerAimed = false;
  }

  setKeys(codes: string[]): void {
    this.injected = new Set(codes);
  }

  setAim(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.stage.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.ground, hit)) {
      this.aim.copy(hit);
      this.pointerAimed = true;
    }
  }

  holdAttack(down: boolean): void {
    this.mouseAttack = down;
    if (down) this.basicAttack();
  }

  // Touch and gamepad players get the nearest enemy in front of them; mouse players aim.
  private autoFace(range = 9): void {
    if (this.pointerAimed || this.padAim) return;
    let best: Actor | null = null;
    let score = Infinity;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.px;
      const dz = enemy.z - this.pz;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const facing = (dx * fx + dz * fz) / (d || 1);
      const s = d * (1.6 - facing);
      if (s < score) {
        score = s;
        best = enemy;
      }
    }
    if (!best) {
      this.aim.set(this.px + fx * 5, 0, this.pz + fz * 5);
      return;
    }
    this.yaw = Math.atan2(best.x - this.px, best.z - this.pz);
    this.aim.set(best.x, 0, best.z);
  }

  heavy(): void { this.heavyAttack(); }
  dodge(): void { this.doDodge(); }
  cast(index: number): void { this.ability(index); }

  chooseRelic(id: string): void {
    if (!this.pending) return;
    this.owned[id] = (this.owned[id] ?? 0) + 1;
    if (id === "glass") this.hpMax = Math.max(55, this.hpMax - 15);
    if (id === "bulwark") this.hpMax += 16;
    this.hp = Math.min(this.hpMax, this.hp + 18);
    this.opt.audio.cue("pick");
    const next = this.pending;
    this.pending = null;
    this.hardPause = false;
    this.pushFeed(`Relic taken.`);
    next();
    this.publish();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.floaters.forEach((floater) => floater.el.remove());
    this.shots.forEach((shot) => {
      this.stage.scene.remove(shot.mesh);
      this.stage.dropShot(shot.mesh);
    });
    this.stage.dispose();
    if (window.__controlsTest?.getYaw === this.probe.getYaw) delete window.__controlsTest;
  }

  private readonly probe = {
    getYaw: () => this.yaw,
    getSpeed: () => this.speed,
    setKeys: (codes: string[]) => this.setKeys(codes),
    getPosition: () => ({ x: this.px, z: this.pz }),
    attack: () => this.basicAttack(),
    cast: (index: number) => this.ability(index),
    nearest: () => {
      let best = 999;
      this.enemies.forEach((enemy) => {
        best = Math.min(best, Math.hypot(enemy.x - this.px, enemy.z - this.pz));
      });
      return { best, n: this.enemies.length, x: this.px, z: this.pz, yaw: this.yaw };
    },
  };

  private readonly onKeyDown = (event: KeyboardEvent) => this.onKey(event, true);
  private readonly onKeyUp = (event: KeyboardEvent) => this.onKey(event, false);
  private readonly onPointerDown = (event: PointerEvent) => {
    this.opt.audio.unlock();
    // Touches on the field are handled by the on-screen controls, never as aim or a strike.
    if (event.pointerType !== "mouse") return;
    this.lastInput = "mouse";
    this.padAim = false;
    this.setAim(event.clientX, event.clientY);
    if (event.button === 0) this.holdAttack(true);
    if (event.button === 2) this.heavyAttack();
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button === 0) this.mouseAttack = false;
  };
  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    this.lastInput = "mouse";
    this.padAim = false;
    this.setAim(event.clientX, event.clientY);
  };
  private readonly onContext = (event: Event) => event.preventDefault();
  private readonly onBlur = () => {
    this.keys.clear();
    this.mouseAttack = false;
    this.touchX = 0;
    this.touchY = 0;
  };
  private readonly onResize = () => this.stage.fit();
  private readonly frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.hitstop = Math.max(0, this.hitstop - dt);
    if (!this.paused && this.hitstop <= 0) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 5) {
        this.step(1 / 60);
        this.acc -= 1 / 60;
        steps += 1;
      }
    }
    this.animate(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private get paused(): boolean {
    return this.hardPause || this.softPause || this.ended;
  }

  private bind(): void {
    window.__controlsTest = this.probe;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("contextmenu", this.onContext);
  }

  private unbind(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    const code = event.code;
    const watched = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight", "KeyQ", "KeyE", "KeyR", "KeyF", "KeyC", "Escape"];
    if (!watched.includes(code)) return;
    event.preventDefault();
    this.opt.audio.unlock();
    if (down && !event.repeat) {
      if (code === "Space") this.doDodge();
      if (code === "ShiftLeft" || code === "ShiftRight") this.heavyAttack();
      if (code === "KeyQ") this.ability(0);
      if (code === "KeyE") this.ability(1);
      if (code === "KeyR") this.ability(2);
      if (code === "KeyF") this.ability(3);
      if (code === "KeyC") this.ability(4);
      if (code === "Escape") this.opt.onTogglePause();
    }
    if (this.injected) return;
    if (down) this.lastInput = this.lastInput === "touch" ? "keys" : this.lastInput;
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  private held(code: string): boolean {
    if (this.injected) return this.injected.has(code);
    return this.keys.has(code);
  }

  private rng(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  private step(dt: number): void {
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.echo = Math.max(0, this.echo - dt);
    this.dr = Math.max(0, this.dr - dt);
    this.adaptCd = Math.max(0, this.adaptCd - dt);
    this.reflect = Math.max(0, this.reflect - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.banner = Math.max(0, this.banner - dt);
    for (let i = 0; i < this.cd.length; i += 1) this.cd[i] = Math.max(0, (this.cd[i] ?? 0) - dt);
    const regen = 18 + (this.owned["secondwind"] ?? 0) * 6;
    this.stamina = Math.min(100, this.stamina + dt * regen);
    this.command = Math.min(100, this.command + dt * 1.6);
    if (this.quiet > 3 && this.opt.civ.passive === "mend") this.hp = Math.min(this.hpMax, this.hp + dt * 1.4);
    this.quiet += dt;
    if (this.comboTimer <= 0) this.multiplier = Math.max(1, this.multiplier - dt * 0.25);

    this.movePlayer(dt);
    if ((this.mouseAttack || this.padAttack) && this.attackCd <= 0) this.basicAttack();
    this.updateEnemies(dt);
    this.updateAllies(dt);
    this.updateShots(dt);
    this.updateZones(dt);
    this.updateBooms(dt);
    this.updateStatus(dt);
    this.updateObjectives(dt);
    this.eclipse += dt;
    if ((this.owned["eclipse"] ?? 0) > 0 && this.eclipse > 8) {
      this.eclipse = 0;
      this.nova(this.px, this.pz, 3.4, 28, false);
      this.opt.audio.cue("cast");
    }
    if (this.hp <= 0 && !this.ended) this.finish(false);
    this.hudTick += dt;
    if (this.hudTick > 0.1) {
      this.hudTick = 0;
      this.publish();
    }
  }

  private movePlayer(dt: number): void {
    const forward = new THREE.Vector3();
    this.stage.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    let ix = this.touchX;
    let iz = this.touchY;
    if (this.held("KeyD") || this.held("ArrowRight")) ix += 1;
    if (this.held("KeyA") || this.held("ArrowLeft")) ix -= 1;
    if (this.held("KeyW") || this.held("ArrowUp")) iz += 1;
    if (this.held("KeyS") || this.held("ArrowDown")) iz -= 1;
    const pad = this.readPad();
    if (pad) {
      ix += pad.lx;
      iz += pad.ly;
    }
    const wish = new THREE.Vector3();
    wish.addScaledVector(right, ix);
    wish.addScaledVector(forward, iz);
    if (wish.lengthSq() > 1) wish.normalize();
    const moving = wish.lengthSq() > 0.04;
    let speed = 7.15 * (1 + this.opt.seals.wind * 0.07);
    speed *= 1 + (this.owned["quicksilver"] ?? 0) * 0.1;
    if (this.opt.civ.passive === "path") speed *= 1.08;
    const haste = this.zones.some((zone) => zone.life > 0 && !zone.hurtPlayer && Math.hypot(zone.x - this.px, zone.z - this.pz) < zone.radius && this.opt.civ.abilities.some((a) => a.flavor === "haste"));
    if (haste) speed *= 1.12;
    this.px += wish.x * speed * dt;
    this.pz += wish.z * speed * dt;
    this.clampPlayer();
    this.speed = moving ? speed : 0;
    if (moving && this.opt.civ.passive === "momentum") this.momentum = Math.min(1, this.momentum + dt * 0.45);
    else this.momentum = Math.max(0, this.momentum - dt * 0.7);
    const faceX = this.aim.x - this.px;
    const faceZ = this.aim.z - this.pz;
    if (this.padAim && pad) {
      const ax = right.x * pad.rx + forward.x * pad.ry;
      const az = right.z * pad.rx + forward.z * pad.ry;
      this.yaw = Math.atan2(ax, az);
      this.aim.set(this.px + ax * 6, 0, this.pz + az * 6);
    } else if (this.pointerAimed && faceX * faceX + faceZ * faceZ > 0.16) this.yaw = Math.atan2(faceX, faceZ);
    else if (moving) this.yaw = Math.atan2(wish.x, wish.z);
    if ((this.owned["shrineheart"] ?? 0) > 0 && Math.hypot(this.px, this.pz) < 4.2) {
      this.hp = Math.min(this.hpMax, this.hp + dt * 2.2 * (this.owned["shrineheart"] ?? 0));
    }
  }

  // Standard mapping: left stick moves, right stick aims, A strike, B dodge, X breaker,
  // Y elites, LB/RB/LT/RT the four rites, Start pauses. Buttons fire on press, not per frame.
  private readPad(): { lx: number; ly: number; rx: number; ry: number } | null {
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }
    if (!pad) {
      this.padAttack = false;
      return null;
    }
    const dead = (x: number, y: number): [number, number] => {
      const m = Math.hypot(x, y);
      if (m < 0.18) return [0, 0];
      const k = Math.min(1, (m - 0.18) / 0.82) / m;
      return [x * k, y * k];
    };
    const [lx, ly] = dead(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const [rx, ry] = dead(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    const pressed = (i: number) => Boolean(pad!.buttons[i]?.pressed || (pad!.buttons[i]?.value ?? 0) > 0.5);
    const tap = (i: number) => pressed(i) && !this.padWas[i];
    const any = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 || pad.buttons.some((b) => b.pressed);
    if (any) {
      this.lastInput = "pad";
      this.pointerAimed = false;
    }
    this.padAim = rx !== 0 || ry !== 0;
    this.padAttack = pressed(0);
    if (tap(1)) this.doDodge();
    if (tap(2)) this.heavyAttack();
    if (tap(3)) this.ability(4);
    if (tap(4)) this.ability(0);
    if (tap(5)) this.ability(1);
    if (tap(6)) this.ability(2);
    if (tap(7)) this.ability(3);
    if (tap(9)) this.opt.onTogglePause();
    this.padWas = pad.buttons.map((_, i) => pressed(i));
    return { lx, ly: -ly, rx, ry: -ry };
  }

  private clampPlayer(): void {
    const d = Math.hypot(this.px, this.pz);
    if (d > ARENA) {
      this.px = (this.px / d) * ARENA;
      this.pz = (this.pz / d) * ARENA;
    }
  }

  private basicAttack(): void {
    if (this.paused || this.attackCd > 0 || this.ended) return;
    const ranged = this.opt.civ.weapon === "staff" || this.opt.civ.weapon === "orb";
    this.autoFace(ranged ? 12 : 4.5);
    this.quiet = 0;
    this.action = "attack";
    this.actionAge = 0;
    this.opt.audio.cue("strike");
    if (ranged) {
      this.attackCd = 0.3;
      this.shoot(this.px, this.pz, this.yaw, false, this.power(15), 0.22, 1 + (this.opt.civ.passive === "chain" ? 1 : 0), 0);
      if ((this.owned["splinter"] ?? 0) > 0) this.shoot(this.px, this.pz, this.yaw + 0.18, false, this.power(8), 0.16, 0, 0);
      return;
    }
    this.combo = this.comboTimer > 0 ? (this.combo % 3) + 1 : 1;
    this.comboTimer = 0.85;
    const finisher = this.combo === 3;
    this.attackCd = finisher ? 0.42 : 0.26;
    const range = (this.opt.civ.weapon === "spear" ? 2.7 : 2.2) + (finisher ? 0.35 : 0);
    const dmg = this.power(finisher ? 30 : 16 + this.combo * 3);
    this.strikeArc(range, finisher ? 0.05 : 0.2, dmg, finisher ? 0.55 : 0.28);
    this.stage.burst(this.px + Math.sin(this.yaw) * 0.8, this.pz + Math.cos(this.yaw) * 0.8, this.opt.civ.palette.glow, finisher ? 0.7 : 0.4);
  }

  private heavyAttack(): void {
    if (this.paused || this.attackCd > 0 || this.stamina < 26 || this.ended) return;
    this.stamina -= 26;
    this.autoFace(6);
    this.attackCd = 0.72;
    this.combo = 0;
    this.action = "heavy";
    this.actionAge = 0;
    this.quiet = 0;
    this.opt.audio.cue("heavy");
    const ranged = this.opt.civ.weapon === "staff" || this.opt.civ.weapon === "orb";
    if (ranged) {
      this.shoot(this.px, this.pz, this.yaw, false, this.power(42), 0.38, 2, 0);
      this.addTrauma(0.35);
      return;
    }
    const radius = 3.15 * (this.opt.civ.passive === "impact" ? 1.28 : 1) * this.radiusMul();
    this.strikeArc(radius, -0.2, this.power(46), 0.7);
    this.stage.burst(this.px, this.pz, this.opt.civ.palette.glow, 1.1);
    this.hitstop = this.opt.reducedMotion ? 0 : 0.045;
    this.addTrauma(0.45);
  }

  private doDodge(): void {
    if (this.paused || this.dodgeCd > 0 || this.stamina < 16 || this.ended) return;
    this.stamina -= 16;
    const cdr = 1 + (this.owned["secondwind"] ?? 0) * 0.18;
    this.dodgeCd = 0.62 / cdr;
    this.iframes = 0.28 + this.opt.seals.oath * 0.08;
    if (this.opt.civ.passive === "echo") this.echo = 2;
    const forward = new THREE.Vector3();
    this.stage.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    let ix = this.touchX;
    let iz = this.touchY;
    if (this.held("KeyD") || this.held("ArrowRight")) ix += 1;
    if (this.held("KeyA") || this.held("ArrowLeft")) ix -= 1;
    if (this.held("KeyW") || this.held("ArrowUp")) iz += 1;
    if (this.held("KeyS") || this.held("ArrowDown")) iz -= 1;
    let dx = right.x * ix + forward.x * iz;
    let dz = right.z * ix + forward.z * iz;
    if (dx * dx + dz * dz < 0.05) {
      dx = Math.sin(this.yaw);
      dz = Math.cos(this.yaw);
    }
    const len = Math.hypot(dx, dz) || 1;
    this.px += (dx / len) * 2.7;
    this.pz += (dz / len) * 2.7;
    this.clampPlayer();
    this.action = "dash";
    this.actionAge = 0;
    this.opt.audio.cue("cast");
    this.stage.burst(this.px, this.pz, this.opt.civ.palette.glow, 0.45);
  }

  private ability(index: number): void {
    if (this.paused || this.ended || (this.cd[index] ?? 0) > 0) return;
    if (index === 4) {
      const cost = this.opt.civ.passive === "judgment" ? 24 : 35;
      if (this.command < cost) {
        this.pushFeed("Not enough command.");
        this.publish();
        return;
      }
      this.command -= cost;
      this.cd[4] = 12;
      const count = 2 + (this.opt.civ.passive === "banner" ? 1 : 0) + ((this.owned["command"] ?? 0) > 0 ? 1 : 0) + ((this.owned["twin"] ?? 0) > 0 ? 1 : 0);
      this.summon(count, 12 + (this.owned["command"] ?? 0) * 3 + ((this.owned["twin"] ?? 0) > 0 ? 3 : 0));
      this.pushFeed(`${this.opt.civ.elite} take the field.`);
      this.opt.audio.cue("cast");
      this.action = "cast";
      this.actionAge = 0;
      return;
    }
    const ability = this.opt.civ.abilities[index];
    if (!ability) return;
    this.autoFace(14);
    const cdScale = 1 / (1 + (this.owned["quicksilver"] ?? 0) * 0.08);
    this.cd[index] = ability.cooldown * cdScale;
    this.action = ability.kind === "dash" ? "dash" : "cast";
    this.actionAge = 0;
    this.quiet = 0;
    this.opt.audio.cue(index === 3 ? "heavy" : "cast");
    this.resolveAbility(ability);
    this.addTrauma(index === 3 ? 0.4 : 0.18);
  }

  private resolveAbility(ability: Ability): void {
    const power = this.power(ability.power) * (ability.kind === "meteor" || ability.kind === "volley" ? (this.opt.civ.passive === "artillery" ? 1.15 : 1) : 1);
    const radius = ability.radius * this.radiusMul();
    const duration = ability.duration * ((this.owned["standard"] ?? 0) > 0 && (ability.kind === "ward" || ability.kind === "banner") ? 1.3 : 1) * (this.opt.civ.passive === "aegis" && ability.kind === "ward" ? 1.35 : 1) * (this.opt.civ.passive === "root" && ability.kind === "snare" ? 1.45 : 1);
    if (ability.kind === "lance") this.shoot(this.px, this.pz, this.yaw, false, power, 0.28, (ability.count || 1) + (this.opt.civ.passive === "chain" ? 1 : 0), ability.flavor === "poison" ? power * 0.25 : 0);
    if (ability.kind === "arc") this.strikeArc(Math.max(2.4, radius), 0.15, power, 0.45);
    if (ability.kind === "nova") this.nova(this.px, this.pz, radius, power, false, duration > 0);
    if (ability.kind === "ward") {
      this.hp = Math.min(this.hpMax, this.hp + ability.power * 0.65);
      this.iframes = Math.max(this.iframes, Math.max(0.45, duration));
      if (ability.flavor === "reflect" || this.opt.civ.passive === "mirror") this.reflect = Math.max(this.reflect, duration);
      this.stage.burst(this.px, this.pz, "#f4efe4", 0.8);
    }
    if (ability.kind === "snare") this.zones.push({ x: this.aim.x, z: this.aim.z, radius: Math.max(2.2, radius), life: Math.max(2.4, duration), dps: power * 0.35, slow: true, pull: ability.flavor === "pull", hurtPlayer: false });
    if (ability.kind === "chain") this.chain(power, ability.count + (this.opt.civ.passive === "link" ? 1 : 0));
    if (ability.kind === "summon") {
      const extra = (this.opt.civ.passive === "banner" ? 1 : 0) + ((this.owned["twin"] ?? 0) > 0 ? 1 : 0);
      this.summon(ability.count + extra, duration + ((this.owned["twin"] ?? 0) > 0 ? 3 : 0));
    }
    if (ability.kind === "mark") this.brand(radius, 1.15, power);
    if (ability.kind === "dash") {
      const dist = 4.1;
      const ox = this.px;
      const oz = this.pz;
      this.px += Math.sin(this.yaw) * dist;
      this.pz += Math.cos(this.yaw) * dist;
      this.clampPlayer();
      this.iframes = Math.max(this.iframes, 0.18);
      this.enemies.forEach((enemy) => {
        if (this.segmentHit(ox, oz, this.px, this.pz, enemy.x, enemy.z, 1.15)) this.hurtEnemy(enemy, power, true);
      });
      this.stage.burst(this.px, this.pz, this.opt.civ.palette.glow, 0.7);
    }
    if (ability.kind === "meteor") this.booms.push({ x: this.aim.x, z: this.aim.z, life: Math.max(0.55, ability.duration || 0.75), radius, damage: power, hostile: false });
    if (ability.kind === "banner") this.zones.push({ x: this.px, z: this.pz, radius: Math.max(3, radius), life: Math.max(4, duration), dps: 0, slow: false, pull: false, hurtPlayer: false });
    if (ability.kind === "volley") {
      const n = ability.count;
      for (let i = 0; i < n; i += 1) {
        const spread = (i - (n - 1) / 2) * 0.16;
        this.shoot(this.px, this.pz, this.yaw + spread, false, power, 0.2, 0, 0);
      }
    }
    this.stage.burst(this.aim.x, this.aim.z, this.opt.civ.palette.primary, 0.55);
    this.pushFeed(ability.name);
  }

  private power(base: number): number {
    let scale = 1 + this.opt.seals.edge * 0.06;
    scale *= 1 + (this.owned["honed"] ?? 0) * 0.14;
    scale *= 1 + (this.owned["glass"] ?? 0) * 0.25;
    scale *= 1 + this.momentum * 0.25;
    if (this.echo > 0) scale *= 1.22;
    const nearBanner = this.zones.some((zone) => !zone.hurtPlayer && zone.dps === 0 && Math.hypot(zone.x - this.px, zone.z - this.pz) < zone.radius);
    if (nearBanner) scale *= 1.18;
    const chance = 0.06 + (this.opt.civ.passive === "tempo" ? 0.08 : 0) + (this.owned["omen"] ?? 0) * 0.08;
    const crit = this.rng() < chance;
    if (crit) scale *= (this.owned["omen"] ?? 0) > 0 ? 1.75 : 1.5;
    return base * scale;
  }

  private radiusMul(): number {
    return 1 + (this.owned["wide"] ?? 0) * 0.18;
  }

  private strikeArc(range: number, dotMin: number, damage: number, knock: number): void {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let hits = 0;
    this.enemies.forEach((enemy) => {
      const dx = enemy.x - this.px;
      const dz = enemy.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist > range || dist < 0.001) return;
      if ((dx / dist) * fx + (dz / dist) * fz < dotMin) return;
      this.hurtEnemy(enemy, damage, true);
      enemy.x += (dx / dist) * knock;
      enemy.z += (dz / dist) * knock;
      hits += 1;
    });
    if (hits === 0) {
      let nearest: Actor | null = null;
      let best = 2.45;
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - this.px, enemy.z - this.pz);
        if (dist < best) {
          best = dist;
          nearest = enemy;
        }
      }
      if (nearest) {
        this.hurtEnemy(nearest, damage * 0.85, true);
        hits = 1;
      }
    }
    if (hits > 0) {
      this.hitstop = this.opt.reducedMotion ? 0 : 0.03;
      this.addTrauma(0.16 + hits * 0.04);
      this.multiplier = Math.min(4.5, this.multiplier + hits * 0.06);
      this.comboTimer = Math.max(this.comboTimer, 1.1);
    }
  }

  private shoot(x: number, z: number, yaw: number, hostile: boolean, damage: number, radius: number, pierce: number, poison: number): void {
    const speed = hostile ? 7.2 : 16;
    const mesh = this.stage.shot(hostile, hostile ? "#ff7a5c" : this.opt.civ.palette.glow, hostile ? 0.2 : 0.16);
    mesh.position.set(x, 1.15, z);
    mesh.rotation.y = yaw;
    this.shots.push({
      mesh, x, z,
      vx: Math.sin(yaw) * speed,
      vz: Math.cos(yaw) * speed,
      damage, hostile, life: hostile ? 3.2 : 1.15, radius, pierce, poison,
    });
  }

  private nova(x: number, z: number, radius: number, damage: number, hostile: boolean, heal = false): void {
    this.stage.burst(x, z, hostile ? "#ff8d7a" : this.opt.civ.palette.glow, radius / 3);
    if (!hostile) {
      this.enemies.forEach((enemy) => {
        if (Math.hypot(enemy.x - x, enemy.z - z) < radius) this.hurtEnemy(enemy, damage, false);
      });
      if (heal) this.hp = Math.min(this.hpMax, this.hp + 16);
    } else if (Math.hypot(this.px - x, this.pz - z) < radius) this.hurtPlayer(damage, x, z);
    this.addTrauma(hostile ? 0.25 : 0.4);
  }

  private chain(damage: number, jumps: number): void {
    let x = this.px;
    let z = this.pz;
    const used = new Set<Actor>();
    for (let i = 0; i < jumps; i += 1) {
      let best: Actor | null = null;
      let bestD = 8.5;
      this.enemies.forEach((enemy) => {
        if (used.has(enemy)) return;
        const d = Math.hypot(enemy.x - x, enemy.z - z);
        if (d < bestD) {
          best = enemy;
          bestD = d;
        }
      });
      if (!best) break;
      const hit: Actor = best;
      used.add(hit);
      this.hurtEnemy(hit, damage * (1 - i * 0.12), false);
      this.stage.burst(hit.x, hit.z, this.opt.civ.palette.glow, 0.35);
      x = hit.x;
      z = hit.z;
    }
  }

  private brand(radius: number, delay: number, damage: number): void {
    this.enemies.forEach((enemy) => {
      if (Math.hypot(enemy.x - this.aim.x, enemy.z - this.aim.z) < radius) {
        enemy.mark = delay;
        enemy.branded = true;
        enemy.userDamage = damage * (this.opt.civ.passive === "delay" ? 1.35 : 1);
      }
    });
  }

  private summon(count: number, ttl: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const parts = buildFigurine(this.opt.civ, "ally");
      const ally: Actor = {
        parts, x: this.px + Math.cos(angle) * 1.3, z: this.pz + Math.sin(angle) * 1.3, yaw: angle,
        hp: 46, max: 46, radius: 0.4, speed: 5.4, damage: 9, role: "ally", team: "ally",
        cd: 0.3, windup: -1, slow: 0, fear: 0, poison: 0, poisonDps: 0, mark: 0, branded: false,
        boss: false, p1: false, p2: false, ttl, action: "idle", actionAge: 0, phase: angle, strafe: 1,
        rival: this.opt.civ, userDamage: 0,
      };
      this.stage.addActor(parts);
      this.allies.push(ally);
    }
  }

  private spawnWave(): void {
    const rival = this.rivalForWave();
    const boss = this.wave % 5 === 0;
    const count = 4 + Math.min(8, this.wave + 1);
    this.spawnPack(rival, count, boss);
    this.wave += 1;
    preloadRival(this.rivalForWave());
    this.wave -= 1;
    this.spawnGrace = 0.8;
    this.clearArm = 0;
    this.flash(boss ? "WARLORD" : `WAVE ${this.wave}`, rival.name);
    this.objective = boss ? `Break ${rival.ruler}` : `Clear wave ${this.wave}`;
    this.opt.audio.cue(boss ? "boss" : "wave");
  }

  private rivalForWave(): Civilization {
    const index = (this.opt.civ.index + this.wave) % 20;
    const rival = byIndex(index);
    return rival.id === this.opt.civ.id ? byIndex((index + 1) % 20) : rival;
  }

  private spawnPack(rival: Civilization, count: number, boss: boolean): void {
    const roles: EnemyRole[] = ["vanguard", "skirmisher", "mystic", "vanguard", "brute", "skirmisher"];
    for (let i = 0; i < count; i += 1) this.spawnEnemy(rival, roles[(i + this.wave) % roles.length]!, false);
    if (boss) this.spawnEnemy(rival, "brute", true);
  }

  private spawnEnemy(rival: Civilization, role: EnemyRole, boss: boolean): void {
    const spread = (this.rng() - 0.5) * 2.4;
    const ang = this.yaw + spread;
    const radius = 8.5 + this.rng() * 2.2;
    let x = this.px + Math.sin(ang) * radius;
    let z = this.pz + Math.cos(ang) * radius;
    const guard = Math.hypot(x, z);
    if (guard > ARENA - 0.6) {
      x = (x / guard) * (ARENA - 0.6);
      z = (z / guard) * (ARENA - 0.6);
    }
    const parts = buildFigurine(rival, boss ? "boss" : role, boss);
    const diff = 1 + (rival.difficulty - 2) * 0.08 + (this.wave - 1) * 0.12;
    const baseHp = boss ? 520 : role === "brute" ? 130 : role === "vanguard" ? 86 : role === "mystic" ? 58 : 52;
    const max = baseHp * diff;
    const actor: Actor = {
      parts,
      x,
      z,
      yaw: Math.atan2(this.px - x, this.pz - z),
      hp: max,
      max,
      radius: boss ? 0.85 : role === "brute" ? 0.7 : 0.48,
      speed: boss ? 2.1 : role === "skirmisher" ? 3.7 : role === "mystic" ? 2.8 : role === "brute" ? 1.9 : 2.5,
      damage: (boss ? 16 : role === "brute" ? 13 : role === "mystic" ? 9 : 8) + this.wave * 0.45,
      role: boss ? "boss" : role,
      team: "enemy",
      cd: 0.6 + this.rng(),
      windup: -1,
      slow: 0,
      fear: 0,
      poison: 0,
      poisonDps: 0,
      mark: 0,
      branded: false,
      boss,
      p1: false,
      p2: false,
      ttl: 999,
      action: "idle",
      actionAge: 0,
      phase: this.rng() * 6,
      strafe: this.rng() > 0.5 ? 1 : -1,
      rival,
      userDamage: 0,
    };
    this.stage.addActor(parts);
    this.enemies.push(actor);
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]!;
      if (enemy.hp <= 0) continue;
      enemy.cd -= dt;
      enemy.slow = Math.max(0, enemy.slow - dt);
      enemy.fear = Math.max(0, enemy.fear - dt);
      const dx = this.px - enemy.x;
      const dz = this.pz - enemy.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      let mx = dx / dist;
      let mz = dz / dist;
      if (enemy.fear > 0) {
        mx *= -1;
        mz *= -1;
      } else if (enemy.role === "mystic" || (enemy.boss && enemy.hp < enemy.max * 0.5 && enemy.windup < 0)) {
        const desired = enemy.boss ? 5.5 : 7.4;
        if (dist < desired - 0.6) { mx *= -1; mz *= -1; }
        else if (dist < desired + 0.8) { const s = mx; mx = -mz * enemy.strafe; mz = s * enemy.strafe; }
      } else if (enemy.role === "skirmisher" && enemy.fear <= 0 && dist < 3.3 && dist > 1.5) {
        const s = mx;
        mx = -mz * enemy.strafe;
        mz = s * enemy.strafe;
      }
      this.separate(enemy, mx, mz);
      const rate = enemy.speed * (enemy.slow > 0 ? 0.48 : 1) * (enemy.windup > 0 ? 0.25 : 1);
      if (enemy.windup < 0) {
        enemy.x += mx * rate * dt;
        enemy.z += mz * rate * dt;
      }
      this.clampActor(enemy);
      enemy.yaw = Math.atan2(this.px - enemy.x, this.pz - enemy.z);
      if (enemy.boss) this.bossScript(enemy);
      if (enemy.windup > 0) {
        enemy.windup -= dt;
        enemy.action = "heavy";
        if (enemy.windup <= 0) {
          this.nova(enemy.x, enemy.z, enemy.boss ? 3.3 : 2.5, enemy.damage, true);
          enemy.cd = enemy.boss ? 2.4 : 2.8;
          enemy.windup = -1;
        }
      } else if (enemy.role === "mystic" || (enemy.boss && dist > 4.2)) {
        if (enemy.cd <= 0 && dist < 13) {
          this.shoot(enemy.x, enemy.z, enemy.yaw, true, enemy.damage, 0.28, 0, 0);
          enemy.cd = enemy.boss ? 1.5 : 2.1;
          enemy.action = "cast";
          enemy.actionAge = 0;
        }
      } else if ((enemy.role === "brute" || enemy.boss) && dist < 2.8 && enemy.cd <= 0) {
        enemy.windup = enemy.boss ? 0.85 : 0.7;
        enemy.cd = 99;
        this.stage.burst(enemy.x, enemy.z, enemy.rival.palette.glow, 0.6);
      } else if (dist < enemy.radius + 0.55 && enemy.cd <= 0 && enemy.windup < 0) {
        this.hurtPlayer(enemy.damage, enemy.x, enemy.z);
        enemy.cd = enemy.role === "skirmisher" ? 0.7 : 1.05;
        enemy.action = "attack";
        enemy.actionAge = 0;
        if (this.opt.civ.passive === "root") this.hurtEnemy(enemy, 4, false);
      }
    }
  }

  private bossScript(enemy: Actor): void {
    if (!enemy.p1 && enemy.hp < enemy.max * 0.68) {
      enemy.p1 = true;
      this.nova(enemy.x, enemy.z, 4.2, enemy.damage * 0.8, true);
      this.flash("THRESHOLD", `${enemy.rival.ruler} sheds the first oath`);
      this.opt.audio.cue("boss");
    }
    if (!enemy.p2 && enemy.hp < enemy.max * 0.38) {
      enemy.p2 = true;
      this.spawnEnemy(enemy.rival, "skirmisher", false);
      this.spawnEnemy(enemy.rival, "vanguard", false);
      this.pushFeed("The warlord calls a reserve.");
    }
  }

  private separate(enemy: Actor, mx: number, mz: number): void {
    this.enemies.forEach((other) => {
      if (other === enemy) return;
      const dx = enemy.x - other.x;
      const dz = enemy.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.25) {
        enemy.x += (dx / d) * 0.02;
        enemy.z += (dz / d) * 0.02;
      }
    });
    void mx;
    void mz;
  }

  private updateAllies(dt: number): void {
    for (let i = this.allies.length - 1; i >= 0; i -= 1) {
      const ally = this.allies[i]!;
      ally.ttl -= dt;
      ally.cd -= dt;
      if (ally.ttl <= 0 || ally.hp <= 0) {
        this.stage.removeActor(ally.parts, ally.hp <= 0);
        this.allies.splice(i, 1);
        continue;
      }
      let target: Actor | null = null;
      let best = 99;
      for (const enemy of this.enemies) {
        const d = Math.hypot(enemy.x - ally.x, enemy.z - ally.z);
        if (d < best) {
          best = d;
          target = enemy;
        }
      }
      const focus = target;
      if (!focus) {
        ally.x += (this.px - ally.x) * dt;
        ally.z += (this.pz - ally.z) * dt;
      } else if (best > 1.2) {
        ally.x += ((focus.x - ally.x) / best) * ally.speed * dt;
        ally.z += ((focus.z - ally.z) / best) * ally.speed * dt;
        ally.yaw = Math.atan2(focus.x - ally.x, focus.z - ally.z);
      } else if (ally.cd <= 0) {
        const bonus = this.opt.civ.passive === "banner" ? 1.15 : 1;
        this.hurtEnemy(focus, ally.damage * bonus, false);
        ally.cd = 0.7;
        ally.action = "attack";
        ally.actionAge = 0;
      }
    }
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i]!;
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.z += shot.vz * dt;
      shot.mesh.position.set(shot.x, 0.9, shot.z);
      let dead = shot.life <= 0 || Math.hypot(shot.x, shot.z) > ARENA + 1;
      if (shot.hostile) {
        if (Math.hypot(shot.x - this.px, shot.z - this.pz) < shot.radius + 0.4) {
          if (this.reflect > 0 || (this.opt.civ.passive === "mirror" && this.rng() < 0.18)) {
            shot.hostile = false;
            shot.vx *= -1;
            shot.vz *= -1;
            shot.damage *= 0.8;
            shot.life = 1;
          } else {
            this.hurtPlayer(shot.damage, shot.x, shot.z);
            dead = true;
          }
        }
      } else {
        for (const enemy of this.enemies) {
          if (Math.hypot(shot.x - enemy.x, shot.z - enemy.z) < shot.radius + enemy.radius) {
            this.hurtEnemy(enemy, shot.damage, false);
            if (shot.poison > 0) {
              enemy.poison = 3;
              enemy.poisonDps = shot.poison;
            }
            if (shot.pierce > 0) shot.pierce -= 1;
            else dead = true;
            break;
          }
        }
      }
      if (dead) {
        this.stage.dropShot(shot.mesh);
        this.shots.splice(i, 1);
      }
    }
  }

  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i -= 1) {
      const zone = this.zones[i]!;
      zone.life -= dt;
      if (zone.life <= 0) {
        this.zones.splice(i, 1);
        continue;
      }
      if (!zone.hurtPlayer && zone.dps > 0) {
        for (let e = this.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = this.enemies[e]!;
          const d = Math.hypot(enemy.x - zone.x, enemy.z - zone.z);
          if (d < zone.radius) {
            enemy.hp -= zone.dps * dt;
            if (enemy.hp <= 0) this.killEnemy(enemy);
            else if (zone.slow) enemy.slow = 0.2;
            if (zone.pull && d > 0.4 && enemy.hp > 0) {
              enemy.x += ((zone.x - enemy.x) / d) * 4 * dt;
              enemy.z += ((zone.z - enemy.z) / d) * 4 * dt;
            }
          }
        }
      }
    }
  }

  private updateBooms(dt: number): void {
    for (let i = this.booms.length - 1; i >= 0; i -= 1) {
      const boom = this.booms[i]!;
      boom.life -= dt;
      if (Math.random() < 0.2) this.stage.burst(boom.x, boom.z, this.opt.civ.palette.primary, 0.25);
      if (boom.life > 0) continue;
      this.nova(boom.x, boom.z, boom.radius, boom.damage, boom.hostile);
      this.booms.splice(i, 1);
    }
  }

  private updateStatus(dt: number): void {
    const actors = [...this.enemies, ...this.allies];
    actors.forEach((actor) => {
      if (actor.poison > 0 && actor.team === "enemy") {
        actor.poison -= dt;
        actor.hp -= actor.poisonDps * dt;
        if (actor.hp <= 0) this.killEnemy(actor);
      }
      if (actor.mark > 0 && actor.team === "enemy") {
        actor.mark -= dt;
        if (actor.mark <= 0) {
          const damage = (actor.userDamage || 36) * (actor.branded && this.opt.civ.passive === "debt" ? 1.2 : 1);
          this.nova(actor.x, actor.z, 2.1, damage, false);
          actor.userDamage = 0;
        }
      }
    });
  }

  private updateObjectives(dt: number): void {
    if (this.opt.mode === "survival") {
      if (this.spawnGrace > 0) return;
      if (this.enemies.length === 0 && !this.pending) {
        this.clearArm += dt;
        if (this.clearArm > 0.45) {
          this.clearArm = -99;
          const options = draftOptions(this.owned, () => this.rng(), this.opt.seals.reliquary > 0 ? 1 : 0);
          this.hardPause = true;
          this.pending = () => {
            this.wave += 1;
            this.spawnWave();
          };
          this.opt.onDraft(options, `Wave ${this.wave} is quiet. Take a relic.`);
          this.objective = "Choose a relic";
          this.publish();
        }
      }
      return;
    }
    if (this.phase === "attune") {
      const near = Math.hypot(this.px, this.pz) < 3.3;
      const contested = this.enemies.some((enemy) => Math.hypot(enemy.x, enemy.z) < 4.1);
      const rate = (near && !contested ? 22 : contested ? -10 : -4) * (this.opt.civ.passive === "aegis" ? 1.35 : 1) * (1 + (this.owned["shrineheart"] ?? 0) * 0.4);
      this.shrine = THREE.MathUtils.clamp(this.shrine + rate * dt, 0, 100);
      this.objective = contested ? "Clear the shrine" : near ? "Hold the shrine" : "Reach the crown shrine";
      this.pressure -= dt;
      if (this.pressure <= 0 && this.enemies.length < 6 && this.shrine < 100) {
        this.pressure = 8;
        this.spawnEnemy(this.opt.rival, this.rng() > 0.5 ? "skirmisher" : "vanguard", false);
      }
      if (this.shrine >= 100 && !this.pending) {
        this.phase = "wells";
        this.objective = "Secure both relic wells";
        this.flash("SHRINE HELD", "The wells wake");
        const options = draftOptions(this.owned, () => this.rng(), this.opt.seals.reliquary > 0 ? 1 : 0);
        this.hardPause = true;
        this.pending = () => {
          this.spawnPack(this.opt.rival, 3, false);
          this.spawnGrace = 0.4;
        };
        this.opt.onDraft(options, "The shrine answers. Choose what it teaches.");
      }
      return;
    }
    if (this.phase === "wells") {
      let newly = false;
      WELLS.forEach(([x, z], index) => {
        if (this.wellDone[index]) return;
        if (Math.hypot(this.px - x, this.pz - z) < 2.3) {
          const rate = 1 + (this.owned["shrineheart"] ?? 0) * 0.45;
          this.wells[index] = (this.wells[index] ?? 0) + dt * rate;
          if ((this.wells[index] ?? 0) >= 2.1) {
            this.wellDone[index] = true;
            newly = true;
            this.stage.wellMats[index]!.emissiveIntensity = 1.4;
          }
        }
      });
      const held = this.wellDone.filter(Boolean).length;
      this.objective = held === 0 ? "Stand in a relic well" : held === 1 ? "One well remains" : "Wells secured";
      if (newly) {
        this.wellPacks += 1;
        this.spawnPack(this.opt.rival, 3, false);
        this.pushFeed("The well is yours. Something felt it.");
      }
      if (held === 2 && this.enemies.length === 0 && !this.pending && this.spawnGrace <= 0) {
        this.phase = "boss";
        const options = draftOptions(this.owned, () => this.rng(), this.opt.seals.reliquary > 0 ? 1 : 0);
        this.hardPause = true;
        this.pending = () => {
          this.spawnEnemy(this.opt.rival, "brute", true);
          this.spawnEnemy(this.opt.rival, "vanguard", false);
          this.spawnEnemy(this.opt.rival, "mystic", false);
          this.objective = `Defeat ${this.opt.rival.ruler}`;
          this.flash("WARLORD", this.opt.rival.ruler);
          this.opt.audio.cue("boss");
          this.spawnGrace = 0.6;
        };
        this.opt.onDraft(options, "Before the warlord. One last relic.");
      }
      return;
    }
    if (this.phase === "boss" && this.spawnGrace <= 0 && this.enemies.every((enemy) => !enemy.boss) && this.enemies.length === 0) {
      this.endArm += dt;
      if (this.endArm > 0.6) this.finish(true);
    }
  }

  private hurtEnemy(enemy: Actor, amount: number, brandedHit: boolean): void {
    if (enemy.hp <= 0 || enemy.team !== "enemy") return;
    let dealt = amount;
    if (enemy.role === "vanguard" && !enemy.boss) {
      const fx = Math.sin(enemy.yaw);
      const fz = Math.cos(enemy.yaw);
      const dx = this.px - enemy.x;
      const dz = this.pz - enemy.z;
      const dist = Math.hypot(dx, dz) || 1;
      if ((dx / dist) * fx + (dz / dist) * fz > 0.45 && enemy.windup < 0) dealt *= 0.42;
    }
    if (enemy.branded && this.opt.civ.passive === "debt") dealt *= 1.2;
    if ((this.owned["crown-debt"] ?? 0) > 0 && brandedHit && enemy.mark <= 0) {
      enemy.mark = 0.85;
      enemy.branded = true;
      enemy.userDamage = 22;
    }
    enemy.hp -= dealt;
    enemy.action = "hit";
    enemy.actionAge = 0;
    const crit = dealt > amount * 1.4;
    this.float(enemy.x, enemy.z, `${Math.round(dealt)}`, crit);
    if ((this.owned["leech"] ?? 0) > 0) this.hp = Math.min(this.hpMax, this.hp + dealt * 0.07 * (this.owned["leech"] ?? 0));
    if (enemy.hp > 0) return;
    this.killEnemy(enemy);
  }

  private killEnemy(enemy: Actor): void {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.stage.burst(enemy.x, enemy.z, enemy.boss ? "#f0d48a" : enemy.rival.palette.glow, enemy.boss ? 1.6 : 0.7);
    this.stage.removeActor(enemy.parts);
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.score += Math.round((enemy.boss ? 900 : 70 + this.wave * 12) * this.multiplier);
    this.command = Math.min(100, this.command + (enemy.boss ? 18 : 6));
    this.multiplier = Math.min(4.5, this.multiplier + (enemy.boss ? 0.4 : 0.08));
    this.comboTimer = 2;
    this.opt.audio.cue(enemy.boss ? "boss" : "death");
    this.addTrauma(enemy.boss ? 0.7 : 0.12);
    if (this.opt.civ.passive === "spectacle") {
      for (let i = 0; i < 4; i += 1) this.cd[i] = Math.max(0, (this.cd[i] ?? 0) - 0.45);
    }
    if (this.opt.civ.passive === "fear") {
      this.enemies.forEach((other) => {
        if (Math.hypot(other.x - enemy.x, other.z - enemy.z) < 4.5) other.fear = 0.8;
      });
    }
    this.pushFeed(enemy.boss ? `${enemy.rival.ruler} falls.` : `${enemy.role} broken`);
    if (enemy.boss && this.opt.mode === "survival") this.score += 400;
  }

  private hurtPlayer(amount: number, x: number, z: number): void {
    if (this.iframes > 0 || this.ended || this.hp <= 0) return;
    let dealt = amount;
    if (this.dr > 0) dealt *= 0.72;
    if (this.opt.civ.passive === "rampart") dealt = Math.max(1, dealt - 2);
    const thorns = (this.owned["bulwark"] ?? 0) * 4;
    this.hp = Math.max(0, this.hp - dealt);
    this.iframes = 0.28;
    this.quiet = 0;
    this.multiplier = Math.max(1, this.multiplier - 0.3);
    this.combo = 0;
    this.action = "hit";
    this.actionAge = 0;
    const dx = this.px - x;
    const dz = this.pz - z;
    const dist = Math.hypot(dx, dz) || 1;
    this.px += (dx / dist) * 0.45;
    this.pz += (dz / dist) * 0.45;
    this.clampPlayer();
    this.float(this.px, this.pz, `${Math.round(dealt)}`, false);
    this.opt.audio.cue("hurt");
    this.addTrauma(0.34);
    if (this.opt.civ.passive === "adapt" && this.adaptCd <= 0) {
      this.dr = 3;
      this.adaptCd = 6;
      this.pushFeed("The ward learns.");
    }
    if (thorns > 0) {
      this.enemies.forEach((enemy) => {
        if (Math.hypot(enemy.x - this.px, enemy.z - this.pz) < 1.8) this.hurtEnemy(enemy, thorns, false);
      });
    }
    this.publish();
  }

  private finish(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.hardPause = true;
    const shrineScore = this.opt.mode === "campaign" ? this.shrine : Math.min(100, this.wave * 8);
    const shards = victory
      ? 80 + this.wave * 6 + Math.round(this.score / 120)
      : Math.max(8, Math.round(this.score / 180));
    this.score += Math.round(shrineScore * 4);
    const result: RunResult = {
      victory,
      mode: this.opt.mode,
      wave: this.wave,
      kills: this.kills,
      score: this.score,
      shrine: shrineScore / 100,
      shards,
      rivalName: this.opt.rival.name,
    };
    window.setTimeout(() => {
      if (!this.disposed) this.opt.onEnd(result);
    }, 700);
  }

  private animate(dt: number): void {
    const moving = this.speed > 0.4;
    this.actionAge += dt;
    if (this.action !== "idle" && this.actionAge > 0.45) this.action = moving ? "move" : "idle";
    const player = this.stage.player;
    player.root.position.x = this.px;
    player.root.position.z = this.pz;
    player.root.rotation.y = this.yaw;
    poseFigurine(player, this.time + this.stage.nowSeed(), moving, this.action, this.actionAge, dt);
    const actors = [...this.enemies, ...this.allies];
    actors.forEach((actor) => {
      actor.actionAge += dt;
      actor.parts.root.position.x = actor.x;
      actor.parts.root.position.z = actor.z;
      actor.parts.root.rotation.y = actor.yaw;
      poseFigurine(actor.parts, this.time + actor.phase, true, actor.action, actor.actionAge, dt);
      if (actor.action === "hit" && actor.actionAge > 0.25) actor.action = "idle";
    });
    this.stage.updateFx(dt);
    if (!this.opt.reducedMotion) this.trauma = Math.max(0, this.trauma - dt * 1.7);
    else this.trauma = 0;
    const shake = this.trauma * this.trauma;
    const sx = Math.sin(this.time * 33) * shake * 0.28;
    const sy = Math.cos(this.time * 27) * shake * 0.18;
    this.look.set(this.px + Math.sin(this.yaw) * 1.4, 0, this.pz + Math.cos(this.yaw) * 1.4);
    this.stage.render(this.look, sx, sy, this.time, dt);
    const rect = this.canvas.getBoundingClientRect();
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const floater = this.floaters[i]!;
      floater.life -= dt;
      floater.y += dt * 0.8;
      const p = this.stage.project(floater.x, floater.y, floater.z, rect.width, rect.height);
      floater.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      floater.el.style.opacity = String(Math.max(0, floater.life));
      if (floater.life <= 0) {
        floater.el.remove();
        this.floaters.splice(i, 1);
      }
    }
  }

  private float(x: number, z: number, text: string, crit: boolean): void {
    if (this.floaters.length > 24) {
      this.floaters.shift()?.el.remove();
    }
    const el = document.createElement("b");
    el.className = crit ? "dmg dmg-crit" : "dmg";
    el.textContent = text;
    this.opt.floats.appendChild(el);
    this.floaters.push({ el, x, z, y: 1.7, life: 0.7 });
  }

  private addTrauma(amount: number): void {
    if (this.opt.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private segmentHit(x1: number, z1: number, x2: number, z2: number, px: number, pz: number, radius: number): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = dx * dx + dz * dz || 1;
    const t = THREE.MathUtils.clamp(((px - x1) * dx + (pz - z1) * dz) / len, 0, 1);
    const x = x1 + dx * t;
    const z = z1 + dz * t;
    return Math.hypot(px - x, pz - z) < radius;
  }

  private clampActor(actor: Actor): void {
    const d = Math.hypot(actor.x, actor.z);
    if (d > ARENA) {
      actor.x = (actor.x / d) * ARENA;
      actor.z = (actor.z / d) * ARENA;
    }
  }

  private pushFeed(line: string): void {
    this.feed = [line, ...this.feed].slice(0, 4);
  }

  private flash(kicker: string, title: string): void {
    this.banner = 2.4;
    this.opt.onBanner(kicker, title);
  }

  private publish(): void {
    const boss = this.enemies.find((enemy) => enemy.boss);
    const hud: HudState = {
      hp: this.hp,
      hpMax: this.hpMax,
      stamina: this.stamina,
      command: this.command,
      shrine: this.opt.mode === "campaign" ? this.shrine : Math.min(100, (this.kills % 12) * 8),
      wave: this.wave,
      kills: this.kills,
      score: this.score,
      multiplier: this.multiplier,
      objective: this.objective,
      threat: boss ? "WARLORD" : this.enemies.length > 6 ? "PRESSING" : this.enemies.length > 0 ? "ENGAGED" : "QUIET",
      hostiles: this.enemies.length,
      bossName: boss ? boss.rival.ruler : "",
      bossHp: boss?.hp ?? 0,
      bossMax: boss?.max ?? 1,
      cooldowns: [...this.cd],
      cooldownMax: this.cdMax,
      low: this.hp / this.hpMax < 0.3,
      banner: "",
      feed: this.feed,
    };
    this.opt.onHud(hud);
  }

  holdTutorial(on: boolean): void {
    this.hardPause = on;
  }
}
