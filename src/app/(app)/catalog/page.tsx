import Link from "next/link";

import { createCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogBrowser, type BrowserItem } from "@/app/(app)/catalog/catalog-browser";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/toate-randurile";

export const metadata = { title: "Catalog" };

export default async function CatalogPage(props: PageProps<"/catalog">) {
  const { orgId, organization, role } = await requireOrg();
  const { q } = await props.searchParams;

  const supabase = await createClient();
  const [rows, photos] = await Promise.all([
    allRows((from, to) =>
      supabase
        .from("catalog_items")
        .select("id, sku, name, description, category, unit, unit_price, vat_rate, is_active, price_on_request, tech_type, materials")
        .eq("org_id", orgId)
        .order("category", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase.from("catalog_images").select("catalog_item_id").eq("org_id", orgId).order("catalog_item_id").range(from, to),
    ),
  ]);
  const withPhoto = new Set(photos.map((p) => p.catalog_item_id as string));
  const items = rows.map((i) => ({ ...i, has_photo: withPhoto.has(i.id as string) })) as BrowserItem[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog"
        description="Produsele și serviciile pe care le poți adăuga pe ofertă cu un click."
        actions={
          role !== "agent" ? (
            <Link href="/catalog/import" className="btn btn-secondary">
              Import din magazin
            </Link>
          ) : null
        }
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
        <CatalogBrowser items={items} initialQuery={typeof q === "string" ? q : ""} />
      )}
    </div>
  );
}
