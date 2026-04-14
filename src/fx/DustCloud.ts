
interface DustOptions {
  amount?: number;
}

class Mote {
  x: number = 0;
  y: number = 0;
  radius: number = 0;
  vx: number = 0;
  vy: number = 0;
  alpha: number = 1;
  fade: number = 0;
  tint: string = "";
  phase: number = 0;
  phaseRate: number = 0;

  constructor(private W: number, private H: number, scatter: boolean = false) {
    this.spawn(scatter);
  }

  spawn(scatter: boolean = false): void {
    this.x = Math.random() * this.W;
    this.y = scatter ? Math.random() * this.H : this.H + 12;
    this.radius = Math.random() * 2.2 + 0.4;
    this.vx = (Math.random() - 0.5) * 0.35;
    this.vy = -(Math.random() * 0.5 + 0.15);
    this.alpha = 1;
    this.fade = Math.random() * 0.005 + 0.002;
    const h = Math.random() < 0.55 ? 175 + Math.random() * 25 : 130 + Math.random() * 30;
    this.tint = `hsla(${h},75%,68%,`;
    this.phase = Math.random() * Math.PI * 2;
    this.phaseRate = Math.random() * 0.04 + 0.02;
  }

  step(isPlaying: boolean, bassLevel: number): void {
    this.phase += this.phaseRate + bassLevel * 0.08;
    const boost = isPlaying ? (1 + bassLevel * 3.5) : 0.4;
    this.x += this.vx * (isPlaying ? (1.3 + bassLevel) : 0.4);
    this.y += this.vy * (isPlaying ? 1.6 * boost : 0.5);
    this.alpha -= this.fade * (isPlaying ? 1.4 : 0.4);
    if (this.alpha <= 0 || this.y < -12) this.spawn();
  }

  paint(ctx: CanvasRenderingContext2D, isPlaying: boolean, bassLevel: number): void {
    const r = this.radius * (1 + Math.sin(this.phase) * 0.25 * (isPlaying ? 1 : 0.15)) + bassLevel * 1.8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    const a = Math.min(1, this.alpha * 0.55 + bassLevel * 0.35);
    ctx.fillStyle = this.tint + a + ")";
    ctx.fill();
  }
}

export class DustCloud {
  private cvs: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private motes: Mote[];
  private _running: boolean = false;
  private driver: import("../core/SoundDriver").SoundDriver | null = null;

  constructor(canvasId: string, opts: DustOptions = {}) {
    this.cvs = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.cvs.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());

    const n = opts.amount ?? 80;
    this.motes = Array.from({ length: n }, () => new Mote(this.cvs.width, this.cvs.height, true));
    this.tick();
  }

  set running(v: boolean) { this._running = v; }

  bindDriver(driver: import("../core/SoundDriver").SoundDriver) {
    this.driver = driver;
  }

  private resize(): void {
    this.cvs.width = window.innerWidth;
    this.cvs.height = window.innerHeight;
  }

  private render(): void {
    const bass = this.driver && this._running ? this.driver.readBassLevel() : 0;
    this.ctx.clearRect(0, 0, this.cvs.width, this.cvs.height);
    for (const m of this.motes) {
      m.step(this._running, bass);
      m.paint(this.ctx, this._running, bass);
    }
  }

  private tick(): void {
    this.render();
    requestAnimationFrame(() => this.tick());
  }
}
