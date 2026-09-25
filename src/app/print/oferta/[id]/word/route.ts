import { requireOrg } from "@/lib/auth";
import { loadOfferDocument } from "@/lib/oferta-document";
import { missingPhotos, offerFileName } from "@/lib/oferta-http";
import { buildOfferDocx } from "@/lib/oferta-word";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Oferta ca document Word, cu același conținut ca PDF-ul, ca agentul să o
 * poată modifica înainte de trimitere. Fără poze nu se generează, ca PDF-ul.
 */
export async function GET(_request: Request, ctx: RouteContext<"/print/oferta/[id]/word">) {
  const { organization, user } = await requireOrg();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const doc = await loadOfferDocument(supabase, id, organization, user);
  if (!doc) return new Response("Oferta nu există sau nu ai acces la ea.", { status: 404 });
  if (doc.missing.length) return missingPhotos(doc.quote.number, id, doc.missing);

  const file = await buildOfferDocx(doc);
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${offerFileName(doc.quote.number, "docx")}"`,
      "cache-control": "private, no-store",
    },
  });
}
