import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
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

  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("*, clients(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Oferte</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Numerotate automat, pe an și pe firmă.
          </p>
        </div>
        <Link href="/oferte/nou" className="btn btn-primary">
          Ofertă nouă
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2">
        <FilterLink label="Toate" href="/oferte" active={!activeStatus} />
        {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((value) => (
          <FilterLink
            key={value}
            label={QUOTE_STATUS_LABELS[value]}
            href={`/oferte?status=${value}`}
            active={activeStatus === value}
          />
        ))}
      </nav>

      {quotes.length === 0 ? (
        <EmptyState
          title="Nicio ofertă aici"
          description="Creează prima ofertă: alegi clientul, adaugi produse din catalog și exporți PDF-ul."
          action={
            <Link href="/oferte/nou" className="btn btn-primary">
              Ofertă nouă
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="table-head">Număr</th>
                <th className="table-head">Client</th>
                <th className="table-head">Emisă</th>
                <th className="table-head">Valabilă până</th>
                <th className="table-head">Stare</th>
                <th className="table-head text-right">Total cu TVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-neutral-50">
                  <td className="table-cell">
                    <Link
                      href={`/oferte/${quote.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {quote.number}
                    </Link>
                    {quote.title ? (
                      <p className="text-xs text-neutral-500">{quote.title}</p>
                    ) : null}
                  </td>
                  <td className="table-cell">{quote.clients?.name ?? "—"}</td>
                  <td className="table-cell text-neutral-500">{formatDate(quote.issue_date)}</td>
                  <td className="table-cell text-neutral-500">{formatDate(quote.valid_until)}</td>
                  <td className="table-cell">
                    <StatusBadge status={quote.status} />
                  </td>
                  <td className="table-cell text-right font-medium tabular-nums">
                    {formatMoney(totals.get(quote.id) ?? 0, quote.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "border-brand-200 bg-brand-50 text-brand-700"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {label}
    </Link>
  );
}
