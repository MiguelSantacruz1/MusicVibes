// src/core/GainManager.ts

export type GainIcon = "mute" | "low" | "mid" | "high";

export class GainManager {
  private _level: number;
  private _silenced: boolean = false;
  private _lastLevel: number;

  constructor(initial: number = 70) {
    this._level = Math.max(0, Math.min(100, initial));
    this._lastLevel = this._level;
  }

  // ── Lectura ──────────────────────────────────────────────
  /** Nivel efectivo (0 si silenciado) */
  get output(): number {
    return this._silenced ? 0 : this._level;
  }

  /** Valor del slider (sin afectar mute) */
  get slider(): number {
    return this._level;
  }

  get silenced(): boolean {
    return this._silenced;
  }

  // ── Escritura ────────────────────────────────────────────
  raise(step: number = 10): void {
    this._level = Math.min(100, this._level + step);
    if (this._silenced) this._silenced = false;
  }

  lower(step: number = 10): void {
    this._level = Math.max(0, this._level - step);
  }

  set(value: number): void {
    this._level = Math.max(0, Math.min(100, Math.round(value)));
    if (this._silenced && this._level > 0) this._silenced = false;
  }

  toggleSilence(): void {
    if (this._silenced) {
      this._silenced = false;
      if (this._level === 0) this._level = this._lastLevel || 50;
    } else {
      this._lastLevel = this._level;
      this._silenced = true;
    }
  }

  // ── Icono UI ─────────────────────────────────────────────
  iconName(): GainIcon {
    if (this._silenced || this._level === 0) return "mute";
    if (this._level < 33) return "low";
    if (this._level < 66) return "mid";
    return "high";
  }
}
