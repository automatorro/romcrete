import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteCatalogItem, updateCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { SubmitButton } from "@/components/submit-button";
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
      <div>
        <Link href="/catalog" className="text-sm text-brand-700 hover:underline">
          ← Tot catalogul
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-concrete-900">{item.name}</h1>
      </div>

      <div className="card p-6">
        <CatalogForm
          action={updateCatalogItem.bind(null, item.id)}
          item={item}
          defaultVatRate={organization.vat_rate}
        />
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-concrete-500">
          Ștergerea nu afectează ofertele emise — liniile lor păstrează denumirea și prețul de atunci.
        </p>
        <form action={deleteCatalogItem}>
          <input type="hidden" name="id" value={item.id} />
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Se șterge…"
            confirm={`Ștergi „${item.name}” din catalog?`}
          >
            Șterge din catalog
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
