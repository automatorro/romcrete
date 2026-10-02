/**
 * Graficele din exportul Excel. exceljs nu poate scrie grafice native, așa că
 * le desenăm ca SVG și le rasterizăm cu sharp; foaia le primește cu addImage.
 *
 * Aceleași culori ca în `raport/charts.tsx`: albastrul mărcii pentru perioada
 * curentă, gri neutru pentru cea anterioară, chihlimbar doar ca al treilea
 * semn distinct.
 */
import { parse, type Font, type Path } from "opentype.js";
import sharp from "sharp";

import { FONT_BOLD_B64, FONT_REGULAR_B64 } from "./raport-font";

const BRAND = "#0033ab";
const NEUTRAL = "#8a8a8a";
const AMBER = "#b45309";
const INK = "#1a1a1a";
const MUTED = "#737373";
const GRID = "#e8e8e8";

export type Chart = { png: Buffer; width: number; height: number };

/**
 * Textul se desenează ca forme vectoriale (<path>), nu ca <text>: sharp randează
 * SVG cu fonturile sistemului, iar pe un server fără fonturi literele ies pătrățele.
 * Fontul e inclus în cod (raport-font.ts), deci rezultatul e același peste tot.
 */
let fonturi: { normal: Font; bold: Font } | null = null;

function font(bold: boolean): Font {
  if (!fonturi) {
    const incarca = (b64: string) => {
      const b = Buffer.from(b64, "base64");
      return parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    };
    fonturi = { normal: incarca(FONT_REGULAR_B64), bold: incarca(FONT_BOLD_B64) };
  }
  return bold ? fonturi.bold : fonturi.normal;
}

const lungime = (s: string, size: number, bold = false) => font(bold).getAdvanceWidth(s, size);

/**
 * Datele căii, scrise cu separatori expliciți. `toPathData` din opentype.js poate
 * lipi două numere („-37.09” + „0” → „-37.090”), iar parserul SVG citește altceva.
 */
function dePath(path: Path): string {
  const n = (v = 0) => String(Math.round(v * 100) / 100);
  return path.commands
    .map((c) => {
      if (c.type === "Z") return "Z";
      if (c.type === "Q") return `Q${n(c.x1)},${n(c.y1)} ${n(c.x)},${n(c.y)}`;
      if (c.type === "C") return `C${n(c.x1)},${n(c.y1)} ${n(c.x2)},${n(c.y2)} ${n(c.x)},${n(c.y)}`;
      return `${c.type}${n(c.x)},${n(c.y)}`;
    })
    .join("");
}

function text(
  x: number,
  y: number,
  s: string,
  o: { size: number; fill: string; bold?: boolean; anchor?: "start" | "middle" | "end"; rotate?: number },
): string {
  const f = font(!!o.bold);
  const w = f.getAdvanceWidth(s, o.size);
  const dx = o.anchor === "middle" ? -w / 2 : o.anchor === "end" ? -w : 0;
  const d = dePath(f.getPath(s, dx, 0, o.size));
  const tr = `translate(${x} ${y})${o.rotate ? ` rotate(${o.rotate})` : ""}`;
  return `<path transform="${tr}" d="${d}" fill="${o.fill}"/>`;
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const nr = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "");

/** Scară „frumoasă” pentru axa valorilor: 0 … max, în pași de 1/2/5 × 10^k. */
function scala(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const brut = max / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const f = brut / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  return { top: Math.ceil(max / step) * step, step };
}

async function rasterizeaza(svg: string, width: number, height: number): Promise<Chart> {
  // Densitate dublă: imaginea rămâne clară și când foaia e mărită.
  const png = await sharp(Buffer.from(svg), { density: 192 }).png().toBuffer();
  return { png, width, height };
}

function cadru(width: number, height: number, titlu: string, corp: string, legenda: [string, string][]) {
  const leg = legenda
    .map(([nume, culoare], i) => {
      const x = 16 + legenda.slice(0, i).reduce((n, [t]) => n + lungime(t, 12) + 34, 0);
      return `<rect x="${x}" y="40" width="12" height="12" rx="2" fill="${culoare}"/>` +
        text(x + 18, 50, nume, { size: 12, fill: INK });
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#fff"/>` +
    text(16, 26, titlu, { size: 15, fill: INK, bold: true }) +
    leg +
    corp +
    `</svg>`
  );
}

/** Bare grupate pe categorii verticale: câte o bară pe serie. Pentru Sumar. */
export async function barePeCategorii(
  titlu: string,
  categorii: string[],
  serii: { nume: string; valori: number[]; culoare?: string }[],
): Promise<Chart> {
  const W = 620, H = 340;
  const L = 48, R = 16, T = 66, B = 64;
  const w = W - L - R, h = H - T - B;
  const culori = [BRAND, NEUTRAL, AMBER];
  const max = Math.max(0, ...serii.flatMap((s) => s.valori));
  const { top, step } = scala(max);

  let corp = "";
  for (let v = 0; v <= top + 1e-9; v += step) {
    const y = T + h - (v / top) * h;
    corp += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${GRID}"/>` +
      text(L - 6, y + 4, nr(v), { size: 11, fill: MUTED, anchor: "end" });
  }

  const gW = w / Math.max(1, categorii.length);
  const bW = Math.min(34, (gW * 0.7) / serii.length);
  categorii.forEach((cat, ci) => {
    const x0 = L + ci * gW + (gW - bW * serii.length) / 2;
    serii.forEach((s, si) => {
      const v = s.valori[ci] ?? 0;
      const bh = (v / top) * h;
      const x = x0 + si * bW;
      corp += `<rect x="${x}" y="${T + h - bh}" width="${bW - 2}" height="${bh}" fill="${s.culoare ?? culori[si % 3]}"/>` +
        text(x + (bW - 2) / 2, T + h - bh - 4, nr(v), { size: 11, fill: INK, anchor: "middle" });
    });
    corp += text(L + ci * gW + gW / 2, T + h + 18, trunc(cat, 16), { size: 11, fill: INK, anchor: "middle" });
  });

  const svg = cadru(W, H, titlu, corp, serii.map((s, i) => [s.nume, s.culoare ?? culori[i % 3]]));
  return rasterizeaza(svg, W, H);
}

/** Linii pe o axă a timpului: o linie pe serie. Pentru Evoluție. */
export async function linii(
  titlu: string,
  etichete: string[],
  serii: { nume: string; valori: number[] }[],
): Promise<Chart> {
  const W = 760, H = 340;
  // Etichetele înclinate se întind spre stânga de primul punct: margine mai mare.
  const L = 90, R = 24, T = 66, B = 64;
  const w = W - L - R, h = H - T - B;
  const culori = [BRAND, AMBER, NEUTRAL];
  const max = Math.max(0, ...serii.flatMap((s) => s.valori));
  const { top, step } = scala(max);

  let corp = "";
  for (let v = 0; v <= top + 1e-9; v += step) {
    const y = T + h - (v / top) * h;
    corp += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${GRID}"/>` +
      text(L - 6, y + 4, nr(v), { size: 11, fill: MUTED, anchor: "end" });
  }

  const n = etichete.length;
  const px = (i: number) => (n === 1 ? L + w / 2 : L + (i / (n - 1)) * w);
  const py = (v: number) => T + h - (v / top) * h;

  // Maxim ~10 etichete pe axă, ca să nu se calce între ele.
  const salt = Math.max(1, Math.ceil(n / 10));
  etichete.forEach((e, i) => {
    if (i % salt !== 0 && i !== n - 1) return;
    corp += text(px(i), T + h + 18, trunc(e, 14), { size: 10, fill: INK, anchor: "end", rotate: -30 });
  });

  serii.forEach((s, si) => {
    const c = culori[si % 3];
    const pts = s.valori.map((v, i) => `${px(i)},${py(v)}`).join(" ");
    corp += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`;
    s.valori.forEach((v, i) => {
      corp += `<circle cx="${px(i)}" cy="${py(v)}" r="3.5" fill="${c}"/>`;
    });
    // Valoarea apare doar pe prima serie și doar când nu aglomerează.
    if (si === 0 && n <= 16) {
      s.valori.forEach((v, i) => {
        corp += text(px(i), py(v) - 8, nr(v), { size: 10, fill: INK, anchor: "middle" });
      });
    }
  });

  const svg = cadru(W, H, titlu, corp, serii.map((s, i) => [s.nume, culori[i % 3]]));
  return rasterizeaza(svg, W, H);
}

/** Bare orizontale, o singură serie, ordonate descrescător. Pentru Pe agent. */
export async function bareOrizontale(
  titlu: string,
  randuri: [string, number][],
  nume: string,
): Promise<Chart> {
  const sortate = [...randuri].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const rowH = 26;
  const W = 620;
  const L = 210, R = 48, T = 66;
  const H = T + sortate.length * rowH + 16;
  const max = Math.max(1, ...sortate.map((r) => r[1]));

  let corp = "";
  sortate.forEach(([eticheta, v], i) => {
    const y = T + i * rowH;
    const bw = (v / max) * (W - L - R);
    corp += text(L - 8, y + 14, trunc(eticheta, 30), { size: 12, fill: INK, anchor: "end" }) +
      `<rect x="${L}" y="${y + 2}" width="${Math.max(2, bw)}" height="16" fill="${BRAND}"/>` +
      text(L + Math.max(2, bw) + 6, y + 14, nr(v), { size: 12, fill: INK });
  });

  const svg = cadru(W, H, titlu, corp, [[nume, BRAND]]);
  return rasterizeaza(svg, W, H);
}
