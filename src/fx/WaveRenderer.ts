// src/fx/WaveRenderer.ts
// Visualizador de barras para el panel lateral.

export class WaveRenderer {
  private cvs: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private colCount: number;
  private smoothed: number[];
  private peaks: number[];
  private _running: boolean = false;
  private driver: import("../core/SoundDriver").SoundDriver | null = null;

  constructor(canvasId: string, columns: number = 28) {
    this.cvs = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.cvs.getContext("2d")!;
    this.colCount = columns;
    this.smoothed = new Array(columns).fill(0);
    this.peaks = new Array(columns).fill(0);
    this.tick();
  }

  set running(v: boolean) { this._running = v; }

  bindDriver(driver: import("../core/SoundDriver").SoundDriver) {
    this.driver = driver;
  }

  private fitCanvas(): void {
    this.cvs.width = this.cvs.offsetWidth * devicePixelRatio;
    this.cvs.height = this.cvs.offsetHeight * devicePixelRatio;
  }

  private computeTargets(): number[] {
    if (!this._running || !this.driver) return new Array(this.colCount).fill(0);
    const freq = this.driver.readFrequencies();
    const step = Math.floor(freq.length / this.colCount) || 1;
    return Array.from({ length: this.colCount }, (_, i) => {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        if (idx < freq.length) sum += freq[idx];
      }
      return (sum / step) / 255;
    });
  }

  private render(): void {
    this.fitCanvas();
    const targets = this.computeTargets();
    this.smoothed = this.smoothed.map((v, i) => v + (targets[i] - v) * 0.15);

    const { width: W, height: H } = this.cvs;
    this.ctx.clearRect(0, 0, W, H);

    const colW = (W / this.colCount) * 0.58;
    const spacing = (W / this.colCount) * 0.42;

    this.smoothed.forEach((v, i) => {
      const x = i * (colW + spacing) + spacing / 2;
      const bh = v * H * 0.85;
      const y = H - bh;
      const ratio = i / this.colCount;

      const r = Math.round(59 + (244 - 59) * ratio);
      const g = Math.round(191 + (160 - 191) * ratio);
      const b = Math.round(206 + (160 - 206) * ratio);
      this.ctx.fillStyle = `rgba(${r},${g},${b},${0.6 + v * 0.4})`;

      const rad = Math.min(3, colW / 2);
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, colW, Math.max(1, bh), rad);
      this.ctx.fill();

      if (v > 0.25) {
        this.ctx.fillStyle = `rgba(59,191,206,${v * 0.4})`;
        this.ctx.fillRect(x, y, colW, 2);
      }
    });
  }

  private tick(): void {
    this.render();
    requestAnimationFrame(() => this.tick());
  }
}
