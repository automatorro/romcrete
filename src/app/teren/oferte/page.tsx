import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/totals";
import { QUOTE_STATUS_LABELS, type Quote, type QuoteStatus } from "@/lib/types";

export const metadata = { title: "Oferte" };

type Row = Quote & { clients: { name: string; city: string | null } | null };

/**
 * Ofertele agentului, pe telefon: ce a trimis, ce așteaptă răspuns, ce s-a
 * câștigat. Conducerea vede, ca în agendă, fie ofertele ei, fie ale echipei.
 */
export default async function TerenOfertePage(props: PageProps<"/teren/oferte">) {
  const { orgId, user, role } = await requireOrg();
  const { status, cine } = await props.searchParams;
  const conducere = role !== "agent";
  const echipa = conducere && cine === "echipa";
  const activeStatus = typeof status === "string" && status in QUOTE_STATUS_LABELS ? (status as QuoteStatus) : "";
  const arhiva = status === "arhiva";

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("*, clients(name, city)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!echipa) query = query.eq("created_by", user.id);

  const { data } = await query;
  const rows = (data ?? []) as Row[];
  // Arhivatele stau doar în filtrul lor; în rest se lucrează cu ofertele active.
  const all = rows.filter((q) => !q.archived_at);
  const archived = rows.filter((q) => q.archived_at);
  const quotes = arhiva ? archived : activeStatus ? all.filter((q) => q.status === activeStatus) : all;

  const { data: totalsData } = await supabase
    .from("quote_totals")
    .select("quote_id, net_total, vat_total")
    .in("quote_id", quotes.length ? quotes.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"]);
  const totals = new Map(
    (totalsData ?? []).map((t) => [t.quote_id as string, Number(t.net_total) + Number(t.vat_total)]),
  );

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: arhiva ? "arhiva" : activeStatus, cine: echipa ? "echipa" : "", ...patch }))
      if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/teren/oferte?${s}` : "/teren/oferte";
  };
  const count = (s: QuoteStatus) => all.filter((q) => q.status === s).length;

  return (
    <div>
      <PageHeader
        title="Oferte"
        description={echipa ? "Ofertele echipei" : "Ofertele emise de tine"}
        actions={
          conducere ? (
            <FilterChips
              label="Ofertele cui"
              items={[
                { label: "Ale mele", href: href({ cine: null }), active: !echipa },
                { label: "Echipa", href: href({ cine: "echipa" }), active: echipa },
              ]}
            />
          ) : undefined
        }
      />

      <FilterChips
        label="Filtrează după stare"
        items={[
          { label: "Toate", href: href({ status: null }), active: !activeStatus && !arhiva, count: all.length },
          ...(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[])
            .filter((s) => count(s) > 0 || s === activeStatus)
            .map((s) => ({
              label: QUOTE_STATUS_LABELS[s],
              href: href({ status: s }),
              active: activeStatus === s,
              count: count(s),
            })),
          ...(archived.length || arhiva
            ? [{ label: "Arhivă", href: href({ status: "arhiva" }), active: arhiva, count: archived.length }]
            : []),
        ]}
      />

      {quotes.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={arhiva ? "Arhiva e goală" : all.length ? "Nicio ofertă în starea aleasă" : "Încă nicio ofertă"}
            description="Ofertele pornesc dintr-o vizită: după ce bifezi modelele discutate, apasă „Ofertă din vizită”."
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/teren/oferta/${q.id}`} className="card block p-3 active:bg-neutral-50">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-brand-700">{q.number}</p>
                    <p className="truncate text-sm">
                      {q.clients?.name ?? "—"}
                      {q.clients?.city ? <span className="text-neutral-500"> · {q.clients.city}</span> : null}
                    </p>
                  </div>
                  <StatusBadge status={q.status} />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-neutral-500">
                    {formatDate(q.issue_date)}
                    {q.valid_until ? ` · valabilă până ${formatDate(q.valid_until)}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(totals.get(q.id) ?? 0, q.currency)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
