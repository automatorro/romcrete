import { ReportsHub } from "@/components/raport/reports-hub";

export const metadata = { title: "Rapoarte" };

export default async function RapoartePage(props: PageProps<"/rapoarte">) {
  return <ReportsHub zona="birou" search={await props.searchParams} />;
}
