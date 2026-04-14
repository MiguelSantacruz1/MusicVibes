// src/core/LinkedQueue.ts

import { Track } from "../types/Track";

export class QueueNode {
  track: Track;
  before: QueueNode | null = null;
  after: QueueNode | null = null;

  constructor(track: Track) {
    this.track = track;
  }
}

export class LinkedQueue {
  front: QueueNode | null = null;
  back: QueueNode | null = null;
  private _count: number = 0;

  get count(): number {
    return this._count;
  }

  prepend(track: Track): void {
    const node = new QueueNode(track);
    if (!this.front) {
      this.front = this.back = node;
    } else {
      node.after = this.front;
      this.front.before = node;
      this.front = node;
    }
    this._count++;
  }

  append(track: Track): void {
    const node = new QueueNode(track);
    if (!this.back) {
      this.front = this.back = node;
    } else {
      node.before = this.back;
      this.back.after = node;
      this.back = node;
    }
    this._count++;
  }

  insertAt(track: Track, index: number): void {
    if (index <= 0) return this.prepend(track);
    if (index >= this._count) return this.append(track);

    const node = new QueueNode(track);
    let cur = this.front!;
    for (let i = 0; i < index - 1; i++) cur = cur.after!;
    const following = cur.after;
    node.before = cur;
    node.after = following;
    cur.after = node;
    if (following) following.before = node;
    this._count++;
  }

  deleteByUid(uid: number): QueueNode | null {
    let cur = this.front;
    while (cur) {
      if (cur.track.uid === uid) {
        if (cur.before) cur.before.after = cur.after;
        else this.front = cur.after;
        if (cur.after) cur.after.before = cur.before;
        else this.back = cur.before;
        cur.before = null;
        cur.after = null;
        this._count--;
        return cur;
      }
      cur = cur.after;
    }
    return null;
  }

  findByUid(uid: number): QueueNode | null {
    let cur = this.front;
    while (cur) {
      if (cur.track.uid === uid) return cur;
      cur = cur.after;
    }
    return null;
  }

  toList(): Track[] {
    const out: Track[] = [];
    let cur = this.front;
    while (cur) {
      out.push(cur.track);
      cur = cur.after;
    }
    return out;
  }

  fromNode(node: QueueNode | null): Track[] {
    const out: Track[] = [];
    let cur = node;
    while (cur) {
      out.push(cur.track);
      cur = cur.after;
    }
    return out;
  }

  randomize(): void {
    if (this._count <= 1) return;
    const items = this.toList();
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    this.front = null;
    this.back = null;
    this._count = 0;
    for (const t of items) this.append(t);
  }
}
