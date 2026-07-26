export type AudioCue = 'strike' | 'heavy' | 'cast' | 'summon' | 'hit' | 'dodge' | 'warning' | 'pickup';

export class RealmAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: OscillatorNode;
  private ambienceGain?: GainNode;

  constructor(private readonly muted: () => boolean) {}

  cue(kind: AudioCue): void {
    if (this.muted()) return;
    const context = this.ensureContext();
    const now = context.currentTime;
    const master = this.master!;
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(kind === 'warning' ? .075 : kind === 'hit' ? .11 : .16, now + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'summon' ? .72 : .34));
    filter.type = kind === 'pickup' || kind === 'cast' ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(kind === 'cast' ? 1750 : kind === 'pickup' ? 2300 : 980, now);
    filter.Q.value = kind === 'pickup' ? 5 : 1.3;
    envelope.connect(filter).connect(master);

    const base = {
      strike: 190,
      heavy: 86,
      cast: 340,
      summon: 112,
      hit: 74,
      dodge: 270,
      warning: 160,
      pickup: 620,
    }[kind];
    const oscillator = context.createOscillator();
    oscillator.type = kind === 'summon' || kind === 'pickup' ? 'sine' : kind === 'cast' || kind === 'warning' ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(base, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === 'pickup' ? 1280 : kind === 'summon' ? 390 : kind === 'warning' ? 96 : kind === 'dodge' ? 72 : 54,
      now + (kind === 'summon' ? .68 : .3),
    );
    oscillator.connect(envelope);
    oscillator.start(now);
    oscillator.stop(now + (kind === 'summon' ? .74 : .36));

    if (kind === 'strike' || kind === 'heavy' || kind === 'hit') this.noiseBurst(context, now, kind === 'heavy' ? .22 : .13, kind === 'heavy' ? .14 : .08);
    if (kind === 'cast' || kind === 'summon') this.harmonic(context, now, base * 1.5, kind === 'summon' ? .62 : .32);
  }

  private ensureContext(): AudioContext {
    const context = this.context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    if (!this.master) {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = .008;
      compressor.release.value = .18;
      this.master = context.createGain();
      this.master.gain.value = .72;
      this.master.connect(compressor).connect(context.destination);
      this.startAmbience(context);
    }
    return context;
  }

  private startAmbience(context: AudioContext): void {
    const drone = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.value = 46;
    gain.gain.value = .018;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    drone.connect(filter).connect(gain).connect(this.master!);
    drone.start();
    this.ambience = drone;
    this.ambienceGain = gain;
  }

  private harmonic(context: AudioContext, now: number, frequency: number, duration: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.8, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.055, now + .04);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.master!);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  private noiseBurst(context: AudioContext, now: number, duration: number, volume: number): void {
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.8);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = .8;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master!);
    source.start(now);
  }

  dispose(): void {
    this.ambience?.stop();
    this.ambience?.disconnect();
    this.ambienceGain?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.ambience = undefined;
    this.ambienceGain = undefined;
  }
}
