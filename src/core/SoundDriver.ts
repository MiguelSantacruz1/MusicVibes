// src/core/SoundDriver.ts

export class SoundDriver {
  private element: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private node: MediaElementAudioSourceNode | null = null;
  private freqBuffer: Uint8Array = new Uint8Array(0);

  public onProgress?: (elapsed: number, total: number) => void;
  public onFinished?: () => void;

  constructor() {
    this.element = new Audio();
    this.element.crossOrigin = "anonymous";

    this.element.addEventListener("timeupdate", () => {
      this.onProgress?.(this.element.currentTime, this.element.duration || 0);
    });

    this.element.addEventListener("ended", () => {
      this.onFinished?.();
    });
  }

  // ── Contexto de audio (inicialización diferida) ──────────
  private ensureContext(): void {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);
      this.node = this.ctx.createMediaElementSource(this.element);
      this.node.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // ── API pública ──────────────────────────────────────────
  loadSource(url: string): void {
    this.element.src = url;
    this.element.load();
  }

  async resume(): Promise<void> {
    this.ensureContext();
    try { await this.element.play(); }
    catch (e) { console.warn("Reproducción bloqueada por el navegador.", e); }
  }

  halt(): void {
    this.element.pause();
  }

  adjustVolume(level: number): void {
    this.element.volume = level / 100;
  }

  get active(): boolean {
    return !this.element.paused;
  }

  getElapsed(): number {
    return this.element.currentTime;
  }

  getTotal(): number {
    return this.element.duration || 0;
  }

  goTo(time: number): void {
    this.element.currentTime = time;
  }

  // ── Datos de frecuencia para visualizadores ──────────────
  readFrequencies(): Uint8Array {
    if (this.analyser && this.active) {
      this.analyser.getByteFrequencyData(this.freqBuffer as any);
    } else {
      this.freqBuffer.fill(0);
    }
    return this.freqBuffer;
  }

  readBassLevel(): number {
    if (!this.analyser || !this.active) return 0;
    this.analyser.getByteFrequencyData(this.freqBuffer as any);
    const bins = 4;
    let total = 0;
    for (let i = 0; i < bins; i++) total += this.freqBuffer[i];
    return (total / bins) / 255;
  }
}
