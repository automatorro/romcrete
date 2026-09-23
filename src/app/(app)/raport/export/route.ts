import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
import { buildActivity, type Granularity, type Metrics } from "@/lib/activitate";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";

// exceljs are nevoie de Node, nu de runtime-ul edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "FF1A1A1A";
const BRAND = "FF0033AB";
const SOFT = "FFF2F5FB";
const LINE = "FFE8E8E8";

const FOCUS: Record<string, string> = {
  urmareste: "Urmărește acum",
  deblocheaza: "Deblochează",
  educa: "Educă",
  lasa: "Lasă",
  necunoscut: "Date insuficiente",
};

const FEZ: Record<string, string> = {
  da: "Da",
  blocaj: "Are un blocaj",
  nu: "Nu poate acum",
  "?": "Nu se știe",
};

const BANI = '#,##0.00 "lei"';
const DATA = "dd.mm.yyyy";

type Col = { header: string; key: string; width: number; format?: string };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 28;

  cols.forEach((c, i) => {
    if (c.format) ws.getColumn(i + 1).numFmt = c.format;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

/** Rândurile de date primesc linii subțiri, ca tabelul să rămână citibil tipărit. */
function finish(ws: ExcelJS.Worksheet) {
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      if (!cell.font?.bold) cell.font = { color: { argb: INK }, size: 11 };
    });
  });
}

const PROCENT = (parte: number, intreg: number) => (intreg ? parte / intreg : 0);

/** Indicatorii, în ordinea în care se citesc într-o ședință: activitate, calitate, rezultat. */
const INDICATORI: { label: string; get: (m: Metrics) => number | null; format?: string }[] = [
  { label: "Vizite", get: (m) => m.vizite },
  { label: "Firme vizitate", get: (m) => m.firmeVizitate },
  { label: "Firme noi", get: (m) => m.firmeNoi },
  { label: "Prime vizite", get: (m) => m.primeVizite },
  { label: "Revizite", get: (m) => m.revizite },
  { label: "Zile lucrătoare", get: (m) => m.zileLucratoare },
  { label: "Vizite / zi lucrătoare", get: (m) => m.vizitePeZi, format: "0.00" },
  { label: "Vizite cu pas următor stabilit", get: (m) => m.cuPasUrmator },
  { label: "Pondere vizite cu pas următor", get: (m) => PROCENT(m.cuPasUrmator, m.vizite), format: "0%" },
  { label: "Pași restanți", get: (m) => m.pasiRestanti },
  { label: "Vizite cu calificare completă", get: (m) => m.calificareCompleta },
  { label: "Pondere calificare completă", get: (m) => PROCENT(m.calificareCompleta, m.vizite), format: "0%" },
  { label: "Vizite cu calcul de amortizare", get: (m) => m.cuCalculAmortizare },
  { label: "Pondere cu calcul de amortizare", get: (m) => PROCENT(m.cuCalculAmortizare, m.vizite), format: "0%" },
  { label: "Modele discutate", get: (m) => m.modeleDiscutate },
  { label: "Întrebări tehnice pentru owner", get: (m) => m.intrebariOwner },
  { label: "Oferte emise", get: (m) => m.oferteEmise },
  { label: "Oferte pornite din vizită", get: (m) => m.oferteDinVizite },
  { label: "Valoare oferte (cu TVA)", get: (m) => m.valoareOferte, format: BANI },
  { label: "Oferte acceptate", get: (m) => m.oferteAcceptate },
  { label: "Valoare acceptată (cu TVA)", get: (m) => m.valoareAcceptata, format: BANI },
  { label: "Rată de câștig", get: (m) => PROCENT(m.oferteAcceptate, m.oferteEmise), format: "0%" },
  { label: "Vizite pentru o ofertă", get: (m) => (m.oferteDinVizite ? Math.round((m.vizite / m.oferteDinVizite) * 10) / 10 : null), format: "0.0" },
  { label: "Zile de la vizită la ofertă", get: (m) => m.zileVizitaOferta, format: "0.0" },
];

export async function GET(request: NextRequest) {
  const { orgId, organization } = await requireOrg();
  const sp = request.nextUrl.searchParams;

  const azi = new Date().toISOString().slice(0, 10);
  const per = sp.get("per") ?? "30";
  const zileInapoi = per === "7" ? 6 : per === "90" ? 89 : per === "all" ? 3650 : 29;
  const from = sp.get("from") ?? new Date(Date.now() - zileInapoi * 86400000).toISOString().slice(0, 10);
  const to = sp.get("to") ?? azi;

  const granRaw = sp.get("gran");
  const gran: Granularity =
    granRaw === "zi" || granRaw === "saptamana" || granRaw === "luna" ? granRaw : "saptamana";
  const agent = sp.get("ag");

  const [data, sections] = await Promise.all([
    buildActivity(orgId, from, to, gran, agent),
    getQuestionCatalogue(orgId),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = organization.name;
  wb.created = new Date();

  // ---------------------------------------------------------------- Sumar
  const sumar = sheet(wb, "Sumar", [
    { header: "Indicator", key: "i", width: 34 },
    { header: "Perioada curentă", key: "c", width: 18 },
    { header: "Perioada anterioară", key: "p", width: 18 },
    { header: "Diferență", key: "d", width: 14 },
  ]);

  sumar.addRow({ i: `${organization.name} — activitate comercială` }).font = { bold: true, size: 13 };
  sumar.addRow({
    i: `${from} → ${to}${agent ? ` · ${data.members.find((m) => m.user_id === agent)?.full_name ?? "agent"}` : " · toți agenții"}`,
  }).font = { italic: true, color: { argb: "FF737373" } };
  sumar.addRow({});
  sumar.addRow({ i: "Comparația e cu intervalul de aceeași lungime, imediat anterior." }).font = {
    italic: true, size: 10, color: { argb: "FF737373" },
  };
  sumar.addRow({});

  for (const ind of INDICATORI) {
    const cur = ind.get(data.total);
    const prev = ind.get(data.previous);
    const row = sumar.addRow({
      i: ind.label,
      c: cur,
      p: prev,
      d: cur !== null && prev !== null ? cur - prev : null,
    });
    if (ind.format) {
      row.getCell("c").numFmt = ind.format;
      row.getCell("p").numFmt = ind.format;
      row.getCell("d").numFmt = ind.format;
    }
    row.getCell("i").font = { bold: true };
  }
  finish(sumar);

  // ------------------------------------------------------------- Pe agent
  const peAgent = sheet(wb, "Pe agent", [
    { header: "Agent", key: "agent", width: 24 },
    ...INDICATORI.map((ind) => ({
      header: ind.label,
      key: ind.label,
      width: Math.max(12, Math.min(22, ind.label.length + 2)),
      format: ind.format,
    })),
  ]);
  for (const a of data.perAgent) {
    const row: Record<string, unknown> = { agent: a.agent };
    for (const ind of INDICATORI) row[ind.label] = ind.get(a.metrics);
    peAgent.addRow(row);
  }
  finish(peAgent);

  // ------------------------------------------------------------ Evoluție
  const numeGran = gran === "zi" ? "Ziua" : gran === "luna" ? "Luna" : "Săptămâna";
  const evolutie = sheet(wb, "Evoluție", [
    { header: numeGran, key: "p", width: 18 },
    ...INDICATORI.map((ind) => ({
      header: ind.label,
      key: ind.label,
      width: Math.max(12, Math.min(22, ind.label.length + 2)),
      format: ind.format,
    })),
  ]);
  for (const b of data.perPeriod) {
    const row: Record<string, unknown> = { p: b.label };
    for (const ind of INDICATORI) row[ind.label] = ind.get(b.metrics);
    evolutie.addRow(row);
  }
  finish(evolutie);

  // -------------------------------------------------------------- Vizite
  const groups = sections.flatMap((s) => s.groups).filter((g) => g.kind === "single" || g.kind === "multi");
  const vizite = sheet(wb, "Vizite", [
    { header: "Data", key: "data", width: 12, format: DATA },
    { header: "Agent", key: "agent", width: 20 },
    { header: "Firmă", key: "firma", width: 26 },
    { header: "Localitate", key: "oras", width: 16 },
    { header: "Tip vizită", key: "tip", width: 13 },
    ...groups.map((g) => ({ header: g.label, key: `g_${g.id}`, width: 22 })),
    { header: "Modele discutate", key: "modele", width: 30 },
    { header: "Pas următor — data", key: "pasdata", width: 16, format: DATA },
    { header: "Pas bifat", key: "pasfacut", width: 11 },
    { header: "Note libere", key: "note", width: 60 },
  ]);

  for (const v of data.visits) {
    const row: Record<string, unknown> = {
      data: new Date(`${v.date}T12:00:00Z`),
      agent: v.agent,
      firma: v.client,
      oras: v.city ?? "",
      tip: v.prima ? "Prima vizită" : "Revizită",
      modele: v.pumpSkus.join(" | "),
      pasdata: v.nextStepDate ? new Date(`${v.nextStepDate}T12:00:00Z`) : null,
      pasfacut: v.nextStepDate ? (v.nextStepDone ? "da" : "nu") : "",
      note: Object.entries(v.notes)
        .filter(([, t]) => t?.trim())
        .map(([gid, t]) => `${groups.find((g) => g.id === gid)?.label ?? gid}: ${t}`)
        .join(" || "),
    };
    for (const g of groups) {
      const raw = v.answers[g.id];
      row[`g_${g.id}`] = Array.isArray(raw)
        ? raw.map((x) => optionLabel(sections, g.id, x)).join(", ")
        : raw
          ? optionLabel(sections, g.id, String(raw))
          : "";
    }
    vizite.addRow(row);
  }
  finish(vizite);

  // --------------------------------------------------------------- Firme
  const firme = sheet(wb, "Firme", [
    { header: "Firmă", key: "nume", width: 28 },
    { header: "Localitate", key: "oras", width: 16 },
    { header: "Meserie", key: "meserie", width: 18 },
    { header: "Agent", key: "agent", width: 20 },
    { header: "Ce e de făcut", key: "cadran", width: 18 },
    { header: "Apetit", key: "prio", width: 9 },
    { header: "Poate cumpăra", key: "fez", width: 15 },
    { header: "Etapă", key: "etapa", width: 15 },
    { header: "Vizite", key: "vizite", width: 9 },
    { header: "Ultima vizită", key: "ultima", width: 14, format: DATA },
    { header: "Pas următor", key: "pas", width: 22 },
    { header: "Termen pas", key: "termen", width: 13, format: DATA },
    { header: "Restant", key: "restant", width: 10 },
  ]);
  for (const c of data.clients) {
    firme.addRow({
      nume: c.name, oras: c.city ?? "", meserie: c.tradeType ?? "", agent: c.agent,
      cadran: FOCUS[c.focus] ?? c.focus,
      prio: c.priority,
      fez: FEZ[c.feasibility] ?? c.feasibility,
      etapa: c.stage ?? "", vizite: c.visits,
      ultima: c.lastVisit ? new Date(`${c.lastVisit}T12:00:00Z`) : null,
      pas: c.nextStep ?? "",
      termen: c.nextStepDate ? new Date(`${c.nextStepDate}T12:00:00Z`) : null,
      restant: c.late ? "da" : "",
    });
  }
  finish(firme);

  // -------------------------------------------------------------- Oferte
  const oferte = sheet(wb, "Oferte", [
    { header: "Număr", key: "nr", width: 16 },
    { header: "Data", key: "data", width: 12, format: DATA },
    { header: "Firmă", key: "firma", width: 28 },
    { header: "Agent", key: "agent", width: 20 },
    { header: "Stare", key: "stare", width: 13 },
    { header: "Fără TVA", key: "net", width: 16, format: BANI },
    { header: "Cu TVA", key: "brut", width: 16, format: BANI },
    { header: "Din vizita de la", key: "vizita", width: 16 },
    { header: "Zile până la ofertă", key: "zile", width: 17, format: "0" },
  ]);
  const STARI: Record<string, string> = {
    draft: "Ciornă", sent: "Trimisă", accepted: "Acceptată", rejected: "Respinsă", expired: "Expirată",
  };
  for (const q of data.quotes) {
    oferte.addRow({
      nr: q.number, data: new Date(`${q.date}T12:00:00Z`), firma: q.client, agent: q.agent,
      stare: STARI[q.status] ?? q.status, net: q.net, brut: q.gross,
      vizita: q.dinVizita ?? "—", zile: q.zilePanaLaOferta,
    });
  }
  finish(oferte);

  // --------------------------------------------------------------- Piața
  const piata = sheet(wb, "Piața", [
    { header: "Întrebare", key: "grup", width: 38 },
    { header: "Răspuns", key: "optiune", width: 36 },
    { header: "Firme", key: "firme", width: 10 },
  ]);
  piata.addRow({ grup: "Fiecare firmă se numără o singură dată per răspuns." }).font = {
    italic: true, size: 10, color: { argb: "FF737373" },
  };
  for (const m of data.market) piata.addRow({ grup: m.group, optiune: m.option, firme: m.firms });
  finish(piata);

  for (const ws of [sumar, peAgent, evolutie, piata]) {
    ws.getColumn(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const eticheta = gran === "zi" ? "zilnic" : gran === "luna" ? "lunar" : "saptamanal";

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="activitate-${eticheta}-${from}_${to}.xlsx"`,
      // Conține date de clienți și valori de ofertă: nu se păstrează nicăieri pe drum.
      "cache-control": "no-store",
    },
  });
}
