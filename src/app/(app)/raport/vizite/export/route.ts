import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
import { getReportActivities } from "@/lib/raport-activitati";
import { allRows } from "@/lib/toate-randurile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VisitReportRow = {
  visit_date: string;
  agent_id: string | null;
  report_contact: string | null;
  report_discussion: string | null;
  report_outcome: string | null;
  report_proposal_made: boolean | null;
  report_next_visit_date: string | null;
  report_observations: string | null;
  clients: { name: string; domain: string | null } | { name: string; domain: string | null }[] | null;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE = "dd.mm.yyyy";
const BRAND = "FF0033AB";
const LINE = "FFE8E8E8";

export async function GET(request: NextRequest) {
  const { orgId, organization } = await requireOrg();
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) {
    return new Response("Perioada raportului nu este validă.", { status: 400 });
  }

  const agentId = sp.get("ag");
  const domainId = sp.get("dom");
  const supabase = await createClient();
  const [visits, reportActivities] = await Promise.all([
    allRows<VisitReportRow>((start, end) => {
      let query = supabase
        .from("visits")
        .select(
          "visit_date, agent_id, report_contact, report_discussion, report_outcome, report_proposal_made, report_next_visit_date, report_observations, clients!inner(name, domain)",
        )
        .eq("org_id", orgId)
        .gte("visit_date", from)
        .lte("visit_date", to)
        .order("visit_date")
        .order("id")
        .range(start, end);
      if (agentId && agentId !== "echipa") query = query.eq("agent_id", agentId);
      if (domainId === "constructii") {
        query = query.or("domain.eq.constructii,domain.is.null", { referencedTable: "clients" });
      } else if (domainId) {
        query = query.eq("clients.domain", domainId);
      }
      return query;
    }),
    getReportActivities(orgId, from, to, agentId === "echipa" ? null : agentId, domainId),
  ]);

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, full_name")
    .eq("org_id", orgId);
  const agents = new Map((memberships ?? []).map((m) => [m.user_id as string, m.full_name as string | null]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = organization.name;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Vizite săptămânale", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Agent", key: "agent", width: 24 },
    { header: "Firmă", key: "company", width: 30 },
    { header: "Mod contactare", key: "mode", width: 18 },
    { header: "Cu cine s-a discutat", key: "contact", width: 26 },
    { header: "Ce s-a discutat", key: "discussion", width: 44 },
    { header: "Rezultatul discuției", key: "outcome", width: 38 },
    { header: "Propunere/ofertă", key: "proposal", width: 18 },
    { header: "Data următoarei vizite", key: "nextVisit", width: 20 },
    { header: "Observațiile agentului", key: "observations", width: 44 },
  ];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  sheet.getColumn("date").numFmt = DATE;
  sheet.getColumn("nextVisit").numFmt = DATE;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };

  const visitRows = visits.map((visit) => {
    const linked = Array.isArray(visit.clients) ? visit.clients[0] : visit.clients;
    return {
      day: visit.visit_date,
      sortAt: `${visit.visit_date}T12:00:00Z`,
      agent: visit.agent_id ? agents.get(visit.agent_id) ?? "Agent fără nume" : "—",
      company: linked?.name ?? "—",
      mode: "Vizită",
      contact: visit.report_contact ?? "",
      discussion: visit.report_discussion ?? "",
      outcome: visit.report_outcome ?? "",
      proposal: visit.report_proposal_made === null ? "" : visit.report_proposal_made ? "Da" : "Nu",
      nextVisit: visit.report_next_visit_date,
      observations: visit.report_observations ?? "",
    };
  });
  const activityRows = reportActivities.map((activity) => ({
    day: activity.date,
    sortAt: activity.sortAt,
    agent: activity.agentId ? agents.get(activity.agentId) ?? "Agent fără nume" : "—",
    company: activity.client,
    mode: activity.mode,
    contact: "",
    discussion: activity.description,
    outcome: "",
    proposal: "",
    nextVisit: null,
    observations: "",
  }));
  const reportRows = [...visitRows, ...activityRows].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  for (const row of reportRows) {
    sheet.addRow({
      date: new Date(`${row.day}T12:00:00Z`),
      agent: row.agent,
      company: row.company,
      mode: row.mode,
      contact: row.contact,
      discussion: row.discussion,
      outcome: row.outcome,
      proposal: row.proposal,
      nextVisit: row.nextVisit ? new Date(`${row.nextVisit}T12:00:00Z`) : null,
      observations: row.observations,
    });
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 32;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="vizite-saptamanal-${from}_${to}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}