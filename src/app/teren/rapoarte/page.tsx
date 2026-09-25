import { ReportsHub } from "@/components/raport/reports-hub";

export const metadata = { title: "Rapoartele mele" };

/** Pe teren: raportul propriu, zilnic sau săptămânal, de trimis șefului. */
export default async function TerenRapoartePage(props: PageProps<"/teren/rapoarte">) {
  return <ReportsHub zona="teren" search={await props.searchParams} />;
}
