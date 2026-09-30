import { redirect } from "next/navigation";

import { ImportWizard } from "@/app/(app)/catalog/import/import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import type { ExistingItem } from "@/lib/catalog-import";
import { SHOP_ORIGIN } from "@/lib/magazin-import";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/toate-randurile";

export const metadata = { title: "Import din magazin" };

// Fiecare pas (câteva pagini citite, un calup scris, câteva poze) are timp să se termine.
export const maxDuration = 60;

export default async function ImportPage() {
  const { orgId, organization, role } = await requireOrg();
  if (role === "agent") redirect("/catalog");

  const supabase = await createClient();
  const [existing, photos] = await Promise.all([
    allRows((from, to) =>
      supabase
        .from("catalog_items")
        .select("id, sku, name, category, shop_url, unit_price, vat_rate, price_on_request, price_with_vat, is_active, details, is_service")
        .eq("org_id", orgId)
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase.from("catalog_images").select("catalog_item_id").eq("org_id", orgId).order("catalog_item_id").range(from, to),
    ),
  ]);
  const withPhoto = new Set(photos.map((p) => p.catalog_item_id as string));
  const missingPhotos = existing.filter((i) => !i.is_service && i.shop_url && !withPhoto.has(i.id as string)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/catalog", label: "Catalog" }}
        title="Import din magazin"
        description={
          <>
            Citește tot catalogul de pe {SHOP_ORIGIN.replace("https://", "")}, arată ce se schimbă și abia apoi
            scrie. Nu șterge nimic și nu schimbă numele, categoriile, materialele sau fișele scrise de mână.
          </>
        }
      />
      <ImportWizard
        existing={existing as unknown as ExistingItem[]}
        vatRate={Number(organization.vat_rate) || 21}
        photos={{ saved: withPhoto.size, missing: missingPhotos }}
      />
    </div>
  );
}
