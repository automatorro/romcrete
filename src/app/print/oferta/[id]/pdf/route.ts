import type { NextRequest } from "next/server";

import { requireOrg } from "@/lib/auth";
import { renderPdf } from "@/lib/pdf-server";
import { createClient } from "@/lib/supabase/server";

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
  const { data: quote } = await supabase.from("quotes").select("number").eq("id", id).maybeSingle();
  if (!quote) return new Response("Oferta nu există sau nu ai acces la ea.", { status: 404 });

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
