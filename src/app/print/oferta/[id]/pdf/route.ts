import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
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
  await requireOrg();
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
  if (missing.length) {
    const message = `Oferta ${quote.number} nu se poate trimite: lipsește poza pentru ${missing.join(", ")}.`;
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
        `<body style="font-family:system-ui;padding:24px;max-width:560px;margin:auto">` +
        `<h1 style="font-size:20px">Lipsesc poze</h1><p>${escapeHtml(message)}</p>` +
        `<p>Pune poza din pagina ofertei, la „Poze lipsă”, apoi încearcă din nou.</p>` +
        `<p><a href="/oferte/${id}">Înapoi la ofertă</a></p></body>`,
      {
        status: 422,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-poze-lipsa": encodeURIComponent(missing.join(" | ")),
          "cache-control": "no-store",
        },
      },
    );
  }

  const pdf = await renderPdf(`${request.nextUrl.origin}/print/oferta/${id}`, request.cookies.getAll());
  const file = `Oferta-${String(quote.number).replace(/[^\w.-]+/g, "-")}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "private, no-store",
    },
  });
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
