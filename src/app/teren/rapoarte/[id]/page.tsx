import { ReportEditor } from "@/components/raport/report-editor";

export const metadata = { title: "Raport" };

export default async function TerenRaportPage(props: PageProps<"/teren/rapoarte/[id]">) {
  const { id } = await props.params;
  return <ReportEditor id={id} zona="teren" />;
}
