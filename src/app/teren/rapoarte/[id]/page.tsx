import { ReportEditor } from "@/components/raport/report-editor";

export const metadata = { title: "Raport" };

export default async function TerenRaportPage(props: PageProps<"/teren/rapoarte/[id]">) {
  const { id } = await props.params;
  const { eroare } = await props.searchParams;
  return <ReportEditor id={id} zona="teren" eroare={typeof eroare === "string" ? eroare : undefined} />;
}
