import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
import { companyFooter } from "@/lib/oferta-document";
import { escapeHtml, missingPhotos, offerFileName } from "@/lib/oferta-http";
import { renderPdf } from "@/lib/pdf-server";
import { loadQuoteSheets } from "@/lib/poze";
import { createClient } from "@/lib/supabase/server";
import type { QuoteItem } from "@/lib/types";

// Chrome are nevoie de Node și de câteva secunde, nu de runtime-ul edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Oferta ca fișier PDF: aceeași pagină de tipărire, generată pe server, ca să
 * poată fi atașată direct pe WhatsApp sau descărcată dintr-o apăsare.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/print/oferta/[id]/pdf">) {
  const { organization } = await requireOrg();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const [{ data: quote }, { data: items }] = await Promise.all([
    supabase.from("quotes").select("number").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
  ]);
  if (!quote) return new Response("Oferta nu există sau nu ai acces la ea.", { status: 404 });

  // Oferta nu pleacă fără poze: le descarcă și le păstrează acum, iar dacă tot
  // lipsește vreuna, refuză PDF-ul și spune care.
  const { missing } = await loadQuoteSheets(supabase, (items ?? []) as QuoteItem[]);
  if (missing.length) return missingPhotos(quote.number as string, id, missing);

  const pdf = await renderPdf(`${request.nextUrl.origin}/print/oferta/${id}?pdf=1`, request.cookies.getAll(), {
    footerHtml: footerTemplate(companyFooter(organization)),
  });
  const file = offerFileName(quote.number as string, "pdf");

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "private, no-store",
    },
  });
}


/**
 * Subsolul fiecărei pagini, ca în oferta model: datele firmei și numărul
 * paginii. Chrome îl desenează separat de pagină, deci stilurile sunt inline.
 */
function footerTemplate(footer: { title: string; lines: string[] }) {
  const line = (text: string) => `<div>${escapeHtml(text)}</div>`;
  return (
    `<div style="width:100%;margin:0 12mm;padding-top:2mm;border-top:0.5pt solid #9ca3af;` +
    `font-family:'Open Sans',Arial,sans-serif;font-size:7.5pt;line-height:1.35;color:#404040;text-align:center;` +
    `-webkit-print-color-adjust:exact">` +
    `<div style="font-weight:700;color:#111">${escapeHtml(footer.title)}</div>` +
    footer.lines.map(line).join("") +
    `<div style="margin-top:1mm;color:#737373">Pagina <span class="pageNumber"></span> din <span class="totalPages"></span></div>` +
    `</div>`
  );
}
