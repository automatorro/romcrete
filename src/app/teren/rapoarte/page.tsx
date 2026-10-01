import { ReportsHub } from "@/components/raport/reports-hub";

export const metadata = { title: "Rapoartele mele" };

/** Pe teren: raportul propriu — fișa zilei pentru centralizare, săptămâna și luna de trimis. */
export default async function TerenRapoartePage(props: PageProps<"/teren/rapoarte">) {
  return <ReportsHub zona="teren" search={await props.searchParams} />;
}
