import { RealmAudio } from "./audio";
import { loadRealmLibrary } from "./assets";
import { ATLAS, byId, CIVILIZATIONS, neighborIndexes, sigilPaths } from "./catalog";
import { clearKey, loadSave, sealRankCost, writeSave } from "./save";
import type { Civilization, CivilizationId, HudState, Mode, RelicDef, RunResult, SaveData } from "./types";
import { Battle } from "./battle";

const sigil = (index: number) =>
  `<svg class="sigil" viewBox="0 0 24 24" aria-hidden="true"><path d="${sigilPaths(index)}"/></svg>`;

export function mountCrownfall(root: HTMLElement): () => void {
  const app = new CrownfallApp(root);
  return () => app.destroy();
}

class CrownfallApp {
  private save: SaveData = loadSave();
  private audio = new RealmAudio(() => this.save.muted);
  private mode: Mode = "campaign";
  private battle: Battle | null = null;
  private rival: CivilizationId = "zenflow";
  private tutorialStep = 0;
  private qa: boolean;

  constructor(private readonly root: HTMLElement) {
    this.root.classList.add("cf");
    this.qa = new URLSearchParams(location.search).has("qa");
    if (this.qa) this.save.tutorialSeen = true;
    this.audio.unlock = this.audio.unlock.bind(this.audio);
    this.root.addEventListener("pointerdown", () => this.audio.unlock(), { once: true });
    if (this.qa) this.openBattle("survival");
    else this.showTitle();
  }

  destroy(): void {
    this.battle?.dispose();
    this.battle = null;
    this.audio.dispose();
    this.root.replaceChildren();
  }

  private persist(): void {
    writeSave(this.save);
  }

  private civ(): Civilization {
    return byId(this.save.selected);
  }

  private dominion(): number {
    return this.save.cleared.filter((key) => key.startsWith(`${this.save.selected}>`)).length;
  }

  private best(): number {
    return this.save.best[this.save.selected] ?? 0;
  }

  private shell(html: string): void {
    this.battle?.dispose();
    this.battle = null;
    this.root.innerHTML = `<div class="grain"></div>${html}`;
    this.bind();
  }

  private showTitle(): void {
    const civ = this.civ();
    this.shell(`
      <header class="top">
        <button class="mark" data-go="title">Crownfall</button>
        <nav>
          <button data-go="codex">Codex</button>
          <button data-go="forge">Forge</button>
          <button data-go="how">Field manual</button>
          <button data-go="settings">Settings</button>
        </nav>
      </header>
      <section class="title">
        <div class="title-copy">
          <p class="eyebrow">Collective atlas · eclipse year</p>
          <h1>Crownfall</h1>
          <p class="subtitle">The Twenty Realms</p>
          <p class="lede">Twenty rulers remain. Choose one. Take the war table. Leave the others a reason to remember the year.</p>
          <div class="title-actions">
            <button class="btn btn-gold" data-go="hall" data-mode="campaign">Begin conquest</button>
            <button class="btn btn-ghost" data-go="hall" data-mode="survival">Endless survival</button>
          </div>
          <p class="meta"><span>${this.dominion()} realms held</span><span>Best ${this.best().toLocaleString()}</span><span>${this.save.shards} shards</span></p>
        </div>
        <figure class="monument" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}">
          <svg viewBox="0 0 420 520" aria-hidden="true">
            <defs>
              <radialGradient id="eclipse" cx="50%" cy="42%" r="40%">
                <stop offset="0%" stop-color="${civ.palette.glow}"/>
                <stop offset="55%" stop-color="${civ.palette.primary}"/>
                <stop offset="100%" stop-color="#07060a" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="210" cy="200" r="150" fill="url(#eclipse)"/>
            <circle cx="228" cy="188" r="78" fill="#07060a"/>
            <path d="M150 250 L210 150 L270 250 L240 250 L210 200 L180 250 Z" fill="none" stroke="#e0c27a" stroke-width="3"/>
            <path d="M168 300 H252 L236 430 H184 Z" fill="none" stroke="#efe6d6" stroke-width="2"/>
            <circle cx="210" cy="340" r="10" fill="${civ.palette.primary}"/>
            ${CIVILIZATIONS.map((item, i) => {
              const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
              const x = 210 + Math.cos(a) * 168;
              const y = 210 + Math.sin(a) * 168;
              return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${item.id === civ.id ? 5 : 2.2}" fill="${item.id === civ.id ? "#e0c27a" : item.palette.primary}"/>`;
            }).join("")}
          </svg>
          <figcaption><b>${civ.ruler}</b><span>${civ.title} of ${civ.name}</span></figcaption>
        </figure>
      </section>
    `);
  }

  private showHall(mode: Mode): void {
    this.mode = mode;
    const civ = this.civ();
    this.shell(`
      ${this.nav()}
      <section class="hall">
        <aside class="dossier" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}">
          <p class="eyebrow">${String(civ.index).padStart(2, "0")} · ${civ.biome}</p>
          <h2>${civ.name}</h2>
          <p class="ruler">${civ.ruler} <em>${civ.title}</em></p>
          <p class="lore">${civ.lore}</p>
          <dl>
            <div><dt>Weapon</dt><dd>${civ.weaponName}</dd></div>
            <div><dt>Elite</dt><dd>${civ.elite}</dd></div>
            <div><dt>Doctrine</dt><dd>${civ.doctrine}</dd></div>
            <div><dt>Passive</dt><dd>${civ.passiveText}</dd></div>
          </dl>
          <ol class="rites">
            ${civ.abilities.map((ability, i) => `<li><b>${["Q", "E", "R", "F"][i]}</b><span><strong>${ability.name}</strong>${ability.note}</span></li>`).join("")}
          </ol>
          <button class="btn btn-gold btn-full" data-go="${mode === "campaign" ? "map" : "battle"}">${mode === "campaign" ? "Open the war table" : "Enter survival"}</button>
        </aside>
        <div class="roster" role="list">
          ${CIVILIZATIONS.map((item) => `
            <button role="listitem" class="card ${item.id === civ.id ? "is-on" : ""}" data-civ="${item.id}" style="--realm:${item.palette.primary}">
              <i>${sigil(item.index)}</i>
              <span>${String(item.index).padStart(2, "0")}</span>
              <strong>${item.name}</strong>
              <small>${item.biome}</small>
              <em>${"●".repeat(item.difficulty)}${"○".repeat(4 - item.difficulty)}</em>
            </button>`).join("")}
        </div>
      </section>
    `);
  }

  private showMap(): void {
    const civ = this.civ();
    const home = civ.index - 1;
    const held = new Set<number>([home]);
    this.save.cleared.forEach((key) => {
      if (!key.startsWith(`${civ.id}>`)) return;
      const rival = CIVILIZATIONS.find((item) => item.id === key.split(">")[1]);
      if (rival) held.add(rival.index - 1);
    });
    const open = new Set<number>();
    held.forEach((index) => neighborIndexes(index).forEach((next) => {
      if (!held.has(next)) open.add(next);
    }));
    if (!open.has(CIVILIZATIONS.findIndex((item) => item.id === this.rival)) && !held.has(CIVILIZATIONS.findIndex((item) => item.id === this.rival))) {
      const first = [...open][0];
      if (first != null) this.rival = CIVILIZATIONS[first]!.id;
    }
    const target = byId(this.rival);
    const targetIndex = target.index - 1;
    const state = targetIndex === home ? "homeland" : held.has(targetIndex) ? "held" : open.has(targetIndex) ? "open" : "sealed";
    const edges = uniqueEdges();
    this.shell(`
      ${this.nav()}
      <section class="war">
        <div class="war-copy">
          <p class="eyebrow">Conquest · ${civ.name}</p>
          <h2>The war table</h2>
          <p>Hold neighboring realms. Each victory keeps its gate and spends the next horizon.</p>
          <p class="dominion"><b>${String(this.dominion()).padStart(2, "0")}</b><span>/ 19 rival realms</span></p>
        </div>
        <div class="atlas">
          <svg class="atlas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${edges.map(([a, b]) => {
              const [x1, y1] = ATLAS[a]!;
              const [x2, y2] = ATLAS[b]!;
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
            }).join("")}
          </svg>
          ${CIVILIZATIONS.map((item) => {
            const index = item.index - 1;
            const [x, y] = ATLAS[index]!;
            const kind = index === home ? "home" : held.has(index) ? "held" : open.has(index) ? "open" : "sealed";
            return `<button class="node node-${kind} ${item.id === this.rival ? "is-on" : ""}" style="left:${x}%;top:${y}%;--realm:${item.palette.primary}" data-node="${item.id}" ${kind === "sealed" ? "disabled" : ""}>
              ${sigil(item.index)}<span>${item.name}</span>
            </button>`;
          }).join("")}
        </div>
        <aside class="mission">
          <p class="eyebrow">${state === "homeland" ? "Your gate" : state === "sealed" ? "Sealed" : state === "held" ? "Rematch" : "Open front"}</p>
          <h3>${target.name}</h3>
          <p>${target.ruler}, ${target.title}. ${target.doctrine}</p>
          <p class="mission-brief">${state === "homeland" ? "This gate is already yours. March on a neighbor." : state === "sealed" ? "A nearer realm must fall before this road exists." : "Attune the shrine. Take both wells. Break the warlord."}</p>
          <button class="btn btn-gold btn-full" data-go="battle" ${state === "open" || state === "held" ? "" : "disabled"}>Enter ${target.name}</button>
        </aside>
      </section>
    `);
  }

  private showCodex(): void {
    this.shell(`
      ${this.nav()}
      <section class="codex">
        <header><p class="eyebrow">Codex</p><h2>Twenty crowns, none of them gentle.</h2></header>
        <div class="codex-grid">
          ${CIVILIZATIONS.map((item) => `
            <article style="--realm:${item.palette.primary}">
              <header>${sigil(item.index)}<span>${String(item.index).padStart(2, "0")}</span></header>
              <h3>${item.name}</h3>
              <p>${item.ruler}, ${item.title}</p>
              <small>${item.biome}</small>
              <p>${item.lore}</p>
              <ul>${item.abilities.map((ability) => `<li>${ability.name}</li>`).join("")}</ul>
              <button data-civ="${item.id}" data-go="hall" data-mode="campaign">Take this crown</button>
            </article>`).join("")}
        </div>
      </section>
    `);
  }

  private showForge(): void {
    const seals: { id: keyof SaveData["seals"]; name: string; text: string }[] = [
      { id: "vitality", name: "Vitality", text: "The crown weighs more. You bleed slower. +12 vitality a rank." },
      { id: "edge", name: "Edge", text: "Every rite and swing cuts deeper. +6% harm a rank." },
      { id: "wind", name: "Wind", text: "The war table gets smaller. +7% pace a rank." },
      { id: "reliquary", name: "Reliquary", text: "Drafts offer a fourth relic. The third rank begins a run already Honed." },
      { id: "oath", name: "Oath", text: "Phase-dodges keep you unwritten a little longer." },
    ];
    this.shell(`
      ${this.nav()}
      <section class="forge">
        <header>
          <p class="eyebrow">Crown forge</p>
          <h2>Spend what the dead left behind.</h2>
          <p class="shards"><b>${this.save.shards}</b> shards in the vault</p>
        </header>
        <div class="seal-list">
          ${seals.map((seal) => {
            const rank = this.save.seals[seal.id];
            const cost = sealRankCost(rank);
            return `<article>
              <div><h3>${seal.name}</h3><p>${seal.text}</p></div>
              <div class="seal-buy">
                <span class="pips">${[0, 1, 2].map((i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("")}</span>
                <button data-seal="${seal.id}" ${cost == null || this.save.shards < cost ? "disabled" : ""}>${cost == null ? "Mastered" : `Raise · ${cost}`}</button>
              </div>
            </article>`;
          }).join("")}
        </div>
      </section>
    `);
  }

  private showHow(): void {
    this.shell(`
      ${this.nav()}
      <section class="manual">
        <p class="eyebrow">Field manual</p>
        <h2>How a realm is taken.</h2>
        <div class="manual-grid">
          <article><h3>Move</h3><p>WASD or arrows, relative to the camera. A is left. D is right. The left stick does the same on a touch screen. You face the pointer.</p></article>
          <article><h3>Strike</h3><p>Left click or the strike button. Blades chain three hits. Staves and orbs loose bolts. Shift or right click spends stamina on a breaker.</p></article>
          <article><h3>Survive</h3><p>Space phase-dodges with a brief untouchable step. Stamina returns if you stop spending it.</p></article>
          <article><h3>Rites</h3><p>Q, E, R and F are the ruler's four rites. C spends command to call elites. Command rises as rivals fall.</p></article>
          <article><h3>Conquest</h3><p>Attune the shrine by standing in it once it is clear. Hold each well. Then kill the warlord. Neighbors of anything you hold become roads.</p></article>
          <article><h3>Survival</h3><p>Waves do not stop. Between them, draft one relic. A warlord arrives every fifth wave. Shards from either mode feed the forge.</p></article>
        </div>
      </section>
    `);
  }

  private showSettings(): void {
    this.shell(`
      ${this.nav()}
      <section class="settings">
        <p class="eyebrow">Settings</p>
        <h2>Before the next march.</h2>
        <label class="toggle"><span><b>Mute the hall</b><small>Drone, steel, and the ugly noises.</small></span><input type="checkbox" data-set="mute" ${this.save.muted ? "checked" : ""}/></label>
        <label class="toggle"><span><b>Reduce motion</b><small>No camera trauma. Quieter weather of light.</small></span><input type="checkbox" data-set="motion" ${this.save.reducedMotion ? "checked" : ""}/></label>
        <button class="btn btn-ghost" data-go="reset">Erase the chronicle</button>
      </section>
    `);
  }

  private showResults(result: RunResult): void {
    const civ = this.civ();
    this.shell(`
      <section class="results" style="--realm:${civ.palette.primary}">
        <p class="eyebrow">${result.victory ? "Realm secured" : "The crown returns"}</p>
        <h2>${result.victory ? `${result.rivalName} is held.` : "Fallen. The table remains."}</h2>
        <p>${result.victory ? `${civ.ruler} adds the road to the atlas.` : `${civ.ruler} keeps the shards and none of the excuses.`}</p>
        <div class="score">
          <div><small>Wave</small><b>${result.wave}</b></div>
          <div><small>Broken</small><b>${result.kills}</b></div>
          <div><small>Score</small><b>${result.score.toLocaleString()}</b></div>
          <div><small>Shards</small><b>+${result.shards}</b></div>
        </div>
        <div class="title-actions">
          <button class="btn btn-gold" data-go="battle">March again</button>
          <button class="btn btn-ghost" data-go="${result.mode === "campaign" ? "map" : "hall"}" data-mode="${result.mode}">${result.mode === "campaign" ? "War table" : "Change ruler"}</button>
          <button class="btn btn-ghost" data-go="title">Hall</button>
        </div>
      </section>
    `);
  }

  private openBattle(mode: Mode = this.mode): void {
    this.mode = mode;
    const civ = this.civ();
    const rival = mode === "campaign" ? byId(this.rival) : CIVILIZATIONS[(civ.index) % 20]!;
    const reduced = this.save.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.root.innerHTML = `
      <div class="grain"></div>
      <section class="battle ${reduced ? "is-still" : ""}" style="--realm:${civ.palette.primary};--glow:${civ.palette.glow}">
        <canvas id="cf-canvas" aria-label="${civ.name} battlefield"></canvas>
        <div class="floats" id="cf-floats"></div>
        <div class="vignette"></div>
        <header class="hud-top">
          <div class="who">${sigil(civ.index)}<div><b>${civ.ruler}</b><small>${mode === "campaign" ? `versus ${rival.name}` : "endless survival"}</small></div></div>
          <div class="obj"><small>Objective</small><b id="cf-obj">Take the field</b></div>
          <button class="icon-btn" id="cf-pause" aria-label="Pause">II</button>
        </header>
        <div class="boss" id="cf-boss" hidden><span id="cf-boss-name"></span><i><b id="cf-boss-fill"></b></i></div>
        <aside class="vitals">
          <label>Vitality <b id="cf-hp-text"></b></label><span class="bar"><i id="cf-hp"></i></span>
          <label>Stamina</label><span class="bar bar-dim"><i id="cf-sta"></i></span>
          <label>Command</label><span class="bar bar-dim"><i id="cf-cmd"></i></span>
        </aside>
        <aside class="feed-wrap">
          <p><small id="cf-threat">Scouting</small> · <span id="cf-hostiles">0</span></p>
          <p class="scoreline"><b id="cf-score">0</b> <em id="cf-mult">×1</em></p>
          <ul id="cf-feed"></ul>
        </aside>
        <footer class="hud-bottom">
          <div class="rites">
            ${civ.abilities.map((ability, i) => `<button class="rite" data-cast="${i}"><kbd>${["Q", "E", "R", "F"][i]}</kbd><span>${ability.name}</span><i id="cf-cd-${i}"></i></button>`).join("")}
            <button class="rite" data-cast="4"><kbd>C</kbd><span>Call ${civ.elite}</span><i id="cf-cd-4"></i></button>
          </div>
          <p class="hints">WASD move · click strike · shift breaker · space dodge</p>
        </footer>
        <div class="touch">
          <div class="stick" id="cf-stick"><i></i></div>
          <div class="touch-actions">
            <button data-cast="0">Q</button><button data-cast="1">E</button><button data-cast="2">R</button><button data-cast="3">F</button>
            <button id="cf-dodge">Dodge</button>
            <button id="cf-heavy">Break</button>
            <button id="cf-strike" class="strike">Strike</button>
          </div>
        </div>
        <div class="banner" id="cf-banner"><small></small><b></b></div>
        <div class="overlay" id="cf-pause-layer" hidden><div class="sheet"><p class="eyebrow">Held</p><h2>The field waits.</h2><button class="btn btn-gold" id="cf-resume">Resume</button><button class="btn btn-ghost" id="cf-retry">Restart</button><button class="btn btn-ghost" data-go="${mode === "campaign" ? "map" : "hall"}">Leave</button></div></div>
        <div class="overlay" id="cf-draft" hidden><div class="sheet sheet-wide"><p class="eyebrow">Relic draft</p><h2 id="cf-draft-title">Choose</h2><div class="draft-row" id="cf-draft-row"></div></div></div>
        <div class="overlay" id="cf-tutor" hidden><div class="sheet"><p class="eyebrow">First march</p><h2 id="cf-tutor-title"></h2><p id="cf-tutor-body"></p><div class="title-actions"><button class="btn btn-ghost" id="cf-tutor-skip">Skip</button><button class="btn btn-gold" id="cf-tutor-next">Next</button></div></div></div>
      </section>`;
    const canvas = this.root.querySelector<HTMLCanvasElement>("#cf-canvas");
    const floats = this.root.querySelector<HTMLElement>("#cf-floats");
    if (!canvas || !floats) return;
    this.audio.unlock();
    this.audio.setTheme(parseInt(civ.palette.primary.slice(1, 3), 16));
    this.audio.applyMute();
    void this.bootField(canvas, floats, civ, rival, mode, reduced);
  }

  private async bootField(
    canvas: HTMLCanvasElement,
    floats: HTMLElement,
    civ: Civilization,
    rival: Civilization,
    mode: Mode,
    reduced: boolean,
  ): Promise<void> {
    try {
      await loadRealmLibrary();
      this.battle = new Battle({
        canvas,
        floats,
        civ,
        rival,
        mode,
        seals: this.save.seals,
        muted: () => this.save.muted,
        reducedMotion: reduced,
        audio: this.audio,
        onDraft: (options, title) => this.openDraft(options, title),
        onEnd: (result) => this.finish(result),
        onBanner: (kicker, title) => {
          const banner = this.root.querySelector<HTMLElement>("#cf-banner");
          if (!banner) return;
          banner.querySelector("small")!.textContent = kicker;
          banner.querySelector("b")!.textContent = title;
          banner.classList.remove("show");
          void banner.offsetWidth;
          banner.classList.add("show");
        },
        onTogglePause: () => this.togglePause(),
        onHud: (hud) => this.paintHud(hud),
      });
    } catch (error) {
      this.root.innerHTML = `<section class="settings"><h2>This device could not open the battlefield.</h2><p>${error instanceof Error ? error.message : "WebGL unavailable."}</p><button class="btn btn-gold" data-go="title">Return</button></section>`;
      this.bind();
      return;
    }
    this.bindBattle();
    if (!this.save.tutorialSeen && !this.qa) this.openTutor(0);
  }

  private paintHud(hud: HudState): void {
    const set = (id: string, text: string) => {
      const el = this.root.querySelector<HTMLElement>(id);
      if (el) el.textContent = text;
    };
    const bar = (id: string, value: number, max: number) => {
      const el = this.root.querySelector<HTMLElement>(id);
      if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, value / max))})`;
    };
    bar("#cf-hp", hud.hp, hud.hpMax);
    bar("#cf-sta", hud.stamina, 100);
    bar("#cf-cmd", hud.command, 100);
    set("#cf-hp-text", `${Math.ceil(hud.hp)}`);
    set("#cf-obj", hud.objective);
    set("#cf-threat", hud.threat);
    set("#cf-hostiles", `${hud.hostiles} hostiles`);
    set("#cf-score", hud.score.toLocaleString());
    set("#cf-mult", `×${hud.multiplier.toFixed(1)}`);
    const boss = this.root.querySelector<HTMLElement>("#cf-boss");
    if (boss) {
      boss.hidden = !hud.bossName;
      set("#cf-boss-name", hud.bossName);
      bar("#cf-boss-fill", hud.bossHp, hud.bossMax);
    }
    hud.cooldowns.forEach((cd, index) => {
      const el = this.root.querySelector<HTMLElement>(`#cf-cd-${index}`);
      const max = hud.cooldownMax[index] || 1;
      if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, cd / max))})`;
    });
    const feed = this.root.querySelector<HTMLElement>("#cf-feed");
    if (feed) feed.innerHTML = hud.feed.map((line) => `<li>${line}</li>`).join("");
    this.root.querySelector(".battle")?.classList.toggle("is-low", hud.low);
  }

  private openDraft(options: RelicDef[], title: string): void {
    const layer = this.root.querySelector<HTMLElement>("#cf-draft");
    const row = this.root.querySelector<HTMLElement>("#cf-draft-row");
    const heading = this.root.querySelector<HTMLElement>("#cf-draft-title");
    if (!layer || !row || !heading) return;
    heading.textContent = title;
    row.innerHTML = options.map((relic) => `
      <button class="draft-card ${relic.rare ? "is-rare" : ""}" data-relic="${relic.id}">
        <small>${relic.rare ? "Rare relic" : "Relic"}</small>
        <strong>${relic.name}</strong>
        <span>${relic.text}</span>
      </button>`).join("");
    row.querySelectorAll<HTMLButtonElement>("[data-relic]").forEach((button) => {
      button.addEventListener("click", () => {
        layer.hidden = true;
        this.battle?.chooseRelic(button.dataset.relic || "");
      });
    });
    layer.hidden = false;
  }

  private togglePause(): void {
    const draft = this.root.querySelector<HTMLElement>("#cf-draft");
    const tutor = this.root.querySelector<HTMLElement>("#cf-tutor");
    if (draft && !draft.hidden) return;
    if (tutor && !tutor.hidden) return;
    const layer = this.root.querySelector<HTMLElement>("#cf-pause-layer");
    if (!layer) return;
    layer.hidden = !layer.hidden;
    this.battle?.setPaused(!layer.hidden);
  }

  private readonly tutor = [
    ["Move like you mean it", "WASD moves relative to the camera. A is left, D is right. On a phone, drag the stick. You face the pointer, or your last heading."],
    ["Strike, then leave", "Click or Strike chains a melee combo, or looses a bolt if your ruler carries a staff or orb. Shift is the heavy breaker. Space spends stamina to phase-dodge."],
    ["Rites are the crown", "Q, E, R, F are this ruler's four rites. C calls elites once command is high enough. In conquest, clear the shrine, hold both wells, then kill the warlord."],
  ];

  private openTutor(step: number): void {
    this.tutorialStep = step;
    const layer = this.root.querySelector<HTMLElement>("#cf-tutor");
    const pair = this.tutor[step];
    if (!layer || !pair) return;
    this.root.querySelector("#cf-tutor-title")!.textContent = pair[0]!;
    this.root.querySelector("#cf-tutor-body")!.textContent = pair[1]!;
    const next = this.root.querySelector<HTMLButtonElement>("#cf-tutor-next");
    if (next) next.textContent = step === this.tutor.length - 1 ? "Take the field" : "Next";
    layer.hidden = false;
    this.battle?.holdTutorial(true);
  }

  private closeTutor(): void {
    const layer = this.root.querySelector<HTMLElement>("#cf-tutor");
    if (layer) layer.hidden = true;
    this.save.tutorialSeen = true;
    this.persist();
    this.battle?.holdTutorial(false);
  }

  private bindBattle(): void {
    this.root.querySelector("#cf-pause")?.addEventListener("click", () => this.togglePause());
    this.root.querySelector("#cf-resume")?.addEventListener("click", () => this.togglePause());
    this.root.querySelector("#cf-retry")?.addEventListener("click", () => this.openBattle(this.mode));
    this.root.querySelectorAll<HTMLButtonElement>("[data-cast]").forEach((button) => {
      button.addEventListener("click", () => this.battle?.cast(Number(button.dataset.cast)));
    });
    const strike = this.root.querySelector("#cf-strike");
    strike?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.battle?.holdAttack(true);
    });
    strike?.addEventListener("pointerup", () => this.battle?.holdAttack(false));
    strike?.addEventListener("pointerleave", () => this.battle?.holdAttack(false));
    this.root.querySelector("#cf-heavy")?.addEventListener("click", () => this.battle?.heavy());
    this.root.querySelector("#cf-dodge")?.addEventListener("click", () => this.battle?.dodge());
    this.root.querySelector("#cf-tutor-skip")?.addEventListener("click", () => this.closeTutor());
    this.root.querySelector("#cf-tutor-next")?.addEventListener("click", () => {
      if (this.tutorialStep >= this.tutor.length - 1) this.closeTutor();
      else this.openTutor(this.tutorialStep + 1);
    });
    this.root.querySelectorAll<HTMLElement>("[data-go]").forEach((button) => {
      button.addEventListener("click", () => this.go(button.dataset.go || "", button.dataset.mode as Mode | undefined));
    });
    const stick = this.root.querySelector<HTMLElement>("#cf-stick");
    const knob = stick?.querySelector("i");
    if (!stick || !knob) return;
    let active = false;
    const move = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width * 0.34;
      const len = Math.hypot(dx, dy);
      if (len < 4) {
        knob.style.transform = "translate(0,0)";
        this.battle?.setStick(0, 0);
        return;
      }
      const mag = Math.min(max, len);
      const nx = (dx / len) * mag;
      const ny = (dy / len) * mag;
      knob.style.transform = `translate(${nx}px, ${ny}px)`;
      this.battle?.setStick(nx / max, -ny / max);
    };
    stick.addEventListener("pointerdown", (event) => {
      active = true;
      stick.setPointerCapture(event.pointerId);
      move(event);
    });
    stick.addEventListener("pointermove", (event) => { if (active) move(event); });
    const end = () => {
      active = false;
      knob.style.transform = "translate(0,0)";
      this.battle?.setStick(0, 0);
    };
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
  }

  private finish(result: RunResult): void {
    this.save.shards += result.shards;
    this.save.best[this.save.selected] = Math.max(this.save.best[this.save.selected] ?? 0, result.score);
    if (result.victory && result.mode === "campaign") {
      const key = clearKey(this.save.selected, this.rival);
      if (!this.save.cleared.includes(key)) this.save.cleared.push(key);
    }
    this.persist();
    this.battle?.dispose();
    this.battle = null;
    this.showResults(result);
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>("[data-civ]").forEach((button) => {
      button.addEventListener("click", () => {
        this.save.selected = button.dataset.civ as CivilizationId;
        this.persist();
        if (button.dataset.go) this.go(button.dataset.go, (button.dataset.mode as Mode) || this.mode);
        else this.showHall(this.mode);
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-node]").forEach((button) => {
      button.addEventListener("click", () => {
        this.rival = button.dataset.node as CivilizationId;
        this.showMap();
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-go]").forEach((button) => {
      button.addEventListener("click", () => this.go(button.dataset.go || "", button.dataset.mode as Mode | undefined));
    });
    this.root.querySelectorAll<HTMLInputElement>("[data-set]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.dataset.set === "mute") this.save.muted = input.checked;
        if (input.dataset.set === "motion") this.save.reducedMotion = input.checked;
        this.audio.applyMute();
        this.persist();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-seal]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.seal as keyof SaveData["seals"];
        const rank = this.save.seals[id];
        const cost = sealRankCost(rank);
        if (cost == null || this.save.shards < cost) return;
        this.save.shards -= cost;
        this.save.seals[id] = rank + 1;
        this.persist();
        this.showForge();
      });
    });
  }

  private go(dest: string, mode?: Mode): void {
    if (mode) this.mode = mode;
    if (dest === "title") this.showTitle();
    else if (dest === "hall") this.showHall(this.mode);
    else if (dest === "map") this.showMap();
    else if (dest === "codex") this.showCodex();
    else if (dest === "forge") this.showForge();
    else if (dest === "how") this.showHow();
    else if (dest === "settings") this.showSettings();
    else if (dest === "battle") this.openBattle(this.mode);
    else if (dest === "reset") {
      this.save = {
        version: 2, muted: this.save.muted, reducedMotion: this.save.reducedMotion,
        selected: this.save.selected, best: {}, cleared: [], shards: 0,
        seals: { vitality: 0, edge: 0, wind: 0, reliquary: 0, oath: 0 }, tutorialSeen: true,
      };
      this.persist();
      this.showSettings();
    }
  }

  private nav(): string {
    return `<header class="top"><button class="mark" data-go="title">Crownfall</button><nav>
      <button data-go="hall" data-mode="campaign">Conquest</button>
      <button data-go="hall" data-mode="survival">Survival</button>
      <button data-go="codex">Codex</button>
      <button data-go="forge">Forge</button>
      <button data-go="settings">Settings</button>
    </nav></header>`;
  }
}

function uniqueEdges(): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < 20; i += 1) {
    neighborIndexes(i).forEach((next) => {
      const key = [i, next].sort((a, b) => a - b).join("-");
      if (seen.has(key)) return;
      seen.add(key);
      edges.push([i, next]);
    });
  }
  return edges;
}

