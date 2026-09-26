import ExcelJS from "exceljs";

import { clientSchema } from "@/lib/validation";

/** Câmpurile unui client care se pot aduce dintr-un tabel. */
export const IMPORT_FIELDS = [
  "name", "cui", "reg_com", "contact_person", "phone", "email", "address", "city", "county", "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Capul de tabel din fișierul model; aceleași denumiri pe care le recunoaște importul. */
export const TEMPLATE_HEADERS: Record<ImportField, string> = {
  name: "Denumire",
  cui: "CUI",
  reg_com: "Nr. Reg. Com.",
  contact_person: "Persoană de contact",
  phone: "Telefon",
  email: "Email",
  address: "Adresă",
  city: "Localitate",
  county: "Județ",
  notes: "Observații",
};

/**
 * Cum se recunoaște fiecare coloană după cap de tabel, în ordinea încercărilor.
 * Ordinea contează: „Adresă email” e email, nu adresă; „Telefon contact” e
 * telefon, nu persoana de contact.
 */
const HEADER_RULES: [ImportField | null, RegExp][] = [
  ["email", /\be ?mail\b|\bmail\b/],
  ["phone", /\btel(efon)?\b|\bmobil\b|\bphone\b|\bmobile\b|\bgsm\b/],
  ["cui", /\bcui\b|\bcif\b|\bcod (unic|fiscal|de inregistrare)|\bcod identificare fiscala\b|\bvat\b|\btax id\b/],
  ["reg_com", /\breg\.? ?com|\bregistr(ul)? comert|\bonrc\b|\bnr\.? ?rc\b|\btrade register\b/],
  ["county", /\bjud(et)?\b|\bcounty\b/],
  ["city", /\blocalitate(a)?\b|\boras(ul)?\b|\bmunicipiu\b|\bcity\b|\btown\b/],
  ["address", /\badresa\b|\bsediu\b|\bstrada\b|\baddress\b/],
  ["notes", /\bobserv|\bnot(e|ite|a)\b|\bmentiuni\b|\bcomentari|\bcomments?\b|\bdetalii\b/],
  ["contact_person", /\bcontact\b|\bpersoana\b|\breprezentant\b|\badministrator\b|\bpatron\b/],
  // „Cod client”, „Tip client”, „Nr. crt.” nu sunt numele clientului.
  [null, /^(cod|id|nr|numar|tip|categorie|status|grup|zona|agent|data)\b/],
  ["name", /\bdenumire\b|\bfirma\b|\bclient(ul)?\b|\bcompanie\b|\bsocietate\b|\bnume\b|\bcompany\b|\bcustomer\b|\bname\b/],
];

/** Litere mici, fără diacritice și fără semne: „Județ:” și „judet” sunt același cap. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function fieldForHeader(header: string): ImportField | null {
  const text = normalize(header);
  if (!text) return null;
  return HEADER_RULES.find(([, rule]) => rule.test(text))?.[0] ?? null;
}

/** Prima coloană care se potrivește câștigă; o a doua „Telefon” nu o suprascrie. */
function mapHeaders(cells: string[]): Map<number, ImportField> {
  const mapping = new Map<number, ImportField>();
  const used = new Set<ImportField>();
  cells.forEach((cell, index) => {
    const field = fieldForHeader(cell);
    if (field && !used.has(field)) {
      mapping.set(index, field);
      used.add(field);
    }
  });
  return mapping;
}

/** CSV cu `;` (exportul Excel românesc) sau cu `,`, cu ghilimele după regula obișnuită. */
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const delimiter = [";", ",", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Textul unei celule așa cum îl vede omul în Excel (formule → rezultat, linkuri → text). */
function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  // Un număr de telefon sau un CUI scris ca număr nu trebuie să ajungă „7,23E+08”.
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : cell.text;
  if (typeof value === "object" && "result" in value) {
    const result = value.result;
    return result === null || result === undefined || typeof result === "object" ? "" : String(result);
  }
  return cell.text ?? "";
}

async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  // Prima foaie care are ceva în ea; multe fișiere încep cu o foaie goală sau de instrucțiuni.
  const ws = wb.worksheets.find((sheet) => sheet.actualRowCount > 0);
  if (!ws) return [];

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let col = 1; col <= ws.columnCount; col++) cells.push(cellText(row.getCell(col)));
    rows[rowNumber - 1] = cells;
  });
  // Rândurile goale de la început rămân goale, ca numerotarea să fie cea din Excel.
  return Array.from(rows, (r) => r ?? []);
}

export type ParsedClient = { row: number; data: ReturnType<typeof clientSchema.parse> };

export type ParseOutcome =
  | { ok: false; error: string }
  | {
      ok: true;
      clients: ParsedClient[];
      /** Rândurile care n-au putut fi citite, cu numărul lor din Excel. */
      problems: string[];
      /** Coloanele recunoscute, pentru mesajul de confirmare. */
      columns: string[];
    };

export const MAX_ROWS = 5000;

export async function parseClientsFile(file: File): Promise<ParseOutcome> {
  const name = file.name.toLowerCase();
  let rows: string[][];

  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      rows = parseCsv((await file.text()).replace(/^﻿/, ""));
    } else if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      rows = await readXlsx(await file.arrayBuffer());
    } else if (name.endsWith(".xls")) {
      return {
        ok: false,
        error:
          "Formatul vechi .xls nu se poate citi. Deschide fișierul în Excel și salvează-l ca .xlsx („Salvare ca” → Registru de lucru Excel).",
      };
    } else {
      return { ok: false, error: "Alege un fișier Excel (.xlsx) sau CSV." };
    }
  } catch {
    return { ok: false, error: "Fișierul nu a putut fi citit. Verifică dacă este un Excel valid (.xlsx)." };
  }

  // Capul de tabel poate fi sub un titlu sau câteva rânduri goale: îl alegem pe
  // rândul, dintre primele zece, care recunoaște cele mai multe coloane.
  let headerIndex = -1;
  let mapping = new Map<number, ImportField>();
  rows.slice(0, 10).forEach((cells, index) => {
    const candidate = mapHeaders(cells);
    if ([...candidate.values()].includes("name") && candidate.size > mapping.size) {
      headerIndex = index;
      mapping = candidate;
    }
  });

  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        "Nu am găsit coloana cu numele clientului. Primul rând al tabelului trebuie să aibă capete de coloană, de exemplu „Denumire”, „CUI”, „Telefon”, „Localitate” (descarcă fișierul model).",
    };
  }

  const dataRows = rows.slice(headerIndex + 1);
  if (dataRows.filter((cells) => cells.some((c) => c.trim())).length > MAX_ROWS) {
    return {
      ok: false,
      error: `Fișierul are mai mult de ${MAX_ROWS} de rânduri. Împarte-l în mai multe fișiere și importă-le pe rând.`,
    };
  }

  const clients: ParsedClient[] = [];
  const problems: string[] = [];

  dataRows.forEach((cells, offset) => {
    const row = headerIndex + offset + 2; // numărul rândului în Excel
    const raw: Record<string, string> = {};
    for (const [index, field] of mapping) raw[field] = (cells[index] ?? "").replace(/\s+/g, " ").trim();
    // Rândurile care au doar „Nr. crt.” sau alte coloane ignorate sunt goale pentru noi.
    if (!Object.values(raw).some(Boolean)) return;
    // Excel ține telefonul scris ca număr fără zeroul din față: 722123456 → 0722123456.
    if (/^[237]\d{8}$/.test(raw.phone ?? "")) raw.phone = `0${raw.phone}`;

    const parsed = clientSchema.safeParse(raw);
    if (parsed.success) {
      clients.push({ row, data: parsed.data });
    } else {
      problems.push(`rândul ${row}: ${raw.name ? parsed.error.issues[0]?.message : "lipsește denumirea"}`);
    }
  });

  const columns = [...mapping.values()].map((field) => TEMPLATE_HEADERS[field]);
  return { ok: true, clients, problems, columns };
}

/** „RO 123 456” și „123456” sunt același CUI. */
export function cuiKey(cui: string | null): string | null {
  if (!cui) return null;
  const key = cui.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RO/, "");
  return key || null;
}

/** „S.C. Alfa Construct S.R.L.” și „Alfa Construct SRL” sunt aceeași firmă. */
export function nameKey(name: string): string {
  return normalize(name)
    .replace(/\./g, "")
    .replace(/^sc\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
