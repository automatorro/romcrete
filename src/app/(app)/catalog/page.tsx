import Link from "next/link";

import { createCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { DataList } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCatalogPrice } from "@/lib/totals";
import type { CatalogItem } from "@/lib/types";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const { orgId, organization } = await requireOrg();

  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("org_id", orgId)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  const items = (data ?? []) as CatalogItem[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog"
        description="Produsele și serviciile pe care le poți adăuga pe ofertă cu un click."
      />

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          + Adaugă produs sau serviciu
        </summary>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <CatalogForm
            action={createCatalogItem}
            defaultVatRate={organization.vat_rate}
            submitLabel="Adaugă în catalog"
            resetOnSuccess
          />
        </div>
      </details>

      {items.length === 0 ? (
        <EmptyState
          title="Catalog gol"
          description="Adaugă primele produse ca să poți construi oferte rapid."
        />
      ) : (
        <DataList
          rows={items}
          rowKey={(i) => i.id}
          muted={(i) => !i.is_active}
          title={(i) => (
            <Link href={`/catalog/${i.id}`} className="hover:underline">
              {i.name}
              {i.is_active ? null : <span className="ml-2 text-xs font-normal text-neutral-500">(inactiv)</span>}
            </Link>
          )}
          columns={[
            {
              header: "Denumire",
              hideOnMobile: true,
              cell: (i) => (
                <>
                  <span className="font-medium">{i.name}</span>
                  {i.sku ? <span className="ml-2 text-xs text-neutral-500">{i.sku}</span> : null}
                  {i.is_active ? null : <span className="ml-2 text-xs text-neutral-500">(inactiv)</span>}
                </>
              ),
            },
            { header: "Categorie", className: "text-neutral-500", cell: (i) => i.category ?? "—" },
            { header: "UM", className: "text-neutral-500", cell: (i) => i.unit },
            {
              header: "Preț fără TVA",
              className: "text-right tabular-nums",
              cell: (i) => formatCatalogPrice(i.unit_price, i.price_on_request),
            },
            { header: "TVA", className: "text-right tabular-nums text-neutral-500", cell: (i) => `${i.vat_rate}%` },
          ]}
          actions={(i) => (
            <Link href={`/catalog/${i.id}`} className="btn btn-secondary btn-sm">
              Editează
            </Link>
          )}
        />
      )}
    </div>
  );
}
