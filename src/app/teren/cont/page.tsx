import { OfferProfileCard } from "@/components/cont/offer-profile-card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Datele mele pe ofertă" };

export default function ContPage() {
  return (
    <div>
      <PageHeader back={{ href: "/teren/mai-mult", label: "Mai mult" }} title="Datele mele pe ofertă" />
      <OfferProfileCard />
    </div>
  );
}
