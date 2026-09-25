import { QuoteWorkspace } from "@/components/oferta/quote-workspace";

export const metadata = { title: "Ofertă" };

/** Oferta pe telefon: aceeași ca la birou, în interfața de teren. */
export default async function TerenOfertaPage(props: PageProps<"/teren/oferta/[id]">) {
  const { id } = await props.params;
  return <QuoteWorkspace id={id} zona="teren" />;
}
