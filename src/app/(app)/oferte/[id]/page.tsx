import { QuoteWorkspace } from "@/components/oferta/quote-workspace";

export const metadata = { title: "Ofertă" };

export default async function QuotePage(props: PageProps<"/oferte/[id]">) {
  const { id } = await props.params;
  return <QuoteWorkspace id={id} zona="birou" />;
}
