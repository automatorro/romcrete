import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { periodCutoff, type Period } from "@/lib/raport";
import type { Answers, Notes } from "@/lib/teren";

/** Ghilimele doar unde e nevoie; separatorul e „;”, cum așteaptă Excel românesc. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toCsv = (rows: unknown[][]) =>
  // BOM, ca Excel să recunoască diacriticele.
  "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

export async function GET(request: NextRequest) {
  const { orgId } = await requireOrg();
  const { searchParams } = request.nextUrl;
  const raw = searchParams.get("per");
  const period: Period = raw === "7" || raw === "all" ? raw : "30";
  const agent = searchParams.get("ag") ?? "";
  const cut = periodCutoff(period);

  const supabase = await createClient();
  const sections = await getQuestionCatalogue(orgId);

  let query = supabase
    .from("visits")
    .select("visit_date, agent_id, answers, notes, pump_skus, next_step_date, clients(name, city)")
    .eq("org_id", orgId)
    .order("visit_date", { ascending: false });
  if (cut) query = query.gte("visit_date", cut);
  if (agent) query = query.eq("agent_id", agent);

  const [{ data: visits }, { data: members }, { data: items }] = await Promise.all([
    query,
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
    supabase.from("catalog_items").select("sku, name").eq("org_id", orgId).not("sku", "is", null),
  ]);

  const agentName = new Map((members ?? []).map((m) => [m.user_id, m.full_name ?? ""]));
  const pumpName = new Map((items ?? []).map((i) => [i.sku as string, i.name as string]));
  const groups = sections.flatMap((s) => s.groups).filter((g) => g.kind === "single" || g.kind === "multi");

  const header = ["Data", "Agent", "Firma", "Localitate"]
    .concat(groups.map((g) => g.label))
    .concat(["Modele discutate", "Data pasului următor", "Note libere"]);

  const rows = ((visits ?? []) as unknown as {
    visit_date: string;
    agent_id: string | null;
    answers: Answers;
    notes: Notes;
    pump_skus: string[];
    next_step_date: string | null;
    clients: { name: string; city: string | null } | null;
  }[]).map((v) => {
    const answers = groups.map((g) => {
      const raw = v.answers?.[g.id];
      if (Array.isArray(raw)) return raw.map((x) => optionLabel(sections, g.id, x)).join(", ");
      return raw ? optionLabel(sections, g.id, String(raw)) : "";
    });

    const note = Object.entries(v.notes ?? {})
      .filter(([, t]) => t?.trim())
      .map(([gid, t]) => `${groups.find((g) => g.id === gid)?.label ?? gid}: ${t}`)
      .join(" || ");

    return [
      v.visit_date,
      agentName.get(v.agent_id ?? "") ?? "",
      v.clients?.name ?? "",
      v.clients?.city ?? "",
      ...answers,
      (v.pump_skus ?? []).map((s) => pumpName.get(s) ?? s).join(" | "),
      v.next_step_date ?? "",
      note,
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(toCsv([header, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vizite-romcrete-${stamp}.csv"`,
      // Conține date de clienți: nu se păstrează în cache nicăieri pe drum.
      "cache-control": "no-store",
    },
  });
}
