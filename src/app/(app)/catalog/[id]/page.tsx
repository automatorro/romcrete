import { notFound } from "next/navigation";

import { deleteCatalogItem, updateCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/lib/types";

export const metadata = { title: "Editare produs" };

export default async function CatalogItemPage(props: PageProps<"/catalog/[id]">) {
  const { id } = await props.params;
  const { organization } = await requireOrg();

  const supabase = await createClient();
  const { data } = await supabase.from("catalog_items").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();
  const item = data as CatalogItem;

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/catalog", label: "Tot catalogul" }} title={item.name} />

      <div className="card p-6">
        <CatalogForm
          action={updateCatalogItem.bind(null, item.id)}
          item={item}
          defaultVatRate={organization.vat_rate}
        />
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-500">
          Ștergerea nu afectează ofertele emise — liniile lor păstrează denumirea și prețul de atunci.
        </p>
        <form action={deleteCatalogItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Se șterge…"
            confirmLabel="Da, șterge"
            confirm={`Ștergi „${item.name}” din catalog?`}
          >
            Șterge din catalog
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
