import { ReportEditor } from "@/components/raport/report-editor";

export const metadata = { title: "Raport" };

export default async function RaportSalvatPage(props: PageProps<"/rapoarte/[id]">) {
  const { id } = await props.params;
  return <ReportEditor id={id} zona="birou" />;
}
