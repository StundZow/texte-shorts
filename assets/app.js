'use strict';

/* ======================================================================
   Texte Shorts — générateur de titres façon TikTok, export PNG transparent
   ====================================================================== */

// Emojis Apple 160 px (dépôt iamcal/emoji-data), servis avec CORS pour que l'export PNG fonctionne.
const EMOJI_CDN = 'https://cdn.jsdelivr.net/gh/iamcal/emoji-data@v16.0.0/img-apple-160/';
const FONT = '"TikTok Sans"';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const VERTICAL = { w: 1080, h: 1920 };
const STATE_KEY = 'texte-shorts:state';
const HISTORY_KEY = 'texte-shorts:history';

const BG_COLORS = [
  ['Rouge', '#EA4040'], ['Bleu', '#3494F0'], ['Orange', '#FF933D'], ['Jaune', '#F2CD46'],
  ['Vert', '#78C25E'], ['Turquoise', '#2EC4B6'], ['Violet', '#8B5CF6'], ['Rose', '#F472B6'],
  ['Blanc', '#FFFFFF'], ['Noir', '#000000'],
];

const FAVORITE_EMOJIS = [
  '💀', '😳', '🤣', '😭', '❌', '🤑', '🤯', '😱',
  '🔥', '😂', '😵‍💫', '🥶', '😡', '🫣', '🤔', '😎',
  '🥵', '😈', '👀', '💸', '💰', '🏆', '⚠️', '✅',
  '🚨', '🤡', '🙏', '😍', '🥹', '😏', '🤩', '🗿',
  '💯', '❤️', '🎮', '🚗', '😴', '🫡', '👑', '💥',
];

// Proportions mesurées sur les titres TikTok (en em = taille de police).
const LAYOUT_DEFAULTS = {
  style: 'box',
  fontSize: 80,
  weight: 600,
  maxWidth: 900,
  wrap: true,
  lineHeight: 1.19,
  padX: 0.36,
  padY: 0.29,
  radius: 0.15,
  emojiSize: 1.0,
};

const DEFAULTS = {
  text: 'J’ai enfin réussi ce Stunt Impossible',
  emoji1: '😳',
  emoji2: '💀',
  spaceBeforeEmoji: true,
  bg: '#EA4040',
  textColor: 'auto',
  shadow: true,
  shadowOpacity: 35,
  shadowBlur: 14,
  shadowDistance: 4,
  shadowAngle: 90,
  shadowColor: '#000000',
  ...LAYOUT_DEFAULTS,
  frame: 'fit',
  posY: 30,
  scale: 2,
  previewBg: 'checker',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
  },
};

const state = { ...DEFAULTS, ...store.get(STATE_KEY, {}) };
if (state.previewBg === 'image') state.previewBg = 'checker';
let recents = store.get(HISTORY_KEY, []);
let activeSlot = 'emoji1';
let previewImageUrl = null;
let dirHandle = null;

/* ---------------------------------------------------------------- Couleurs */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function textColor() {
  if (state.textColor !== 'auto') return state.textColor;
  if (state.style === 'none') return state.bg;
  return luminance(state.bg) > 0.55 ? '#000000' : '#FFFFFF';
}

/* ------------------------------------------------------------------ Emojis */

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const isEmoji = g => EMOJI_RE.test(g);
const graphemes = str => [...segmenter.segment(str)].map(s => s.segment);

function emojiFileCandidates(g) {
  const cps = [...g].map(c => c.codePointAt(0).toString(16).padStart(4, '0'));
  const full = cps.join('-');
  const noVs = cps.filter(c => c !== 'fe0f').join('-');
  const list = [full];
  if (noVs !== full) list.push(noVs);
  if (cps.length === 1) list.push(full + '-fe0f');
  return list;
}

const emojiCache = new Map();

function getEmoji(g) {
  let entry = emojiCache.get(g);
  if (entry) return entry;
  entry = { status: 'loading', img: null };
  entry.promise = new Promise(resolve => {
    const candidates = emojiFileCandidates(g);
    const tryNext = i => {
      if (i >= candidates.length) {
        entry.status = 'fail';
        resolve();
        scheduleRender();
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.status = 'ok';
        entry.img = img;
        resolve();
        scheduleRender();
      };
      img.onerror = () => tryNext(i + 1);
      img.src = EMOJI_CDN + candidates[i] + '.png';
    };
    tryNext(0);
  });
  emojiCache.set(g, entry);
  return entry;
}

async function assetsReady() {
  await document.fonts.load(fontString(state.weight, 80), 'AaÉé’');
  const wanted = graphemes(composeText()).filter(isEmoji);
  await Promise.all(wanted.map(g => getEmoji(g).promise));
}

/* ------------------------------------------------------------ Mise en page */

function fontString(weight, px) {
  return `${weight} ${px}px ${FONT}`;
}

// Texte final : apostrophes typographiques (comme l'iPhone), espaces insécables
// devant ? ! : ; et devant les emojis pour qu'ils ne partent jamais seuls à la ligne.
function composeText() {
  const text = state.text
    .replace(/'/g, '’')
    .replace(/ +([?!:;])/g, ' $1')
    .replace(/\s+$/, '');
  const emojis = [state.emoji1, state.emoji2].map(e => (e || '').trim()).join('');
  if (!emojis) return text;
  if (!text) return emojis;
  return text + (state.spaceBeforeEmoji ? ' ' : '') + emojis;
}

function splitRuns(word) {
  const runs = [];
  for (const g of graphemes(word)) {
    const last = runs[runs.length - 1];
    if (isEmoji(g)) runs.push({ type: 'emoji', g });
    else if (last && last.type === 'text') last.str += g;
    else runs.push({ type: 'text', str: g });
  }
  return runs;
}

let measureCtx = null;

function computeLayout(s) {
  const ctx = measureCtx || (measureCtx = document.createElement('canvas').getContext('2d'));
  const F = state.fontSize * s;
  ctx.font = fontString(state.weight, F);
  const capH = ctx.measureText('H').actualBoundingBoxAscent;
  const spaceW = ctx.measureText(' ').width;
  const E = state.emojiSize * F;
  const emojiGap = 0.06 * F;
  const maxW = state.wrap ? state.maxWidth * s : Infinity;

  // Place les morceaux d'un mot et renvoie sa largeur.
  const placeRuns = runs => {
    let x = 0;
    runs.forEach((r, i) => {
      const prev = runs[i - 1];
      if (r.type === 'emoji') {
        if (prev) x += prev.type === 'emoji' ? emojiGap : 0.03 * F;
        r.w = E;
      } else {
        r.w = ctx.measureText(r.str).width;
      }
      r.dx = x;
      x += r.w;
    });
    return x;
  };

  const lines = [];
  for (const para of composeText().split('\n')) {
    const words = para.split(' ').filter(Boolean).map(w => {
      const runs = splitRuns(w);
      return { runs, w: placeRuns(runs) };
    });
    if (!words.length) continue;
    let line = { words: [], w: 0 };
    for (const word of words) {
      const add = (line.words.length ? spaceW : 0) + word.w;
      if (line.words.length && line.w + add > maxW) {
        lines.push(line);
        line = { words: [], w: 0 };
      }
      line.w += (line.words.length ? spaceW : 0) + word.w;
      line.words.push(word);
    }
    lines.push(line);
  }
  if (!lines.length) return null;

  const boxed = state.style === 'box';
  const L = state.lineHeight * F;
  const padX = boxed ? state.padX * F : 0.06 * F;
  const padTop = state.padY * F;
  const padBot = (state.padY + 0.13) * F;
  // Ce qui dépasse autour des lettres : accents, jambages, emojis.
  const inkTop = Math.max(capH + 0.22 * F, capH / 2 + E / 2);
  const inkBot = Math.max(0.24 * F, E / 2 - capH / 2);

  const rows = lines.map((ln, i) => {
    const base = i * L;
    return { ...ln, base, top: base - capH - padTop, bottom: base + padBot, boxW: ln.w + 2 * padX };
  });

  const maxBoxW = Math.max(...rows.map(r => r.boxW));
  const last = rows[rows.length - 1];
  let y0 = -inkTop;
  let y1 = last.base + inkBot;
  if (boxed) {
    y0 = Math.min(y0, rows[0].top);
    y1 = Math.max(y1, last.bottom);
  }
  const bounds = { x0: -maxBoxW / 2, x1: maxBoxW / 2, y0, y1 };
  return { F, capH, spaceW, E, rows, bounds };
}

// Contour en escalier (un rectangle par ligne, centrés), sens horaire.
function outlinePoints(lay, ox, oy) {
  const rows = lay.rows;
  const n = rows.length;
  const xl = i => ox - rows[i].boxW / 2;
  const xr = i => ox + rows[i].boxW / 2;
  // Entre deux lignes, c'est la plus large qui recouvre la zone de chevauchement.
  const junction = i => oy + (rows[i].boxW >= rows[i + 1].boxW ? rows[i].bottom : rows[i + 1].top);

  const pts = [[xl(0), oy + rows[0].top], [xr(0), oy + rows[0].top]];
  for (let i = 0; i < n - 1; i++) pts.push([xr(i), junction(i)], [xr(i + 1), junction(i)]);
  pts.push([xr(n - 1), oy + rows[n - 1].bottom], [xl(n - 1), oy + rows[n - 1].bottom]);
  for (let i = n - 2; i >= 0; i--) pts.push([xl(i + 1), junction(i)], [xl(i), junction(i)]);
  return simplify(pts);
}

function simplify(pts) {
  const same = (a, b) => Math.abs(a - b) < 0.01;
  let changed = true;
  while (changed && pts.length > 4) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const p = pts[i];
      const next = pts[(i + 1) % pts.length];
      const dup = same(p[0], prev[0]) && same(p[1], prev[1]);
      const collinear = (same(prev[0], p[0]) && same(p[0], next[0])) || (same(prev[1], p[1]) && same(p[1], next[1]));
      if (dup || collinear) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

// Arrondit chaque angle (convexe ou rentrant) du polygone.
function roundedPath(ctx, pts, r) {
  const n = pts.length;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const first = pts[0];
  const last = pts[n - 1];
  ctx.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const rad = Math.max(0, Math.min(r, dist(p, prev) / 2, dist(p, next) / 2));
    ctx.arcTo(p[0], p[1], next[0], next[1], rad);
  }
  ctx.closePath();
}

function drawTitle(ctx, lay, ox, oy) {
  if (state.style === 'box') {
    ctx.fillStyle = state.bg;
    ctx.beginPath();
    roundedPath(ctx, outlinePoints(lay, ox, oy), state.radius * lay.F);
    ctx.fill();
  }
  ctx.fillStyle = textColor();
  ctx.font = fontString(state.weight, lay.F);
  ctx.textBaseline = 'alphabetic';
  for (const row of lay.rows) {
    let x = ox - row.w / 2;
    const y = oy + row.base;
    row.words.forEach((word, i) => {
      if (i) x += lay.spaceW;
      for (const r of word.runs) drawRun(ctx, r, x + r.dx, y, lay);
      x += word.w;
    });
  }
}

function drawRun(ctx, r, x, y, lay) {
  if (r.type === 'text') {
    ctx.fillText(r.str, x, y);
    return;
  }
  const E = lay.E;
  const cy = y - lay.capH / 2;
  const entry = getEmoji(r.g);
  if (entry.status === 'ok') {
    ctx.drawImage(entry.img, x, cy - E / 2, E, E);
  } else if (entry.status === 'fail') {
    ctx.save();
    ctx.font = `${E * 0.84}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.g, x + E / 2, cy);
    ctx.restore();
  }
}

/* ----------------------------------------------------------- Rendu final */

// Calcule la taille du PNG et la position du titre pour une échelle donnée.
function plan(s) {
  const lay = computeLayout(s);
  if (!lay) return null;
  const b = lay.bounds;
  const layerW = Math.ceil(b.x1 - b.x0) + 4;
  const layerH = Math.ceil(b.y1 - b.y0) + 4;
  const ox = 2 - b.x0;
  const oy = 2 - b.y0;

  const shadowOn = state.shadow && state.shadowOpacity > 0;
  const angle = state.shadowAngle * Math.PI / 180;
  const offX = shadowOn ? Math.cos(angle) * state.shadowDistance * s : 0;
  const offY = shadowOn ? Math.sin(angle) * state.shadowDistance * s : 0;

  let W, H, dx, dy;
  if (state.frame === 'vertical') {
    W = Math.round(VERTICAL.w * s);
    H = Math.round(VERTICAL.h * s);
    dx = Math.round(W / 2 - ox);
    dy = Math.round(H * state.posY / 100 - 2 - (b.y1 - b.y0) / 2);
  } else {
    const ext = shadowOn ? state.shadowBlur * s * 1.2 + 2 : 0;
    const mL = Math.ceil(Math.max(0, ext - offX));
    const mR = Math.ceil(Math.max(0, ext + offX));
    const mT = Math.ceil(Math.max(0, ext - offY));
    const mB = Math.ceil(Math.max(0, ext + offY));
    W = layerW + mL + mR;
    H = layerH + mT + mB;
    dx = mL;
    dy = mT;
  }
  return { s, lay, layerW, layerH, ox, oy, W, H, dx, dy, shadowOn, offX, offY };
}

function paint(p, canvas) {
  canvas.width = p.W;
  canvas.height = p.H;
  const layer = document.createElement('canvas');
  layer.width = p.layerW;
  layer.height = p.layerH;
  drawTitle(layer.getContext('2d'), p.lay, p.ox, p.oy);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, p.W, p.H);
  ctx.save();
  if (p.shadowOn) {
    const [r, g, b] = hexToRgb(state.shadowColor);
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${state.shadowOpacity / 100})`;
    ctx.shadowBlur = state.shadowBlur * p.s;
    ctx.shadowOffsetX = p.offX;
    ctx.shadowOffsetY = p.offY;
  }
  ctx.drawImage(layer, p.dx, p.dy);
  ctx.restore();
  return canvas;
}

function exportCanvas() {
  const p = plan(state.scale);
  return p ? paint(p, document.createElement('canvas')) : null;
}

let raf = 0;
function scheduleRender() {
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPreview(); });
}

function renderPreview() {
  const preview = $('#preview');
  const frame = $('#frame');
  const canvas = $('#canvas');
  const dpr = window.devicePixelRatio || 1;
  const vertical = state.frame === 'vertical';

  const base = plan(1);
  frame.classList.toggle('vertical', vertical);
  if (!base) {
    canvas.width = canvas.height = 0;
    frame.style.width = frame.style.height = '';
    $('#dims').textContent = 'Écris un titre pour commencer';
    return;
  }

  const pad = 40;
  const fit = Math.min((preview.clientWidth - pad * 2) / base.W, (preview.clientHeight - pad * 2) / base.H);
  const ds = Math.max(0.05, vertical ? fit : Math.min(1, fit));
  const p = plan(ds * dpr);
  paint(p, canvas);
  canvas.style.width = `${p.W / dpr}px`;
  canvas.style.height = `${p.H / dpr}px`;

  if (vertical) {
    frame.style.width = `${p.W / dpr}px`;
    frame.style.height = `${p.H / dpr}px`;
  } else {
    frame.style.width = frame.style.height = '';
  }
  applyPreviewBackground();

  const lines = base.lay.rows.length;
  $('#dims').textContent = `${Math.round(base.W * state.scale)} × ${Math.round(base.H * state.scale)} px · ${lines} ligne${lines > 1 ? 's' : ''}`;
}

function applyPreviewBackground() {
  const preview = $('#preview');
  const frame = $('#frame');
  const vertical = state.frame === 'vertical';
  const target = vertical ? frame : preview;
  const other = vertical ? preview : frame;
  const cls = { checker: 'checker', dark: 'pbg-dark', light: 'pbg-light', image: 'pbg-dark' }[state.previewBg];

  for (const el of [preview, frame]) {
    el.classList.remove('checker', 'pbg-dark', 'pbg-light');
    el.style.backgroundImage = '';
  }
  target.classList.add(cls);
  if (state.previewBg === 'image' && previewImageUrl) target.style.backgroundImage = `url("${previewImageUrl}")`;
  if (vertical) other.classList.add('pbg-dark');
}

/* -------------------------------------------------------------- Export */

function fileName() {
  const clean = graphemes(state.text)
    .filter(g => !isEmoji(g))
    .join('')
    .replace(/'/g, '’')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70)
    .trim();
  return (clean || 'titre') + '.png';
}

const toBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

async function exportPNG() {
  try {
    await assetsReady();
    const canvas = exportCanvas();
    if (!canvas) return toast('Écris un titre d’abord', true);
    const blob = await toBlob(canvas);
    const name = fileName();
    if (dirHandle) {
      try {
        const saved = await saveToFolder(blob, name);
        toast(`Enregistré dans ${dirHandle.name} : ${saved}`);
        addHistory();
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn(e);
        toast('Accès au dossier refusé, téléchargement à la place', true);
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`PNG exporté : ${name}`);
    addHistory();
  } catch (e) {
    console.error(e);
    toast(`Export impossible : ${e.message}`, true);
  }
}

async function copyPNG() {
  try {
    const blob = assetsReady().then(() => toBlob(exportCanvas()));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Copié — colle-le où tu veux (Ctrl+V)');
    addHistory();
  } catch (e) {
    console.error(e);
    toast(`Copie impossible : ${e.message}`, true);
  }
}

async function saveToFolder(blob, name) {
  let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') perm = await dirHandle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') throw new Error('permission refusée');
  const base = name.replace(/\.png$/i, '');
  let finalName = name;
  for (let i = 2; ; i++) {
    try {
      await dirHandle.getFileHandle(finalName);
      finalName = `${base} (${i}).png`;
    } catch {
      break;
    }
  }
  const fh = await dirHandle.getFileHandle(finalName, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return finalName;
}

// Petit coffre IndexedDB pour se souvenir du dossier d'export entre deux sessions.
const idb = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('texte-shorts', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  get: key => idb.run('readonly', s => s.get(key)),
  set: (key, val) => idb.run('readwrite', s => s.put(val, key)),
  del: key => idb.run('readwrite', s => s.delete(key)),
};

function updateFolderUI() {
  $('#folderName').textContent = dirHandle ? dirHandle.name : 'Téléchargements';
  $('#folderReset').hidden = !dirHandle;
}

async function chooseFolder() {
  try {
    dirHandle = await window.showDirectoryPicker({ id: 'texte-shorts', mode: 'readwrite' });
    await idb.set('dir', dirHandle).catch(() => {});
    updateFolderUI();
    toast(`Les PNG iront dans « ${dirHandle.name} »`);
  } catch (e) {
    if (e.name !== 'AbortError') toast(`Dossier inaccessible : ${e.message}`, true);
  }
}

/* -------------------------------------------------------------- Historique */

function addHistory() {
  const entry = { text: state.text, emoji1: state.emoji1, emoji2: state.emoji2, bg: state.bg };
  const key = JSON.stringify(entry);
  recents = [entry, ...recents.filter(h => JSON.stringify(h) !== key)].slice(0, 25);
  store.set(HISTORY_KEY, recents);
  renderHistory();
}

function renderHistory() {
  const box = $('#history');
  $('#historyGroup').hidden = !recents.length;
  box.replaceChildren(...recents.map(h => {
    const b = document.createElement('button');
    b.type = 'button';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = h.bg;
    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = `${h.text} ${h.emoji1 || ''}${h.emoji2 || ''}`;
    b.title = txt.textContent;
    b.append(dot, txt);
    b.addEventListener('click', () => setState({ ...h }));
    return b;
  }));
}

/* ------------------------------------------------------------ Interface */

let saveTimer = 0;
function setState(patch, source) {
  Object.assign(state, patch);
  syncControls(source);
  scheduleRender();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set(STATE_KEY, state), 250);
}

function formatVal(key, v) {
  if (['lineHeight', 'padX', 'padY', 'radius', 'emojiSize'].includes(key)) return Number(v).toFixed(2);
  return String(Math.round(v));
}

function syncControls(source) {
  for (const el of $$('[data-key]')) {
    if (el === source) continue;
    const v = state[el.dataset.key];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.value !== String(v)) el.value = v;
  }
  for (const o of $$('output[data-for]')) {
    o.textContent = formatVal(o.dataset.for, state[o.dataset.for]) + (o.dataset.unit || '');
  }

  const presetTc = ['auto', '#FFFFFF', '#000000'];
  $$('#textColorSeg [data-tc]').forEach(b => b.classList.toggle('on', b.dataset.tc === state.textColor));
  const customTc = !presetTc.includes(state.textColor);
  const tcLabel = $('#textColorSeg .seg-color');
  tcLabel.classList.toggle('on', customTc);
  tcLabel.style.setProperty('--tc', customTc ? state.textColor : '');
  if (customTc) $('#textColorPick').value = state.textColor;

  $$('#styleSeg [data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === state.style));
  $$('#previewBgSeg [data-pbg]').forEach(b => b.classList.toggle('on', b.dataset.pbg === state.previewBg));
  $$('#frameSeg [data-frame]').forEach(b => b.classList.toggle('on', b.dataset.frame === state.frame));
  $$('#scaleSeg [data-scale]').forEach(b => b.classList.toggle('on', Number(b.dataset.scale) === state.scale));
  $('#posYCtrl').hidden = state.frame !== 'vertical';
  $('#shadowControls').classList.toggle('disabled', !state.shadow);
  $('#bgTitle').textContent = state.style === 'box' ? 'Couleur du fond' : 'Couleur du texte';
  $('#textColorSeg').previousElementSibling.hidden = state.style !== 'box';
  $('#textColorSeg').hidden = state.style !== 'box';

  const known = BG_COLORS.some(([, c]) => c.toLowerCase() === state.bg.toLowerCase());
  $$('#bgSwatches .swatch[data-color]').forEach(s => s.classList.toggle('selected', s.dataset.color.toLowerCase() === state.bg.toLowerCase()));
  const custom = $('#bgSwatches .swatch.custom');
  custom.classList.toggle('selected', !known);
  custom.style.setProperty('--custom', known ? 'transparent' : state.bg);
  if (!known) $('#customBg').value = state.bg;

  for (const key of ['emoji1', 'emoji2']) {
    const slot = $(`.slot[data-slot="${key}"]`);
    slot.classList.toggle('filled', !!state[key]);
    slot.classList.toggle('active', activeSlot === key);
  }

  const lum = luminance(state.bg);
  document.documentElement.style.setProperty('--accent', lum > 0.6 || lum < 0.02 ? '#EA4040' : state.bg);
}

function buildSwatches() {
  const box = $('#bgSwatches');
  for (const [name, color] of BG_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.color = color;
    b.title = name;
    b.style.background = color;
    b.addEventListener('click', () => setState({ bg: color }));
    box.append(b);
  }
  const custom = document.createElement('label');
  custom.className = 'swatch custom';
  custom.title = 'Couleur perso';
  custom.innerHTML = '<span class="dot"></span><input type="color" id="customBg">';
  box.append(custom);
  $('#customBg').addEventListener('input', e => setState({ bg: e.target.value.toUpperCase() }));
}

function buildEmojiGrid() {
  const grid = $('#emojiGrid');
  for (const g of FAVORITE_EMOJIS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = g;
    const img = new Image();
    img.alt = g;
    img.src = EMOJI_CDN + emojiFileCandidates(g)[0] + '.png';
    img.onerror = () => { b.textContent = g; b.classList.add('native'); };
    b.append(img);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => pickEmoji(g));
    grid.append(b);
  }
}

function pickEmoji(g) {
  const slot = activeSlot;
  if (slot === 'emoji1') activeSlot = 'emoji2';
  setState({ [slot]: g });
}

function bindControls() {
  for (const el of $$('[data-key]')) {
    el.addEventListener('input', () => {
      const key = el.dataset.key;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'range') v = parseFloat(el.value);
      else v = el.value;
      if (key === 'emoji1' || key === 'emoji2') {
        // Une case = un emoji : on garde le dernier tapé.
        const gs = graphemes(v.trim());
        v = gs.length ? gs[gs.length - 1] : '';
        el.value = v;
        if (v && key === 'emoji1' && !state.emoji2) activeSlot = 'emoji2';
      }
      if (key === 'shadowColor') v = v.toUpperCase();
      setState({ [key]: v }, el);
    });
  }

  for (const key of ['emoji1', 'emoji2']) {
    $(`#${key}`).addEventListener('focus', () => { activeSlot = key; syncControls(); });
  }
  $$('[data-clear]').forEach(b => b.addEventListener('click', () => {
    activeSlot = b.dataset.clear;
    setState({ [b.dataset.clear]: '' });
  }));

  $$('#textColorSeg [data-tc]').forEach(b => b.addEventListener('click', () => setState({ textColor: b.dataset.tc })));
  $('#textColorPick').addEventListener('input', e => setState({ textColor: e.target.value.toUpperCase() }));
  $$('#styleSeg [data-style]').forEach(b => b.addEventListener('click', () => setState({ style: b.dataset.style })));
  $$('#frameSeg [data-frame]').forEach(b => b.addEventListener('click', () => setState({ frame: b.dataset.frame })));
  $$('#scaleSeg [data-scale]').forEach(b => b.addEventListener('click', () => setState({ scale: Number(b.dataset.scale) })));
  $$('#previewBgSeg [data-pbg]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.pbg === 'image' && (!previewImageUrl || state.previewBg === 'image')) {
      $('#pbgFile').click();
      return;
    }
    setState({ previewBg: b.dataset.pbg });
  }));
  $('#pbgFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setPreviewImage(file);
    e.target.value = '';
  });

  $('#resetLayout').addEventListener('click', () => setState({ ...LAYOUT_DEFAULTS }));
  $('#clearHistory').addEventListener('click', () => {
    recents = [];
    store.set(HISTORY_KEY, recents);
    renderHistory();
  });

  $('#exportBtn').addEventListener('click', exportPNG);
  $('#copyBtn').addEventListener('click', copyPNG);
  if ('showDirectoryPicker' in window) {
    $('#folderBtn').addEventListener('click', chooseFolder);
    $('#folderReset').addEventListener('click', async () => {
      dirHandle = null;
      await idb.del('dir').catch(() => {});
      updateFolderUI();
    });
  } else {
    $('.tb-block.folder').hidden = true;
  }

  // Glisser l'aperçu vers l'Explorateur crée directement le PNG.
  $('#canvas').addEventListener('dragstart', e => {
    const canvas = exportCanvas();
    if (!canvas) return e.preventDefault();
    e.dataTransfer.setData('DownloadURL', `image/png:${fileName()}:${canvas.toDataURL('image/png')}`);
    e.dataTransfer.effectAllowed = 'copy';
  });

  // Déposer une image sur l'aperçu = fond d'aperçu.
  const preview = $('#preview');
  preview.addEventListener('dragover', e => {
    if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault();
  });
  preview.addEventListener('drop', e => {
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    setPreviewImage(file);
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportPNG();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copyPNG();
    }
  });

  new ResizeObserver(scheduleRender).observe(preview);
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', scheduleRender);
}

function setPreviewImage(file) {
  if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
  previewImageUrl = URL.createObjectURL(file);
  setState({ previewBg: 'image' });
}

let toastTimer = 0;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

async function init() {
  buildSwatches();
  buildEmojiGrid();
  bindControls();
  syncControls();
  renderHistory();
  try {
    dirHandle = (await idb.get('dir')) || null;
  } catch {
    dirHandle = null;
  }
  updateFolderUI();
  await document.fonts.load(fontString(state.weight, 80), 'AaÉé’').catch(() => {});
  renderPreview();
  document.fonts.addEventListener('loadingdone', scheduleRender);
}

init();
