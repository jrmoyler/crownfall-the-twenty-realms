export class RealmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drones: OscillatorNode[] = [];
  private started = false;
  private muted = false;

  constructor(private readonly isMuted: () => boolean) {}

  unlock(): void {
    if (this.started) {
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = 0.16;
    music.connect(master);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.connect(music);
    [82.4, 123.5, 164.8].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 0.22 : 0.06;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.drones.push(osc);
    });
    this.ctx = ctx;
    this.master = master;
    this.started = true;
    this.applyMute();
  }

  setTheme(primaryHue: number): void {
    if (!this.ctx || !this.drones.length) return;
    const root = 70 + (primaryHue % 40);
    this.drones[0]!.frequency.setTargetAtTime(root, this.ctx.currentTime, 0.4);
    this.drones[1]!.frequency.setTargetAtTime(root * 1.5, this.ctx.currentTime, 0.4);
    this.drones[2]!.frequency.setTargetAtTime(root * 2, this.ctx.currentTime, 0.5);
  }

  applyMute(): void {
    this.muted = this.isMuted();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  cue(kind: "strike" | "heavy" | "hurt" | "cast" | "death" | "pick" | "wave" | "boss"): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, slide = 1) => {
      const osc = this.ctx!.createOscillator();
      const amp = this.ctx!.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
      amp.gain.setValueAtTime(gain, t);
      amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(amp);
      amp.connect(this.master!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };
    const noise = (dur: number, gain: number, freq = 800) => {
      const length = Math.floor(this.ctx!.sampleRate * dur);
      const buffer = this.ctx!.createBuffer(1, length, this.ctx!.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = this.ctx!.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx!.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      const amp = this.ctx!.createGain();
      amp.gain.setValueAtTime(gain, t);
      amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(this.master!);
      src.start(t);
    };
    if (kind === "strike") {
      tone(210 + Math.random() * 40, 0.09, "square", 0.08, 0.6);
      noise(0.06, 0.12, 1400);
    } else if (kind === "heavy") {
      tone(90, 0.28, "sine", 0.18, 0.4);
      noise(0.18, 0.2, 300);
    } else if (kind === "hurt") {
      tone(180, 0.16, "sawtooth", 0.07, 0.5);
      noise(0.1, 0.14, 500);
    } else if (kind === "cast") {
      tone(440, 0.22, "triangle", 0.07, 1.6);
      tone(660, 0.18, "sine", 0.04, 1.2);
    } else if (kind === "death") {
      tone(70, 0.5, "sine", 0.16, 0.35);
      noise(0.3, 0.16, 200);
    } else if (kind === "pick") {
      tone(520, 0.12, "sine", 0.06, 1.4);
    } else if (kind === "wave") {
      tone(196, 0.35, "triangle", 0.08, 1.25);
      tone(294, 0.4, "sine", 0.05, 1.1);
    } else if (kind === "boss") {
      tone(55, 0.7, "sine", 0.2, 0.5);
      tone(110, 0.5, "triangle", 0.08, 0.7);
    }
  }

  dispose(): void {
    this.drones.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    this.drones = [];
    void this.ctx?.close();
    this.ctx = null;
  }
}
