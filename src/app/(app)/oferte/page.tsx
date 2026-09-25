import Link from "next/link";

import { archiveQuote, duplicateQuote, restoreQuote } from "@/app/(app)/oferte/actions";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { DataList } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/totals";
import { QUOTE_STATUS_LABELS, type Quote, type QuoteStatus } from "@/lib/types";

export const metadata = { title: "Oferte" };

type QuoteRow = Quote & { clients: { name: string } | null };

export default async function QuotesPage(props: PageProps<"/oferte">) {
  const { orgId } = await requireOrg();
  const { status } = await props.searchParams;
  const activeStatus = typeof status === "string" ? status : "";
  // „arhiva” e un filtru separat: ofertele arhivate nu apar în celelalte.
  const arhiva = activeStatus === "arhiva";

  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("*, clients(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  query = arhiva ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (activeStatus && activeStatus in QUOTE_STATUS_LABELS) {
    query = query.eq("status", activeStatus);
  }

  const { data } = await query;
  const quotes = (data ?? []) as QuoteRow[];

  // Totalurile vin din view-ul `quote_totals` și se leagă în memorie, pe id.
  const { data: totalsData } = await supabase
    .from("quote_totals")
    .select("quote_id, net_total, vat_total")
    .in("quote_id", quotes.length ? quotes.map((quote) => quote.id) : ["00000000-0000-0000-0000-000000000000"]);

  const totals = new Map(
    (totalsData ?? []).map((row) => [
      row.quote_id as string,
      Number(row.net_total) + Number(row.vat_total),
    ]),
  );

  // Câte oferte are fiecare stare, pentru cifrele de pe filtre.
  const { data: statusRows } = await supabase.from("quotes").select("status, archived_at").eq("org_id", orgId);
  const active = (statusRows ?? []).filter((r) => !r.archived_at);
  const archivedCount = (statusRows?.length ?? 0) - active.length;
  const perStatus = new Map<string, number>();
  for (const row of active) perStatus.set(row.status, (perStatus.get(row.status) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Oferte"
        description="Numerotate automat, pe an și pe firmă."
        actions={
          <Link href="/oferte/nou" className="btn btn-primary">
            ＋ Ofertă nouă
          </Link>
        }
      />

      <FilterChips
        label="Filtrează după stare"
        items={[
          { label: "Toate", href: "/oferte", active: !activeStatus, count: active.length },
          ...(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((value) => ({
            label: QUOTE_STATUS_LABELS[value],
            href: `/oferte?status=${value}`,
            active: activeStatus === value,
            count: perStatus.get(value) ?? 0,
          })),
          ...(archivedCount || arhiva
            ? [{ label: "Arhivă", href: "/oferte?status=arhiva", active: arhiva, count: archivedCount }]
            : []),
        ]}
      />

      {quotes.length === 0 ? (
        <EmptyState
          title={arhiva ? "Arhiva e goală" : "Nicio ofertă aici"}
          description="Creează prima ofertă: alegi clientul, adaugi produse din catalog și exporți PDF-ul."
          action={
            <Link href="/oferte/nou" className="btn btn-primary">
              Ofertă nouă
            </Link>
          }
        />
      ) : (
        <DataList
          rows={quotes}
          rowKey={(q) => q.id}
          minWidth={760}
          muted={(q) => Boolean(q.archived_at)}
          title={(q) => (
            <Link href={`/oferte/${q.id}`} className="text-brand-700 hover:underline">
              {q.number}
              <span className="block text-sm font-normal text-neutral-900">{q.clients?.name ?? "—"}</span>
            </Link>
          )}
          columns={[
            {
              header: "Număr",
              hideOnMobile: true,
              cell: (q) => (
                <>
                  <Link href={`/oferte/${q.id}`} className="font-medium text-brand-700 hover:underline">
                    {q.number}
                  </Link>
                  {q.title ? <p className="text-xs text-neutral-500">{q.title}</p> : null}
                </>
              ),
            },
            { header: "Client", hideOnMobile: true, cell: (q) => q.clients?.name ?? "—" },
            { header: "Stare", cell: (q) => <StatusBadge status={q.status} /> },
            {
              header: "Valoare ofertată",
              className: "text-right font-medium tabular-nums",
              cell: (q) => formatMoney(totals.get(q.id) ?? 0, q.currency),
            },
            { header: "Emisă", className: "text-neutral-500", cell: (q) => formatDate(q.issue_date) },
            { header: "Valabilă până", className: "text-neutral-500", cell: (q) => formatDate(q.valid_until) },
          ]}
          actions={(q) => (
            <ActionMenu label={`Acțiuni pentru oferta ${q.number}`}>
              <Link href={`/oferte/${q.id}`} className="menu-item" role="menuitem">
                Deschide și editează
              </Link>
              <Link href={`/print/oferta/${q.id}`} target="_blank" rel="noreferrer" className="menu-item" role="menuitem">
                Vezi PDF
              </Link>
              <form action={duplicateQuote}>
                <input type="hidden" name="quote_id" value={q.id} />
                <button type="submit" className="menu-item" role="menuitem">
                  Duplică
                </button>
              </form>
              {q.archived_at ? (
                <form action={restoreQuote}>
                  <input type="hidden" name="quote_id" value={q.id} />
                  <SubmitButton className="menu-item" pendingLabel="Se restaurează…">
                    Restaurează
                  </SubmitButton>
                </form>
              ) : (
                <form action={archiveQuote}>
                  <input type="hidden" name="quote_id" value={q.id} />
                  <SubmitButton
                    className="menu-item menu-item-danger btn-danger-ghost"
                    pendingLabel="Se arhivează…"
                    confirm={`Arhivezi oferta ${q.number}?`}
                    confirmLabel="Da, arhivează"
                  >
                    Arhivează
                  </SubmitButton>
                </form>
              )}
            </ActionMenu>
          )}
        />
      )}
    </div>
  );
}
