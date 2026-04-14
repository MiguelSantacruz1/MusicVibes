// src/core/TrackManager.ts

import { LinkedQueue, QueueNode } from "./LinkedQueue";
import { Track } from "../types/Track";

export class TrackManager {
  private queue: LinkedQueue;
  private active: QueueNode | null = null;
  private serial: number = 1;
  public loopEnabled: boolean = true;
  public shuffleEnabled: boolean = false;

  constructor() {
    this.queue = new LinkedQueue();
  }

  // ── Helpers internos ─────────────────────────────────────
  private nextId(): number {
    return this.serial++;
  }

  private buildTrack(name: string, performer: string, length: string, src?: string, blob?: File): Track {
    return { uid: this.nextId(), name, performer, length, src, blob };
  }

  // ── Inserción de pistas ──────────────────────────────────
  pushFront(name: string, performer: string, length: string, src?: string, blob?: File): Track {
    const t = this.buildTrack(name, performer, length, src, blob);
    this.queue.prepend(t);
    if (!this.active) this.active = this.queue.front;
    return t;
  }

  pushBack(name: string, performer: string, length: string, src?: string, blob?: File): Track {
    const t = this.buildTrack(name, performer, length, src, blob);
    this.queue.append(t);
    if (!this.active) this.active = this.queue.front;
    return t;
  }

  pushAt(name: string, performer: string, length: string, position: number, src?: string, blob?: File): Track {
    const t = this.buildTrack(name, performer, length, src, blob);
    this.queue.insertAt(t, position);
    if (!this.active) this.active = this.queue.front;
    return t;
  }

  // ── Eliminar pista ───────────────────────────────────────
  drop(uid: number): boolean {
    if (this.active?.track.uid === uid) {
      this.active = this.active.after ?? this.active.before ?? null;
    }
    return this.queue.deleteByUid(uid) !== null;
  }

  // ── Navegación ───────────────────────────────────────────
  advance(): boolean {
    if (this.active?.after) {
      this.active = this.active.after;
      return true;
    }
    if (this.loopEnabled && this.queue.count > 0) {
      this.active = this.queue.front;
      return true;
    }
    return false;
  }

  rewind(): boolean {
    if (this.active?.before) {
      this.active = this.active.before;
      return true;
    }
    if (this.loopEnabled && this.queue.count > 0) {
      this.active = this.queue.back;
      return true;
    }
    return false;
  }

  flipLoop(): void {
    this.loopEnabled = !this.loopEnabled;
  }

  flipShuffle(): void {
    this.shuffleEnabled = !this.shuffleEnabled;
    if (this.shuffleEnabled) {
      const uid = this.getCurrent()?.uid;
      this.queue.randomize();
      if (uid !== undefined) this.jumpTo(uid);
    }
  }

  jumpTo(uid: number): boolean {
    const node = this.queue.findByUid(uid);
    if (node) { this.active = node; return true; }
    return false;
  }

  // ── Getters ──────────────────────────────────────────────
  getCurrent(): Track | null {
    return this.active?.track ?? null;
  }

  getAll(): Track[] {
    return this.queue.toList();
  }

  getUpcoming(): Track[] {
    if (!this.active?.after) return [];
    return this.queue.fromNode(this.active.after);
  }

  get total(): number {
    return this.queue.count;
  }

  getPrevName(): string {
    return this.active?.before?.track?.name ?? "—";
  }

  getNextName(): string {
    return this.active?.after?.track?.name ?? "—";
  }
}
