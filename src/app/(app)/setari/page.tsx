import { OrganizationForm } from "@/app/(app)/setari/organization-form";
import { PraguriForm } from "@/app/(app)/setari/praguri-form";
import { getQuestionCatalogue } from "@/lib/questions";
import { requireOrg } from "@/lib/auth";

export const metadata = { title: "Setări firmă" };

export default async function SettingsPage() {
  const { orgId, organization, role } = await requireOrg();
  const sections = await getQuestionCatalogue(orgId);
  const grup = (id: string) => sections.flatMap((s) => s.groups).find((g) => g.id === id);

  const praguri = [
    {
      id: "manopera",
      label: "Cât ia pe mp",
      hint: "Valoarea folosită în calculul de amortizare — de regulă mijlocul intervalului, în lei.",
      options: grup("manopera")?.options ?? [],
    },
    {
      id: "supr",
      label: "Suprafață pe zi",
      hint: "Metri pătrați pe zi pe care îi presupunem pentru fiecare interval bifat.",
      options: grup("supr")?.options ?? [],
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Setări firmă</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Datele apar în antetul fiecărei oferte tipărite. Rolul tău: {role}.
        </p>
      </header>

      <div className="card p-6">
        <OrganizationForm organization={organization} />
      </div>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Praguri de calcul</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-500">
          Cifrele din spatele intervalelor bifate pe teren. Le schimbi când afli altceva din piață —
          calculul de amortizare se actualizează imediat, fără nicio altă modificare.
        </p>
        <div className="card p-6">
          <PraguriForm groups={praguri} />
        </div>
      </section>
    </div>
  );
}
