// src/app.ts

import { TrackManager } from "./core/TrackManager";
import { GainManager } from "./core/GainManager";
import { WaveRenderer } from "./fx/WaveRenderer";
import { SpectrumDisplay } from "./fx/SpectrumDisplay";
import { DustCloud } from "./fx/DustCloud";
import { SoundDriver } from "./core/SoundDriver";
// @ts-ignore
import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";
import { FIXED_SONGS } from "./data/fixedSongs";

let query = "";
let playing = false;
let activeTab: "local" | "deezer" = "local";
let deezerResults: any[] = [];

const catalog = new TrackManager();
const gain = new GainManager(70);
const driver = new SoundDriver();

const waveViz = new WaveRenderer("viz-canvas", 28);
const specViz = new SpectrumDisplay("freq-canvas", 40);
const dustFx = new DustCloud("bg-canvas", { amount: 80 });

waveViz.bindDriver(driver);
specViz.bindDriver(driver);
dustFx.bindDriver(driver);

FIXED_SONGS.forEach(song => {
  catalog.pushBack(song.title, song.artist, song.duration, song.url);
});

driver.onProgress = (elapsed, total) => {
  const bar = document.getElementById("progress-fill") as HTMLElement;
  const curr = document.getElementById("time-current") as HTMLElement;
  const safeDur = total || 210;
  bar.style.width = Math.min((elapsed / safeDur) * 100, 100) + "%";
  curr.textContent = fmtTime(elapsed);
  if (total && total !== Infinity) {
    const durEl = document.getElementById("time-total");
    if (durEl) durEl.textContent = fmtTime(total);
  }
};

driver.onFinished = () => (window as any).nextTrack();

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resetProgress(): void {
  const bar = document.getElementById("progress-fill") as HTMLElement;
  const curr = document.getElementById("time-current") as HTMLElement;
  bar.style.width = "0%";
  curr.textContent = "0:00";
}

function syncFx(): void {
  waveViz.running = playing;
  specViz.running = playing;
  dustFx.running = playing;
  document.body.classList.toggle("is-playing", playing);
}

(window as any).togglePlay = (): void => {
  playing = !playing;
  const disc = document.getElementById("vinyl") as HTMLElement;
  const iconPl = document.getElementById("icon-play") as HTMLElement;
  const iconPa = document.getElementById("icon-pause") as HTMLElement;

  iconPl.style.display = playing ? "none" : "block";
  iconPa.style.display = playing ? "block" : "none";

  if (playing) {
    disc.classList.add("spinning");
    const cur = catalog.getCurrent();
    if (!driver.active && cur?.src && !driver.getTotal()) driver.loadSource(cur.src);
    if (cur?.blob) extractAccent(cur.blob);
    else document.documentElement.style.setProperty("--accent", "#14c8dc");
    
    // Si no estamos tocando un preview de Deezer, ocultar cover
    if (!document.getElementById("vinyl-cover")?.getAttribute("data-is-deezer")) {
      const cover = document.getElementById("vinyl-cover") as HTMLElement;
      if (cover) cover.style.display = "none";
    }
    
    driver.resume();
  } else {
    disc.classList.remove("spinning");
    driver.halt();
  }
  syncFx();
  repaintAll();
};

(window as any).nextTrack = (): void => {
  driver.halt();
  catalog.advance();
  resetProgress();
  const cur = catalog.getCurrent();
  driver.loadSource(cur?.src ?? "");
  if (cur?.blob) extractAccent(cur.blob);
  else document.documentElement.style.setProperty("--accent", "#14c8dc");
  const cover = document.getElementById("vinyl-cover") as HTMLElement;
  if (cover) { cover.style.display = "none"; cover.removeAttribute("data-is-deezer"); }
  if (playing) driver.resume();
  repaintAll();
};

(window as any).prevTrack = (): void => {
  driver.halt();
  catalog.rewind();
  resetProgress();
  const cur = catalog.getCurrent();
  driver.loadSource(cur?.src ?? "");
  if (cur?.blob) extractAccent(cur.blob);
  else document.documentElement.style.setProperty("--accent", "#14c8dc");
  const cover = document.getElementById("vinyl-cover") as HTMLElement;
  if (cover) { cover.style.display = "none"; cover.removeAttribute("data-is-deezer"); }
  if (playing) driver.resume();
  repaintAll();
};

(window as any).pickTrack = (uid: number): void => {
  driver.halt();
  catalog.jumpTo(uid);
  resetProgress();
  const cur = catalog.getCurrent();
  driver.loadSource(cur?.src ?? "");
  if (cur?.blob) extractAccent(cur.blob);
  else document.documentElement.style.setProperty("--accent", "#14c8dc");
  const cover = document.getElementById("vinyl-cover") as HTMLElement;
  if (cover) { cover.style.display = "none"; cover.removeAttribute("data-is-deezer"); }
  if (playing) driver.resume();
  repaintAll();
};

(window as any).dropTrack = (uid: number, e: MouseEvent): void => {
  e.stopPropagation();
  catalog.drop(uid);
  repaintAll();
};

(window as any).seekClick = (e: MouseEvent): void => {
  const rail = document.getElementById("progress-track") as HTMLElement;
  if (!rail) return;
  const rect = rail.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const dur = driver.getTotal();
  if (dur && dur !== Infinity) {
    driver.goTo(pct * dur);
    (document.getElementById("progress-fill") as HTMLElement).style.width = pct * 100 + "%";
  }
};

(window as any).skipAhead = (s: number = 10): void => {
  const dur = driver.getTotal();
  if (dur && dur !== Infinity) driver.goTo(Math.min(driver.getElapsed() + s, dur));
};

(window as any).skipBack = (s: number = 10): void => {
  driver.goTo(Math.max(driver.getElapsed() - s, 0));
};

(window as any).gainUp = (): void => { gain.raise(10); repaintVol(); };
(window as any).gainDown = (): void => { gain.lower(10); repaintVol(); };
(window as any).setGain = (v: string): void => { gain.set(parseInt(v)); repaintVol(); };
(window as any).muteToggle = (): void => { gain.toggleSilence(); repaintVol(); };

(window as any).openModal = (): void =>
  (document.getElementById("modal-bg") as HTMLElement).classList.add("open");

(window as any).closeModal = (): void => {
  (document.getElementById("modal-bg") as HTMLElement).classList.remove("open");
  clearModalForm();
};

(window as any).togglePosInput = (): void => {
  const val = (document.getElementById("f-position") as HTMLSelectElement).value;
  (document.getElementById("position-wrap") as HTMLElement).style.display =
    val === "at" ? "flex" : "none";
};

(window as any).submitTrack = (): void => {
  const name = (document.getElementById("f-title") as HTMLInputElement).value.trim();
  const artist = (document.getElementById("f-artist") as HTMLInputElement).value.trim();
  const len = (document.getElementById("f-duration") as HTMLInputElement).value.trim() || "3:00";
  if (!name || !artist) { alert("Ingresa título y artista."); return; }

  let fileSrc: string | undefined;
  const fi = document.getElementById("f-file") as HTMLInputElement;
  if (fi?.files?.length) fileSrc = URL.createObjectURL(fi.files[0]);

  const pos = (document.getElementById("f-position") as HTMLSelectElement).value;
  const blob = fi?.files?.[0];
  if (pos === "start") catalog.pushFront(name, artist, len, fileSrc, blob);
  else if (pos === "end") catalog.pushBack(name, artist, len, fileSrc, blob);
  else {
    const n = parseInt((document.getElementById("f-pos-val") as HTMLInputElement).value) || 0;
    catalog.pushAt(name, artist, len, n, fileSrc, blob);
  }
  (window as any).closeModal();
  repaintAll();
};

(window as any).autoDetectMeta = (input: HTMLInputElement): void => {
  if (!input.files?.length) return;
  let fname = input.files[0].name.replace(/\.[^.]+$/, "");
  const titleEl = document.getElementById("f-title") as HTMLInputElement;
  const artistEl = document.getElementById("f-artist") as HTMLInputElement;
  if (fname.includes("-")) {
    const parts = fname.split("-");
    if (!artistEl.value) artistEl.value = parts[0].trim();
    if (!titleEl.value) titleEl.value = parts.slice(1).join("-").trim();
  } else {
    if (!titleEl.value) titleEl.value = fname;
  }
};

function clearModalForm(): void {
  ["f-title", "f-artist", "f-duration"].forEach(id =>
    ((document.getElementById(id) as HTMLInputElement).value = ""));
  const fi = document.getElementById("f-file") as HTMLInputElement;
  if (fi) fi.value = "";
  (document.getElementById("f-pos-val") as HTMLInputElement).value = "0";
  (document.getElementById("f-position") as HTMLSelectElement).value = "end";
  (document.getElementById("position-wrap") as HTMLElement).style.display = "none";
}

(window as any).onQueryInput = (e: Event): void => {
  query = (e.target as HTMLInputElement).value.toLowerCase();
  repaintList();
  if (activeTab === "deezer") searchDeezer();
};

(window as any).switchTab = (tab: "local" | "deezer"): void => {
  activeTab = tab;
  document.getElementById("tab-local")?.classList.toggle("active", tab === "local");
  document.getElementById("tab-deezer")?.classList.toggle("active", tab === "deezer");
  
  const viewLocal = document.getElementById("view-local") as HTMLElement;
  const viewDeezer = document.getElementById("view-deezer") as HTMLElement;
  if(viewLocal && viewDeezer) {
    viewLocal.style.display = tab === "local" ? "block" : "none";
    viewDeezer.style.display = tab === "deezer" ? "block" : "none";
  }
  
  if (tab === "deezer" && query && deezerResults.length === 0) {
    searchDeezer();
  }
};

async function searchDeezer() {
  if(!query) {
    deezerResults = [];
    repaintDeezerList();
    return;
  }
  try {
    const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    deezerResults = data.data || [];
    repaintDeezerList();
  } catch(e) {
    console.error("Deezer search error:", e);
  }
}

function repaintDeezerList() {
  const container = document.getElementById("deezer-list") as HTMLElement;
  if(!deezerResults.length) {
    container.innerHTML = `<div class="empty"><span class="empty-icon">🎧</span><p>Busca algo para ver resultados en Deezer</p></div>`;
    return;
  }
  container.innerHTML = deezerResults.map((t, i) => `
    <div class="song-item" onclick="playDeezer(${i})">
      <div class="song-num"><span class="song-num-text">${i + 1}</span></div>
      <div class="song-info">
        <div class="song-title-text">${t.title}</div>
        <div class="song-artist-text">${t.artist.name}</div>
      </div>
      <div class="song-dur">0:30</div>
      <button class="btn-add-deezer" onclick="addDeezerTrack(${i}, event)" title="Añadir a biblioteca">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </div>
  `).join("");
}

(window as any).playDeezer = (index: number) => {
  const track = deezerResults[index];
  if(!track || !track.preview) return;
  driver.halt();
  resetProgress();
  
  (document.getElementById("np-title") as HTMLElement).textContent = track.title;
  (document.getElementById("np-artist") as HTMLElement).textContent = track.artist.name;
  
  const cover = document.getElementById("vinyl-cover") as HTMLImageElement;
  if(cover) {
    cover.src = track.album.cover_medium;
    cover.style.display = "block";
    cover.setAttribute("data-is-deezer", "true");
  }
  
  driver.loadSource(track.preview);
  playing = true;
  document.getElementById("icon-play")!.style.display = "none";
  document.getElementById("icon-pause")!.style.display = "block";
  document.getElementById("vinyl")?.classList.add("spinning");
  driver.resume();
  syncFx();
};

(window as any).addDeezerTrack = (index: number, e: MouseEvent) => {
  e.stopPropagation();
  const t = deezerResults[index];
  if(!t) return;
  catalog.pushBack(t.title, t.artist.name, "0:30", t.preview);
  repaintList();
  repaintQueue();
  alert('"' + t.title + '" añadido a la biblioteca.');
};

(window as any).toggleShuffle = (): void => {
  catalog.flipShuffle();
  document.getElementById("btn-shuffle")?.classList.toggle("active", catalog.shuffleEnabled);
  repaintAll();
};

(window as any).toggleLoop = (): void => {
  catalog.flipLoop();
  document.getElementById("btn-loop")?.classList.toggle("active", catalog.loopEnabled);
};

function extractAccent(blob: File): void {
  jsmediatags.read(blob, {
    onSuccess: (tag: any) => {
      const pic = tag.tags.picture;
      if (!pic) return;
      let b64 = "";
      for (let i = 0; i < pic.data.length; i++) b64 += String.fromCharCode(pic.data[i]);
      const src = "data:" + pic.format + ";base64," + window.btoa(b64);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0, 1, 1);
        const px = cx.getImageData(0, 0, 1, 1).data;
        document.documentElement.style.setProperty(
          "--accent", "#" + ("000000" + toHex(px[0], px[1], px[2])).slice(-6)
        );
      };
      img.src = src;
    },
    onError: (err: any) => console.warn("jsmediatags:", err),
  });
}

function toHex(r: number, g: number, b: number): string {
  return ((r << 16) | (g << 8) | b).toString(16);
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "Space") { e.preventDefault(); (window as any).togglePlay(); }
  if (e.code === "ArrowRight" && e.shiftKey) { e.preventDefault(); (window as any).skipAhead(10); }
  else if (e.code === "ArrowLeft" && e.shiftKey) { e.preventDefault(); (window as any).skipBack(10); }
  else if (e.code === "ArrowRight") { e.preventDefault(); (window as any).nextTrack(); }
  else if (e.code === "ArrowLeft") { e.preventDefault(); (window as any).prevTrack(); }
  if (e.code === "ArrowUp") { e.preventDefault(); (window as any).gainUp(); }
  if (e.code === "ArrowDown") { e.preventDefault(); (window as any).gainDown(); }
});

document.body.addEventListener("dragover", (e) => { e.preventDefault(); document.body.style.opacity = "0.7"; });
document.body.addEventListener("dragleave", () => { document.body.style.opacity = "1"; });
document.body.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.style.opacity = "1";
  if (!e.dataTransfer?.files) return;
  for (const file of Array.from(e.dataTransfer.files)) {
    if (!file.type.startsWith("audio/")) continue;
    const url = URL.createObjectURL(file);
    let fname = file.name.replace(/\.[^.]+$/, "");
    let name = fname, artist = "Desconocido";
    if (fname.includes("-")) {
      const p = fname.split("-");
      artist = p[0].trim(); name = p.slice(1).join("-").trim();
    }
    catalog.pushBack(name, artist, "3:00", url, file);
  }
  repaintAll();
});

const GAIN_ICONS: Record<string, string> = {
  mute: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>`,
  low: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>`,
  mid: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
  high: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
};

function repaintVol(): void {
  const slider = document.getElementById("vol-slider") as HTMLInputElement;
  document.getElementById("vol-label")!.textContent = gain.silenced ? "0" : String(gain.slider);
  document.getElementById("vol-icon")!.innerHTML = GAIN_ICONS[gain.iconName()];
  slider.value = String(gain.slider);
  slider.style.setProperty("--val", gain.slider + "%");
  driver.adjustVolume(gain.silenced ? 0 : gain.slider);
}

function repaintList(): void {
  const tracks = catalog.getAll().filter(t =>
    !query || t.name.toLowerCase().includes(query) || t.performer.toLowerCase().includes(query)
  );
  const cur = catalog.getCurrent();

  (document.getElementById("np-title") as HTMLElement).textContent = cur?.name ?? "Sin pista";
  (document.getElementById("np-artist") as HTMLElement).textContent = cur?.performer ?? "—";

  const container = document.getElementById("song-list") as HTMLElement;
  if (!tracks.length) {
    container.innerHTML = `<div class="empty"><span class="empty-icon">🎵</span><p>La biblioteca está vacía</p></div>`;
    return;
  }

  container.innerHTML = tracks.map((t, i) => {
    const active = cur?.uid === t.uid;
    const isPlaying = active && playing;
    return `
    <div class="song-item ${active ? "active" : ""} ${isPlaying ? "playing" : ""}"
         onclick="pickTrack(${t.uid})">
      <div class="song-num">
        <span class="song-num-text">${active ? "♪" : i + 1}</span>
        <div class="song-bar-icon">
          <div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
      </div>
      <div class="song-info">
        <div class="song-title-text">${t.name}</div>
        <div class="song-artist-text">${t.performer}</div>
      </div>
      <div class="song-dur">${t.length}</div>
      <button class="btn-del" onclick="dropTrack(${t.uid}, event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>`;
  }).join("");
}

function repaintQueue(): void {
  const upcoming = catalog.getUpcoming();
  const el = document.getElementById("up-next-list") as HTMLElement;
  el.innerHTML = !upcoming.length
    ? `<p class="un-empty">No hay más pistas en cola</p>`
    : upcoming.slice(0, 6).map((t, i) => `
      <div class="un-item" onclick="pickTrack(${t.uid})">
        <span class="un-num">${i + 1}</span>
        <div class="un-info">
          <div class="un-title-text">${t.name}</div>
          <div class="un-artist">${t.performer}</div>
        </div>
        <span class="un-dur">${t.length}</span>
      </div>`).join("");
}

function repaintAll(): void {
  repaintList();
  repaintQueue();
  repaintVol();
}

const D1 = "/demo1.mp3";
const D2 = "/demo2.mp3";
const D3 = "/demo3.mp3";

// ── Arranque ──────────────────────────────────────────────────
repaintAll();
