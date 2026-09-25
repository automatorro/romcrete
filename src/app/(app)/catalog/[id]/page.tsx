import { notFound } from "next/navigation";

import { deleteCatalogItem, updateCatalogItem } from "@/app/(app)/catalog/actions";
import { CatalogForm } from "@/app/(app)/catalog/catalog-form";
import { PhotoUpload } from "@/components/oferta/photo-upload";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";
import type { CatalogItem } from "@/lib/types";

export const metadata = { title: "Editare produs" };

export default async function CatalogItemPage(props: PageProps<"/catalog/[id]">) {
  const { id } = await props.params;
  const { organization } = await requireOrg();

  const supabase = await createClient();
  const [{ data }, { data: photo }] = await Promise.all([
    supabase.from("catalog_items").select("*").eq("id", id).maybeSingle(),
    supabase.from("catalog_images").select("mime, data_b64, source, updated_at").eq("catalog_item_id", id).maybeSingle(),
  ]);

  if (!data) notFound();
  const item = data as CatalogItem;

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/catalog", label: "Tot catalogul" }} title={item.name} />

      <section className="card flex flex-wrap items-center gap-4 p-4">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white p-1">
          {photo ? (
            // Poza păstrată în baza de date, exact cea care intră în PDF-ul ofertei.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${photo.mime};base64,${photo.data_b64}`}
              alt={item.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-xs text-neutral-500">fără poză</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium">Poza produsului pe oferte</p>
          <p className="text-sm text-neutral-500">
            {photo
              ? `${photo.source === "magazin" ? "Descărcată din magazin" : "Încărcată de mână"} pe ${formatDate(photo.updated_at as string)}. Intră în PDF-ul fiecărei oferte cu acest produs.`
              : item.shop_url || item.image_url
                ? "Se descarcă din magazin la prima ofertă. O poți pune și acum, de mână."
                : "Fără poză, produsul nu poate fi trimis pe ofertă. Pune poza aici."}
          </p>
          <PhotoUpload target="catalog" id={item.id} label={photo ? "Înlocuiește poza" : "Pune poza"} />
        </div>
      </section>

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
