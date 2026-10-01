import ExcelJS from "exceljs";

import { requireOrg } from "@/lib/auth";
import { getAllDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import { tradeLabel } from "@/lib/teren";
import type { Client } from "@/lib/types";

// exceljs are nevoie de Node, nu de runtime-ul edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND = "FF0033AB";
const LINE = "FFE8E8E8";
const DATA = "dd.mm.yyyy";

/** Supabase dă cel mult 1.000 de rânduri pe cerere; baza întreagă vine pe pagini. */
const PAGINA = 1000;

async function toate<T>(
  citeste: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await citeste(from, from + PAGINA - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) return rows;
  }
}

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

function finish(ws: ExcelJS.Worksheet) {
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
    });
  });
}

const zi = (date: string | null) => (date ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : null);

/**
 * Baza de clienți, de la toți agenții, într-un singur fișier Excel. Conducerea
 * vede toate firmele; un agent primește doar firmele lui — aceeași regulă ca în
 * aplicație, impusă de baza de date.
 */
export async function GET() {
  const { orgId, organization } = await requireOrg();
  const supabase = await createClient();

  const [clients, contacts, visits, { data: members }, domenii] = await Promise.all([
    toate<Client>((from, to) =>
      supabase.from("clients").select("*").eq("org_id", orgId).order("name").order("id").range(from, to),
    ),
    toate<{ client_id: string; role: string | null; name: string | null; phone: string | null }>(
      (from, to) =>
        supabase
          .from("client_contacts")
          .select("client_id, role, name, phone, clients!inner(org_id)")
          .eq("clients.org_id", orgId)
          .order("client_id")
          .order("position")
          .order("id")
          .range(from, to),
    ),
    toate<{ client_id: string; visit_date: string; next_step_date: string | null; next_step_done_at: string | null }>(
      (from, to) =>
        supabase
          .from("visits")
          .select("client_id, visit_date, next_step_date, next_step_done_at")
          .eq("org_id", orgId)
          .order("id")
          .range(from, to),
    ),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
    getAllDomains(orgId),
  ]);

  const agent = new Map(
    (members ?? []).map((m) => [m.user_id as string, (m.full_name as string | null) ?? ""]),
  );
  const numeAgent = (id: string | null) => (id ? agent.get(id) || "—" : "Fără agent");
  const domeniu = (id: string | null) => domenii.find((d) => d.id === id)?.label ?? id ?? "";

  // Vizitele, adunate pe firmă: câte, ultima și următorul pas încă nefăcut.
  const peFirma = new Map<string, { n: number; ultima: string | null; pas: string | null }>();
  for (const v of visits) {
    const s = peFirma.get(v.client_id) ?? { n: 0, ultima: null, pas: null };
    s.n += 1;
    if (!s.ultima || v.visit_date > s.ultima) s.ultima = v.visit_date;
    if (v.next_step_date && !v.next_step_done_at && (!s.pas || v.next_step_date < s.pas)) {
      s.pas = v.next_step_date;
    }
    peFirma.set(v.client_id, s);
  }

  // Pe agent, apoi alfabetic: fiecare agent își găsește firmele una sub alta.
  const ordonate = [...clients].sort(
    (a, b) =>
      numeAgent(a.owner_agent_id).localeCompare(numeAgent(b.owner_agent_id), "ro") ||
      a.name.localeCompare(b.name, "ro"),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = organization.name;
  wb.created = new Date();

  // ------------------------------------------------------------- Clienți
  const ws = sheet(wb, "Clienți", [
    { header: "Denumire", key: "name", width: 32 },
    { header: "Agent responsabil", key: "agent", width: 22 },
    { header: "CUI", key: "cui", width: 14, format: "@" },
    { header: "Nr. Reg. Com.", key: "reg_com", width: 16 },
    { header: "Domeniu", key: "domain", width: 22 },
    { header: "Meserie", key: "trade", width: 20 },
    { header: "Persoană de contact", key: "contact_person", width: 24 },
    { header: "Telefon", key: "phone", width: 16, format: "@" },
    { header: "Email", key: "email", width: 26 },
    { header: "Adresă", key: "address", width: 34 },
    { header: "Localitate", key: "city", width: 18 },
    { header: "Județ", key: "county", width: 14 },
    { header: "Vizite", key: "vizite", width: 9 },
    { header: "Ultima vizită", key: "ultima", width: 13, format: DATA },
    { header: "Pas următor", key: "pas", width: 13, format: DATA },
    { header: "Canal newsletter", key: "canal", width: 15 },
    { header: "Fără newsletter", key: "optout", width: 14 },
    { header: "Adăugat la", key: "created", width: 13, format: DATA },
    { header: "Note", key: "notes", width: 50 },
  ]);

  for (const c of ordonate) {
    const s = peFirma.get(c.id);
    ws.addRow({
      name: c.name,
      agent: numeAgent(c.owner_agent_id),
      cui: c.cui ?? "",
      reg_com: c.reg_com ?? "",
      domain: domeniu(c.domain),
      trade: tradeLabel(c.trade_type),
      contact_person: c.contact_person ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      county: c.county ?? "",
      vizite: s?.n ?? 0,
      ultima: zi(s?.ultima ?? null),
      pas: zi(s?.pas ?? null),
      canal: c.preferred_channel === "whatsapp" ? "WhatsApp" : c.preferred_channel === "email" ? "Email" : "",
      optout: c.newsletter_opt_out ? "Da" : "",
      created: zi(c.created_at),
      notes: c.notes ?? "",
    });
  }
  finish(ws);

  // ------------------------------------------------- Persoane de contact
  const firma = new Map(clients.map((c) => [c.id, c]));
  const pc = sheet(wb, "Persoane de contact", [
    { header: "Firmă", key: "firma", width: 32 },
    { header: "Agent responsabil", key: "agent", width: 22 },
    { header: "Rol", key: "role", width: 20 },
    { header: "Nume", key: "name", width: 24 },
    { header: "Telefon", key: "phone", width: 16, format: "@" },
  ]);
  const contacteOrdonate = contacts
    .filter((p) => firma.has(p.client_id))
    .sort((a, b) => firma.get(a.client_id)!.name.localeCompare(firma.get(b.client_id)!.name, "ro"));
  for (const p of contacteOrdonate) {
    const c = firma.get(p.client_id)!;
    pc.addRow({
      firma: c.name,
      agent: numeAgent(c.owner_agent_id),
      role: p.role ?? "",
      name: p.name ?? "",
      phone: p.phone ?? "",
    });
  }
  finish(pc);

  // ------------------------------------------------------------ Pe agent
  const pa = sheet(wb, "Pe agent", [
    { header: "Agent", key: "agent", width: 24 },
    { header: "Firme", key: "firme", width: 10 },
    { header: "Firme vizitate", key: "vizitate", width: 14 },
    { header: "Vizite", key: "vizite", width: 10 },
  ]);
  const totaluri = new Map<string, { firme: number; vizitate: number; vizite: number }>();
  for (const c of ordonate) {
    const nume = numeAgent(c.owner_agent_id);
    const t = totaluri.get(nume) ?? { firme: 0, vizitate: 0, vizite: 0 };
    const n = peFirma.get(c.id)?.n ?? 0;
    t.firme += 1;
    t.vizitate += n > 0 ? 1 : 0;
    t.vizite += n;
    totaluri.set(nume, t);
  }
  for (const [nume, t] of totaluri) pa.addRow({ agent: nume, ...t });
  const total = pa.addRow({
    agent: "Total",
    firme: clients.length,
    vizitate: [...totaluri.values()].reduce((s, t) => s + t.vizitate, 0),
    vizite: [...totaluri.values()].reduce((s, t) => s + t.vizite, 0),
  });
  total.font = { bold: true };
  finish(pa);

  const azi = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="clienti-${azi}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
