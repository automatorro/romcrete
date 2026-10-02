/**
 * Graficele din exportul Excel. exceljs nu poate scrie grafice native, așa că
 * le desenăm ca SVG și le rasterizăm cu sharp; foaia le primește cu addImage.
 *
 * Aceleași culori ca în `raport/charts.tsx`: albastrul mărcii pentru perioada
 * curentă, gri neutru pentru cea anterioară, chihlimbar doar ca al treilea
 * semn distinct.
 */
import sharp from "sharp";

const BRAND = "#0033ab";
const NEUTRAL = "#8a8a8a";
const AMBER = "#b45309";
const INK = "#1a1a1a";
const MUTED = "#737373";
const GRID = "#e8e8e8";
const FONT = "DejaVu Sans, Arial, Helvetica, sans-serif";

export type Chart = { png: Buffer; width: number; height: number };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
      const x = 16 + legenda.slice(0, i).reduce((n, [t]) => n + t.length * 7 + 34, 0);
      return `<rect x="${x}" y="40" width="12" height="12" rx="2" fill="${culoare}"/>` +
        `<text x="${x + 18}" y="50" font-size="12" fill="${INK}">${esc(nume)}</text>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">` +
    `<rect width="${width}" height="${height}" fill="#fff"/>` +
    `<text x="16" y="26" font-size="15" font-weight="bold" fill="${INK}">${esc(titlu)}</text>` +
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
      `<text x="${L - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${nr(v)}</text>`;
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
        `<text x="${x + (bW - 2) / 2}" y="${T + h - bh - 4}" font-size="11" text-anchor="middle" fill="${INK}">${nr(v)}</text>`;
    });
    corp += `<text x="${L + ci * gW + gW / 2}" y="${T + h + 18}" font-size="11" text-anchor="middle" fill="${INK}">${esc(trunc(cat, 16))}</text>`;
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
      `<text x="${L - 6}" y="${y + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${nr(v)}</text>`;
  }

  const n = etichete.length;
  const px = (i: number) => (n === 1 ? L + w / 2 : L + (i / (n - 1)) * w);
  const py = (v: number) => T + h - (v / top) * h;

  // Maxim ~10 etichete pe axă, ca să nu se calce între ele.
  const salt = Math.max(1, Math.ceil(n / 10));
  etichete.forEach((e, i) => {
    if (i % salt !== 0 && i !== n - 1) return;
    corp += `<text x="${px(i)}" y="${T + h + 18}" font-size="10" text-anchor="end" fill="${INK}" transform="rotate(-30 ${px(i)} ${T + h + 18})">${esc(trunc(e, 14))}</text>`;
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
        corp += `<text x="${px(i)}" y="${py(v) - 8}" font-size="10" text-anchor="middle" fill="${INK}">${nr(v)}</text>`;
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
    corp += `<text x="${L - 8}" y="${y + 14}" font-size="12" text-anchor="end" fill="${INK}">${esc(trunc(eticheta, 30))}</text>` +
      `<rect x="${L}" y="${y + 2}" width="${Math.max(2, bw)}" height="16" fill="${BRAND}"/>` +
      `<text x="${L + Math.max(2, bw) + 6}" y="${y + 14}" font-size="12" fill="${INK}">${nr(v)}</text>`;
  });

  const svg = cadru(W, H, titlu, corp, [[nume, BRAND]]);
  return rasterizeaza(svg, W, H);
}
