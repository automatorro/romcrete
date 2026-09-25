import { notFound } from "next/navigation";

import { OfferSheet } from "@/components/oferta/offer-sheet";
import { requireOrg } from "@/lib/auth";
import { loadOfferDocument } from "@/lib/oferta-document";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ofertă — tipărire" };

/**
 * Oferta tipărită, după modelul Romcrete: antetul firmei, cine face oferta și
 * pentru cine, produsele unul sub altul cu fișa și prețul fiecăruia, totalul
 * doar la cerere, condițiile, semnătura agentului și ștampila.
 */
export default async function QuotePrintPage(props: PageProps<"/print/oferta/[id]">) {
  const { id } = await props.params;
  // În PDF-ul generat pe server subsolul cu datele firmei se repetă pe fiecare
  // pagină (îl pune Chrome); în pagina din browser apare o dată, la final.
  const { pdf } = await props.searchParams;
  const { organization, user } = await requireOrg();

  const supabase = await createClient();
  const doc = await loadOfferDocument(supabase, id, organization, user);
  if (!doc) notFound();

  return <OfferSheet doc={doc} pdf={Boolean(pdf)} />;
}
