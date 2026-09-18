import Link from "next/link";

import { createCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { EmptyState } from "@/components/empty-state";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/totals";
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-concrete-900">Catalog</h1>
        <p className="mt-1 text-sm text-concrete-500">
          Produsele și serviciile pe care le poți adăuga pe ofertă cu un click.
        </p>
      </header>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          + Adaugă produs sau serviciu
        </summary>
        <div className="mt-4 border-t border-concrete-200 pt-4">
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
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-concrete-200 bg-concrete-50">
              <tr>
                <th className="table-head">Denumire</th>
                <th className="table-head">Categorie</th>
                <th className="table-head">UM</th>
                <th className="table-head text-right">Preț fără TVA</th>
                <th className="table-head text-right">TVA</th>
                <th className="table-head" />
              </tr>
            </thead>
            <tbody className="divide-y divide-concrete-200">
              {items.map((item) => (
                <tr key={item.id} className={item.is_active ? "hover:bg-concrete-50" : "bg-concrete-50/60 opacity-60"}>
                  <td className="table-cell">
                    <span className="font-medium">{item.name}</span>
                    {item.sku ? (
                      <span className="ml-2 text-xs text-concrete-500">{item.sku}</span>
                    ) : null}
                    {item.is_active ? null : (
                      <span className="ml-2 text-xs text-concrete-500">(inactiv)</span>
                    )}
                  </td>
                  <td className="table-cell text-concrete-500">{item.category ?? "—"}</td>
                  <td className="table-cell text-concrete-500">{item.unit}</td>
                  <td className="table-cell text-right tabular-nums">
                    {formatMoney(item.unit_price)}
                  </td>
                  <td className="table-cell text-right tabular-nums text-concrete-500">
                    {item.vat_rate}%
                  </td>
                  <td className="table-cell text-right">
                    <Link
                      href={`/catalog/${item.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      Editează
                    </Link>
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
