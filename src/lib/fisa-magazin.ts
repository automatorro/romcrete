import { pickSheet, type ProductSheetTexts } from "@/lib/fisa-produs";
import { shopTexts } from "@/lib/oferta-print";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

const SHOP_FIELDS = ["intro", "package_contents", "benefits", "recommendations", "applications"] as const;

/**
 * Fișa unui produs pus pe o ofertă nouă: textele din catalog, iar ce lipsește
 * se ia din descrierea lui din magazin. Ce s-a găsit se păstrează și în catalog
 * (doar în câmpurile goale), ca oferta următoare să nu mai aștepte magazinul.
 */
export async function sheetForNewLine(
  db: Db,
  row: Partial<Record<string, unknown>> & { id: string; shop_url?: string | null; is_service?: boolean | null },
): Promise<ProductSheetTexts> {
  const sheet = pickSheet(row);
  const missing = SHOP_FIELDS.filter((field) => !sheet[field]?.trim());
  if (row.is_service || !row.shop_url || !missing.length) return sheet;

  const found = await shopTexts(row.shop_url).catch(() => null);
  if (!found) return sheet;

  const added = missing.filter((field) => found[field]);
  if (!added.length) return sheet;
  for (const field of added) sheet[field] = found[field];

  // Dacă funcția nu există încă (migrare nerulată), oferta primește totuși textele.
  await db.rpc("fill_catalog_sheet", {
    p_item: row.id,
    p_intro: found.intro,
    p_package_contents: found.package_contents,
    p_benefits: found.benefits,
    p_recommendations: found.recommendations,
    p_applications: found.applications,
  });
  return sheet;
}
