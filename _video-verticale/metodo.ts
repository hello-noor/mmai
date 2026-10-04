// IL METODO, in cinque passi. Verticale 1080x1920, 30 s, 30 fps, muto.
// Explainer disegnato a pennarello su carta: ogni segno viene tracciato, mai sfumato in entrata.
// Il tratto "ribolle" (il jitter cambia ogni 4 fotogrammi) cosi' qualcosa si muove sempre.
// Puro in (frame, env): nessun orologio, solo rng(seed). Palette e testi dal sito (landing MMAI).
import { Ctx, Env, P, rng, probeRect } from "./core";
import { Film, Shot } from "./film";

const FPS = 30, BPM = 60, DURATION = 900; // beat = 30 frame
const PAPER = "#EEF0EB", INK = "#16202E", COB = "#2B45D8", SOFT = "#9DA9F5", GRAPH = "#566070", RULE = "#C6CBC2";
const SERIF = (px: number, it = false) => `${it ? "italic " : ""}400 ${px}px "Charter","Bitstream Charter","Georgia","Liberation Serif",serif`;
const SANS = (px: number) => `600 ${px}px "Helvetica Neue","Liberation Sans",Arial,sans-serif`;

const LOGO = "M 221.81 791.99 C186.04,789.70 157.46,782.50 130.50,768.98 C111.93,759.67 100.12,751.13 84.93,736.01 C71.20,722.34 64.61,713.99 55.03,698.07 C26.56,650.81 8.60,574.81 1.85,473.00 C-0.00,445.18 0.30,369.89 2.37,340.00 C10.76,219.27 29.23,150.40 67.05,98.93 C75.45,87.51 97.39,65.97 109.00,57.75 C120.74,49.44 141.08,39.20 155.00,34.58 C180.62,26.07 214.85,21.52 247.50,22.29 C277.58,23.00 299.27,26.84 322.74,35.61 C340.42,42.21 362.83,54.76 373.20,63.87 L 376.85 67.08 L 381.65 61.94 C391.78,51.11 409.44,39.52 426.71,32.36 C463.85,16.96 509.39,6.54 560.00,1.86 C580.30,-0.01 630.81,0.26 651.79,2.35 C708.20,7.99 755.39,21.43 782.78,39.66 C793.08,46.51 809.02,61.61 816.61,71.69 C840.77,103.78 854.15,146.88 858.95,208.00 C859.53,215.43 860.29,224.88 860.64,229.00 L 861.27 236.50 L 863.50 224.50 C883.39,117.14 938.43,49.16 1022.04,28.64 C1039.04,24.47 1051.30,22.93 1072.61,22.31 C1109.18,21.24 1145.54,26.45 1173.00,36.71 C1243.34,62.97 1288.55,128.42 1306.84,230.50 C1330.28,361.25 1326.11,522.51 1296.62,626.00 C1278.34,690.16 1252.67,729.82 1211.50,757.49 C1176.70,780.88 1134.98,792.12 1082.50,792.24 C1071.50,792.26 1057.78,791.74 1052.00,791.07 C979.64,782.68 925.83,746.59 895.55,686.12 C872.16,639.40 856.81,574.49 850.48,495.50 C848.44,470.02 846.90,417.93 847.66,400.00 C848.00,392.02 848.05,385.73 847.77,386.00 C847.49,386.27 846.00,391.00 844.47,396.50 C833.64,435.25 814.36,469.11 793.16,486.60 C785.29,493.09 772.41,499.88 761.50,503.30 C710.13,519.36 638.68,496.90 557.75,439.25 C531.46,420.52 504.11,397.88 484.97,379.00 L 474.32 368.50 L 474.35 413.50 C474.39,494.84 467.46,558.94 452.47,615.75 C433.60,687.30 406.38,730.51 361.78,759.74 C325.02,783.83 274.86,795.39 221.81,791.99 Z";

// ------------------------------------------------------------------ tempo
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const sn = (f: number, a: number, b: number) => ease(seg(f, a, b));

// ------------------------------------------------------------------ segni
type Theme = { bg: string; fg: string; mute: string; line: string; acc: string; on: string };
const LIGHT: Theme = { bg: PAPER, fg: INK, mute: GRAPH, line: INK, acc: COB, on: "#fff" };
const DARK: Theme = { bg: INK, fg: "#fff", mute: "#C6CBC2", line: "#E6E9E2", acc: SOFT, on: "#fff" };

const resample = (pts: P[], step: number): P[] => {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
};
// un tratto di pennarello: ricampionato, scosso (boil) e tracciato per la frazione p della sua lunghezza
const ink = (ctx: Ctx, f: number, pts: P[], p: number, color: string, w: number, seed: number, dash?: number[]) => {
  if (p <= 0) return;
  const r = rng(seed * 977 + Math.floor(f / 4) * 31 + 7), s = resample(pts, 16).map(([x, y], i) => [x + (r() - 0.5) * 2.6 + 1.1 * Math.sin(f * 0.45 + i * 1.7), y + (r() - 0.5) * 2.6 + 1.1 * Math.cos(f * 0.4 + i * 1.3)] as P);
  const L = [0]; for (let i = 1; i < s.length; i++) L.push(L[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const goal = L[L.length - 1] * Math.min(1, p);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
  for (let i = 1; i < s.length; i++) {
    if (L[i] <= goal) ctx.lineTo(s[i][0], s[i][1]);
    else { const t = (goal - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t); break; }
  }
  ctx.stroke(); ctx.restore();
};
const rrPts = (x: number, y: number, w: number, h: number, rad: number): P[] => {
  const o: P[] = [], arc = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); o.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
  arc(x + w - rad, y + rad, -Math.PI / 2); arc(x + w - rad, y + h - rad, 0); arc(x + rad, y + h - rad, Math.PI / 2); arc(x + rad, y + rad, Math.PI);
  o.push(o[0]); return o;
};
const ellPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 48): P[] => {
  const o: P[] = []; for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o;
};
// riempimento a rullo: da sinistra a destra
const wipeFill = (ctx: Ctx, x: number, y: number, w: number, h: number, rad: number, color: string, p: number, alpha = 1) => {
  if (p <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x - 2, y - 2, w * clamp(p) + 4, h + 4); ctx.clip();
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill(); ctx.restore();
};
type TxtOpt = { font: string; color: string; align?: CanvasTextAlign; p?: number; size: number };
const txt = (ctx: Ctx, s: string, x: number, y: number, o: TxtOpt) => {
  const p = o.p ?? 1; if (p <= 0) return;
  ctx.save(); ctx.font = o.font; ctx.textBaseline = "alphabetic"; const w = ctx.measureText(s).width, al = o.align ?? "left", l = al === "center" ? x - w / 2 : al === "right" ? x - w : x;
  ctx.beginPath(); ctx.rect(l - 6, y - o.size * 1.1, w * clamp(p) + 12, o.size * 1.5); ctx.clip();
  ctx.fillStyle = o.color; ctx.textAlign = "left"; ctx.fillText(s, l, y + (1 - ease(p)) * 6); ctx.restore();
};
const fitSerif = (ctx: Ctx, s: string, base: number, maxW: number, it = false) => { ctx.save(); ctx.font = SERIF(base, it); const w = ctx.measureText(s).width; ctx.restore(); return Math.min(base, (base * maxW) / w); };
const head = (ctx: Ctx, f: number, x: number, y: number, ang: number, color: string, p: number, size = 30) => {
  if (p < 0.92) return;
  for (const d of [-0.5, 0.5]) ink(ctx, f, [[x, y], [x - Math.cos(ang + d) * size, y - Math.sin(ang + d) * size]], 1, color, 8, Math.round(x + y));
};
const arrowV = (ctx: Ctx, f: number, x: number, y0: number, y1: number, p: number, color: string, seed: number) => { ink(ctx, f, [[x, y0], [x, y1]], p, color, 8, seed); head(ctx, f, x, y1, Math.PI / 2, color, p); };
const check = (ctx: Ctx, f: number, x: number, y: number, p: number, color: string, w = 10) => ink(ctx, f, [[x, y], [x + 16, y + 20], [x + 50, y - 28]], p, color, w, 91);

// ------------------------------------------------------------------ cornice comune dei passi
const STEPS = [
  { n: "1", t: "Ascolto", c: ["Dove si inceppa il lavoro,", "chi è coinvolto, cosa vorresti cambiare."] },
  { n: "2", t: "Guardo", c: ["Ti affianco sulle attività vere:", "dove si perde tempo, cosa sembra normale."] },
  { n: "3", t: "Scelgo", c: ["Prima il problema, poi lo strumento.", "Niente pacchetti uguali per tutti."] },
  { n: "4", t: "Lo facciamo insieme", c: ["Proviamo, correggiamo sui tuoi feedback,", "scriviamo le istruzioni."] },
  { n: "5", t: "Misuro", c: ["A uno e a tre mesi verifico", "il tempo recuperato."] },
];
const frame = (ctx: Ctx, f: number, i: number, th: Theme, probe: (x: number, y: number, w: number, h: number, l: string) => void) => {
  const s = STEPS[i];
  txt(ctx, s.n, 90, 410, { font: SERIF(330), color: th.acc, size: 330, p: sn(f, 0, 20) });
  const ts = fitSerif(ctx, s.t, 150, 900);
  txt(ctx, s.t, 90, 585, { font: SERIF(ts), color: th.fg, size: ts, p: sn(f, 8, 30) });
  txt(ctx, s.c[0], 90, 662, { font: SANS(40), color: th.mute, size: 40, p: sn(f, 22, 44) });
  txt(ctx, s.c[1], 90, 718, { font: SANS(40), color: th.mute, size: 40, p: sn(f, 30, 52) });
  probe(90, 160, 900, 580, "header");
  for (let k = 0; k < 5; k++) { // avanzamento
    const x = 540 + (k - 2) * 64, cur = k === i, done = k < i;
    ctx.beginPath(); ctx.arc(x, 1650, cur ? 15 : 10, 0, Math.PI * 2);
    if (cur || done) { ctx.fillStyle = cur ? th.acc : th.mute; ctx.fill(); } else { ctx.strokeStyle = th.mute; ctx.lineWidth = 4; ctx.stroke(); }
  }
};

// ------------------------------------------------------------------ illustrazioni
const ill1 = (ctx: Ctx, f: number, th: Theme) => {
  const bub = (y: number, w: number, x: number, s: number, label: string, fill: boolean, seed: number, tailLeft: boolean) => {
    ink(ctx, f, rrPts(x, y, w, 120, 46), seg(f, s, s + 18), fill ? th.acc : th.line, 7, seed);
    wipeFill(ctx, x, y, w, 120, 46, th.acc, seg(f, s + 6, s + 26), fill ? 1 : 0);
    const tx = tailLeft ? x + 60 : x + w - 60, d = tailLeft ? 1 : -1;
    ink(ctx, f, [[tx, y + 120], [tx + 14 * d, y + 160], [tx + 54 * d, y + 120]], seg(f, s + 14, s + 24), fill ? th.acc : th.line, 7, seed + 1);
    txt(ctx, label, x + w / 2, y + 76, { font: SANS(42), color: fill ? th.on : th.fg, align: "center", size: 42, p: seg(f, s + 12, s + 34) });
  };
  bub(830, 610, 90, 38, "Dove si inceppa?", false, 11, true);
  bub(1010, 640, 350, 62, "Chi è coinvolto?", true, 12, false);
  bub(1190, 800, 90, 86, "Cosa vorresti cambiare?", false, 13, true);
  // ascolto: una forma d'onda che cresce e non smette
  const amp = sn(f, 30, 80);
  for (let k = 0; k < 28; k++) {
    const x = 105 + k * 32.5, a = (0.35 + 0.65 * Math.abs(Math.sin(k * 1.9))) * (0.55 + 0.45 * Math.sin(f * 0.2 + k * 0.7)), h = 12 + 92 * amp * a;
    ink(ctx, f, [[x, 1470 - h], [x, 1470 + h]], 1, th.acc, 14, 200 + k);
  }
};

const ill2 = (ctx: Ctx, f: number, th: Theme) => {
  const L = ["Richiesta", "Controllo", "Copia e incolla", "Invio"], Y = [830, 990, 1150, 1310], hl = sn(f, 104, 118);
  L.forEach((s, k) => {
    const st = 38 + k * 12, hot = k === 2;
    wipeFill(ctx, 90, Y[k], 600, 110, 22, SOFT, hot ? seg(f, 104, 120) : 0, 0.4);
    ink(ctx, f, rrPts(90, Y[k], 600, 110, 22), seg(f, st, st + 14), hot && hl > 0 ? th.acc : th.line, hot && hl > 0 ? 10 : 7, 20 + k);
    txt(ctx, s, 390, Y[k] + 70, { font: SANS(42), color: th.fg, align: "center", size: 42, p: seg(f, st + 8, st + 24) });
    if (k < 3) arrowV(ctx, f, 390, Y[k] + 112, Y[k + 1] - 4, seg(f, st + 14, st + 24), th.mute, 30 + k);
  });
  // la lente passa sul lavoro vero e si ferma sul copia-incolla
  const m = seg(f, 66, 74), mv = sn(f, 76, 106), cy = 885 + (1205 - 885) * mv + (f > 106 ? Math.sin(f * 0.2) * 7 : 0), cx = 500 + (f > 106 ? Math.cos(f * 0.17) * 6 : 0);
  if (m > 0) {
    ink(ctx, f, ellPts(cx, cy, 64, 64, -90, 270), m, th.acc, 11, 40);
    ink(ctx, f, [[cx + 46, cy + 46], [cx + 104, cy + 104]], seg(f, 70, 78), th.acc, 17, 41);
  }
  txt(ctx, "ogni", 740, 1190, { font: SERIF(58, true), color: th.acc, size: 58, p: seg(f, 110, 126) });
  txt(ctx, "lunedì", 740, 1252, { font: SERIF(58, true), color: th.acc, size: 58, p: seg(f, 118, 134) });
};

const ill3 = (ctx: Ctx, f: number, th: Theme) => {
  ink(ctx, f, rrPts(90, 830, 900, 180, 30), seg(f, 36, 52), th.acc, 8, 50);
  wipeFill(ctx, 90, 830, 900, 180, 30, COB, seg(f, 42, 66));
  txt(ctx, "Il problema", 540, 940, { font: SERIF(84), color: th.on, align: "center", size: 84, p: seg(f, 56, 78) });
  arrowV(ctx, f, 540, 1020, 1296, seg(f, 70, 96), th.acc, 51);
  const bad = (x: number, y: number, s: string, st: number, seed: number) => {
    ink(ctx, f, rrPts(x, y, 410, 110, 22), seg(f, st, st + 14), th.mute, 6, seed, [14, 12]);
    txt(ctx, s, x + 205, y + 68, { font: SANS(36), color: th.mute, align: "center", size: 36, p: seg(f, st + 8, st + 22) });
    ink(ctx, f, [[x + 20, y + 62], [x + 390, y + 52]], seg(f, st + 28, st + 42), th.acc, 8, seed + 5);
  };
  bad(90, 1120, "L'ultimo modello", 78, 52);
  bad(580, 1120, "L'app del momento", 86, 54);
  ink(ctx, f, rrPts(90, 1300, 900, 130, 26), seg(f, 100, 116), th.line, 9, 56);
  wipeFill(ctx, 90, 1300, 900, 130, 26, COB, seg(f, 112, 132));
  txt(ctx, "Lo strumento giusto", 570, 1382, { font: SANS(48), color: th.on, align: "center", size: 48, p: seg(f, 120, 140) });
  check(ctx, f, 130, 1370, seg(f, 132, 146), th.on, 11);
};

const ill4 = (ctx: Ctx, f: number, th: Theme) => {
  const cx = 540, cy = 1150, rx = 330, ry = 210, A = [-90, 30, 150], names = ["Proviamo", "Correggiamo", "Istruzioni"], pt = (a: number): P => [cx + Math.cos((a * Math.PI) / 180) * rx, cy + Math.sin((a * Math.PI) / 180) * ry];
  A.forEach((a, k) => {
    const [x, y] = pt(a), st = 38 + k * 14;
    ink(ctx, f, rrPts(x - 165, y - 52, 330, 104, 30), seg(f, st, st + 16), th.line, 7, 60 + k);
    txt(ctx, names[k], x, y + 14, { font: SANS(40), color: th.fg, align: "center", size: 40, p: seg(f, st + 8, st + 26) });
    const s = st + 20, a0 = a + 38, a1 = A[(k + 1) % 3] + (k === 2 ? 360 : 0) - 38, p = seg(f, s, s + 18), e = pt(a1);
    ink(ctx, f, ellPts(cx, cy, rx, ry, a0, a1, 14), p, th.acc, 8, 70 + k);
    head(ctx, f, e[0], e[1], ((a1 + 90) * Math.PI) / 180 + 0.15, th.acc, p);
  });
  txt(ctx, "finché regge", cx, cy + 14, { font: SERIF(60, true), color: th.acc, align: "center", size: 60, p: seg(f, 90, 110) });
  const d = seg(f, 82, 86), da = -90 + (f - 82) * 6.5, [dx, dy] = pt(da);
  if (d > 0) { ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(dx, dy, 16, 0, Math.PI * 2); ctx.fill(); }
  ink(ctx, f, rrPts(90, 1470, 900, 104, 52), seg(f, 108, 120), th.acc, 8, 80);
  wipeFill(ctx, 90, 1470, 900, 104, 52, th.acc, seg(f, 112, 130));
  check(ctx, f, 150, 1526, seg(f, 126, 138), th.on, 9);
  txt(ctx, "Funziona anche senza di me", 600, 1537, { font: SANS(40), color: th.on, align: "center", size: 40, p: seg(f, 124, 146) });
};

const ill5 = (ctx: Ctx, f: number, th: Theme) => {
  const R = [{ l: "Oggi", w: 900, c: th.fg }, { l: "Dopo 1 mese", w: 680, c: th.acc }, { l: "Dopo 3 mesi", w: 440, c: th.acc }];
  R.forEach((r, k) => {
    const y = 880 + k * 160, s = 36 + k * 20;
    txt(ctx, r.l, 90, y, { font: SANS(38), color: th.mute, size: 38, p: seg(f, s, s + 14) });
    const w = r.w * ease(seg(f, s + 6, s + 32));
    if (w > 2) { ctx.fillStyle = r.c; ctx.beginPath(); ctx.roundRect(90, y + 24, w, 64, 12); ctx.fill(); }
  });
  ink(ctx, f, rrPts(530, 1224, 460, 64, 12), seg(f, 104, 124), th.acc, 6, 90, [14, 12]);
  txt(ctx, "tempo recuperato", 760, 1268, { font: SANS(32), color: th.acc, align: "center", size: 32, p: seg(f, 114, 134) });
  txt(ctx, "Esempio illustrativo: i numeri veri", 90, 1420, { font: SANS(34), color: th.mute, size: 34, p: seg(f, 120, 138) });
  txt(ctx, "li misuriamo sul tuo lavoro.", 90, 1468, { font: SANS(34), color: th.mute, size: 34, p: seg(f, 126, 144) });
};
const ILL = [ill1, ill2, ill3, ill4, ill5];

// ------------------------------------------------------------------ shot
const setup = (ctx: Ctx, env: Env, bg: string) => { const s = env.scale; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.fillStyle = bg; ctx.fillRect(0, 0, env.W, env.H); };
const probeOf = (ctx: Ctx, env: Env) => (x: number, y: number, w: number, h: number, l: string) => probeRect(ctx, env, x, y, w, h, l, "text");

const intro: Shot["draw"] = (ctx, f, env) => {
  setup(ctx, env, PAPER);
  const lp = sn(f, 0, 20); ctx.save(); ctx.translate(90, 150); const k = 90 / 793; ctx.scale(k, k); ctx.fillStyle = COB; ctx.globalAlpha = lp; ctx.fill(new Path2D(LOGO)); ctx.restore();
  txt(ctx, "Il metodo", 90, 760, { font: SERIF(230), color: INK, size: 230, p: sn(f, 8, 34) });
  ink(ctx, f, [[96, 812], [360, 800], [640, 818], [880, 802]], sn(f, 30, 52), COB, 14, 3);
  txt(ctx, "in cinque passi.", 90, 930, { font: SERIF(96, true), color: COB, size: 96, p: sn(f, 42, 66) });
  const xs = [0, 1, 2, 3, 4].map((i) => 130 + i * 205);
  ink(ctx, f, xs.map((x) => [x, 1180] as P), sn(f, 56, 84), RULE, 8, 4);
  xs.forEach((x, i) => { const p = sn(f, 58 + i * 5, 70 + i * 5); if (p > 0) { ctx.fillStyle = COB; ctx.beginPath(); ctx.arc(x, 1180, 22 * p, 0, Math.PI * 2); ctx.fill(); } });
  const names = ["Ascolto", "Guardo", "Scelgo", "Insieme", "Misuro"];
  xs.forEach((x, i) => txt(ctx, names[i], x, 1260, { font: SANS(25), color: GRAPH, align: "center", size: 25, p: seg(f, 64 + i * 4, 80 + i * 4) }));
  probeRect(ctx, env, 90, 520, 900, 420, "title", "text");
};
const stepShot = (i: number, th: Theme): Shot["draw"] => (ctx, f, env) => {
  setup(ctx, env, th.bg);
  frame(ctx, f, i, th, probeOf(ctx, env));
  ILL[i](ctx, f, th);
  probeRect(ctx, env, 90, 800, 900, 800, "ill");
};
const outro: Shot["draw"] = (ctx, f, env) => {
  setup(ctx, env, COB);
  txt(ctx, "Prima capisco.", 540, 800, { font: SERIF(150), color: "#fff", align: "center", size: 150, p: sn(f, 0, 24) });
  txt(ctx, "Poi ti affianco.", 540, 990, { font: SERIF(150, true), color: SOFT, align: "center", size: 150, p: sn(f, 14, 38) });
  ink(ctx, f, [[250, 1060], [440, 1050], [640, 1064], [830, 1052]], sn(f, 34, 52), "#fff", 10, 5);
  ctx.save(); const lp = sn(f, 28, 48), k = 100 / 793; ctx.globalAlpha = lp; ctx.translate(540 - (1322 * k) / 2, 1230); ctx.scale(k, k); ctx.fillStyle = "#fff"; ctx.fill(new Path2D(LOGO)); ctx.restore();
  probeRect(ctx, env, 90, 640, 900, 440, "payoff", "text");
};

const shots: Shot[] = [
  { id: "intro", start: 0, end: 90, draw: intro },
  ...STEPS.map((s, i) => ({ id: `passo${s.n}`, start: 90 + i * 150, end: 240 + i * 150, draw: stepShot(i, i === 2 ? DARK : LIGHT) })),
  { id: "chiusura", start: 840, end: 900, draw: outro },
];

export const metodo: Film = {
  meta: {
    title: "Il metodo", W: 1080, H: 1920, fps: FPS, bpm: BPM, durationFrames: DURATION, kind: "drawing",
    holds: [[870, 900, "end card: la promessa resta letta"]],
    captions: [
      { from: 0, to: 90, text: "Il metodo, in cinque passi." },
      ...STEPS.map((s, i) => ({ from: 90 + i * 150, to: 240 + i * 150, text: `${s.n}. ${s.t}. ${s.c.join(" ")}` })),
      { from: 840, to: 900, text: "Prima capisco. Poi ti affianco." },
    ],
    poster: 120,
  },
  assets: { images: {} },
  shots,
};
