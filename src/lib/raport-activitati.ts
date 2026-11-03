import { addDays, todayRo } from "@/lib/agenda";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/toate-randurile";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/types";

const REPORT_KINDS = [
  "telefon",
  "email",
  "whatsapp",
  "intalnire",
  "newsletter",
  "oferta_creata",
  "oferta_stare",
] as const;

type ReportKind = (typeof REPORT_KINDS)[number];

type RawActivity = {
  id: string;
  kind: ReportKind;
  agent_id: string | null;
  occurred_at: string;
  body: string | null;
  meta: {
    channel?: "email" | "whatsapp";
    number?: string;
    status?: QuoteStatus;
    event?: "arhivata" | "restaurata";
    title?: string;
  } | null;
  clients:
    | { name: string; city: string | null; domain: string | null }
    | { name: string; city: string | null; domain: string | null }[]
    | null;
};

export type ReportActivity = {
  id: string;
  kind: ReportKind | "vizita";
  date: string;
  sortAt: string;
  agentId: string | null;
  client: string;
  city: string | null;
  domainId: string | null;
  channel: "telefon" | "email" | "whatsapp" | null;
  mode: string;
  description: string;
};

function activityText(activity: RawActivity): { mode: string; description: string } {
  const body = activity.body?.trim() ?? "";
  if (activity.kind === "telefon") return { mode: "Telefon", description: body || "Apel înregistrat." };
  if (activity.kind === "email") return { mode: "Email", description: body || "Email înregistrat." };
  if (activity.kind === "whatsapp") return { mode: "WhatsApp", description: body || "Mesaj WhatsApp înregistrat." };
  if (activity.kind === "intalnire") return { mode: "Întâlnire", description: body || "Întâlnire înregistrată." };
  if (activity.kind === "newsletter") {
    const channel = activity.meta?.channel === "whatsapp" ? "WhatsApp" : "Email";
    return { mode: `Newsletter · ${channel}`, description: body || activity.meta?.title || "Newsletter înregistrat." };
  }

  const number = activity.meta?.number ? ` ${activity.meta.number}` : "";
  if (activity.kind === "oferta_creata") {
    return { mode: "Ofertă creată", description: body || `Oferta${number} a fost creată.` };
  }
  if (activity.meta?.event === "arhivata") {
    return { mode: "Ofertă arhivată", description: body || `Oferta${number} a fost arhivată.` };
  }
  if (activity.meta?.event === "restaurata") {
    return { mode: "Ofertă restaurată", description: body || `Oferta${number} a fost restaurată din arhivă.` };
  }
  const status = activity.meta?.status;
  const statusLabel = status ? QUOTE_STATUS_LABELS[status] : "actualizată";
  return {
    mode: status === "sent" ? "Ofertă trimisă" : `Ofertă · ${statusLabel}`,
    description: body || `Oferta${number}: ${statusLabel.toLowerCase()}.`,
  };
}

/**
 * Toate comunicările, newsletterele și evenimentele ofertelor înregistrate în
 * istoricul firmelor, cu aceleași reguli de perioadă, agent și domeniu.
 */
export async function getReportActivities(
  orgId: string,
  from: string,
  to: string,
  agentId: string | null,
  domainId: string | null,
): Promise<ReportActivity[]> {
  const supabase = await createClient();
  const rows = await allRows<RawActivity>((start, end) => {
    let query = supabase
      .from("client_activities")
      .select("id, kind, agent_id, occurred_at, body, meta, clients!inner(name, city, domain)")
      .eq("org_id", orgId)
      .in("kind", [...REPORT_KINDS])
      .gte("occurred_at", `${addDays(from, -1)}T00:00:00Z`)
      .lt("occurred_at", `${addDays(to, 2)}T00:00:00Z`)
      .order("occurred_at")
      .order("id")
      .range(start, end);
    if (agentId) query = query.eq("agent_id", agentId);
    if (domainId === "constructii") {
      query = query.or("domain.eq.constructii,domain.is.null", { referencedTable: "clients" });
    } else if (domainId) {
      query = query.eq("clients.domain", domainId);
    }
    return query;
  });

  return rows.flatMap((activity) => {
    const date = todayRo(new Date(activity.occurred_at));
    if (date < from || date > to) return [];
    const client = Array.isArray(activity.clients) ? activity.clients[0] : activity.clients;
    const text = activityText(activity);
    return [{
      id: activity.id,
      kind: activity.kind,
      date,
      sortAt: activity.occurred_at,
      agentId: activity.agent_id,
      client: client?.name ?? "Firmă ștearsă",
      city: client?.city ?? null,
      domainId: client?.domain ?? "constructii",
      channel:
        activity.kind === "telefon" || activity.kind === "email" || activity.kind === "whatsapp"
          ? activity.kind
          : activity.kind === "newsletter"
            ? activity.meta?.channel ?? null
            : null,
      ...text,
    }];
  });
}
