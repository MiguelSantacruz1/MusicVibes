// src/fx/SpectrumDisplay.ts

export class SpectrumDisplay {
  private cvs: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bands: number;
  private smoothed: number[];
  private _running: boolean = false;
  private driver: import("../core/SoundDriver").SoundDriver | null = null;

  constructor(canvasId: string, bands: number = 40) {
    this.cvs = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.cvs.getContext("2d")!;
    this.bands = bands;
    this.smoothed = new Array(bands).fill(0);
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
    if (!this._running || !this.driver) return new Array(this.bands).fill(0);
    const freq = this.driver.readFrequencies();
    const step = Math.floor(freq.length / this.bands) || 1;

    return Array.from({ length: this.bands }, (_, i) => {
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
    this.smoothed = this.smoothed.map((v, i) => v + (targets[i] - v) * 0.12);

    const { width: W, height: H } = this.cvs;
    this.ctx.clearRect(0, 0, W, H);

    if (this._running) {
      this.ctx.fillStyle = "#dde4f0";
      this.ctx.fillRect(0, 0, W, H);
    }

    const bw = W / this.bands;

    this.smoothed.forEach((v, i) => {
      const x = i * bw;
      const bh = Math.max(1, v * (H - 10));
      const y = H - bh;

      const ratio = i / this.bands;

      let r: number, g: number, b: number;

      if (ratio < 0.5) {
        // 🟠 → 🟢 (naranja → verde)
        const t = ratio * 2;

        r = Math.floor(255 * (1 - t));       // baja rojo
        g = Math.floor(140 + 100 * t);       // sube verde
        b = Math.floor(40 * (1 - t));        // poco azul
      } else {
        // 🟢 → 🔵 (verde → azul)
        const t = (ratio - 0.5) * 2;

        r = Math.floor(80 * (1 - t));        // rojo casi desaparece
        g = Math.floor(220 * (1 - t));       // verde baja
        b = Math.floor(100 + 155 * t);       // azul sube
      }

      // ✨ glow suave
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;

      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + v * 0.6})`;
      this.ctx.fillRect(x + 1, y, bw - 2, bh);

      // brillo arriba
      if (v > 0.55) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${v})`;
        this.ctx.fillRect(x + 1, y - 2, bw - 2, 2);
      }
    });

    // línea base
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = "rgba(0,0,0,0.1)";
    this.ctx.beginPath();
    this.ctx.moveTo(0, H - 1);
    this.ctx.lineTo(W, H - 1);
    this.ctx.stroke();
  }

  private tick(): void {
    this.render();
    requestAnimationFrame(() => this.tick());
  }
}