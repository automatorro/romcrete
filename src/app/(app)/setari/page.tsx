import { DomeniiForm, type DomainRow } from "@/app/(app)/setari/domenii-form";
import { OrganizationForm } from "@/app/(app)/setari/organization-form";
import { PraguriForm } from "@/app/(app)/setari/praguri-form";
import { TinteAgentiForm, type AgentTarget } from "@/app/(app)/setari/tinte-agenti-form";
import { createClient } from "@/lib/supabase/server";
import { getAllDomains } from "@/lib/domenii";
import { getQuestionCatalogue } from "@/lib/questions";
import { requireOrg } from "@/lib/auth";

export const metadata = { title: "Setări firmă" };

export default async function SettingsPage() {
  const { orgId, organization, role } = await requireOrg();
  const [sections, domenii] = await Promise.all([getQuestionCatalogue(orgId), getAllDomains(orgId)]);
  const supabase = await createClient();
  const { data: agentRows } = await supabase
    .from("memberships")
    .select("user_id, full_name, role, target_visits_per_day, target_quotes_per_month")
    .eq("org_id", orgId)
    .order("role");
  const grup = (id: string) => sections.flatMap((s) => s.groups).find((g) => g.id === id);

  // Intervalele sunt scrise pe domeniu: „60–100 mp” la construcții și
  // „2.000–5.000 ml” la marcaje sunt amândouă o zi bună, dar nu au ce căuta
  // în aceeași listă.
  const alDomeniului = (questionId: string, domainId: string) =>
    (grup(questionId)?.options ?? []).filter((o) => o.domains?.includes(domainId));

  const praguri = domenii.flatMap((d) => {
    const manopera = alDomeniului("manopera", d.id);
    const supr = alDomeniului("supr", d.id);
    return [
      ...(supr.length
        ? [{
            key: `supr_${d.id}`,
            questionId: "supr",
            label: `${d.short_label} — cât face pe zi`,
            hint: `Câți ${d.unit_label} pe zi presupunem pentru fiecare interval bifat.`,
            options: supr,
          }]
        : []),
      ...(manopera.length
        ? [{
            key: `manopera_${d.id}`,
            questionId: "manopera",
            label: `${d.short_label} — cât ia pe ${d.unit_short}`,
            hint: "Valoarea folosită în calculul de amortizare — de regulă mijlocul intervalului, în lei.",
            options: manopera,
          }]
        : []),
    ];
  });

  // Ce nu ține de niciun domeniu — „forfetar”, „nu știe” — rămâne la urmă.
  for (const questionId of ["supr", "manopera"] as const) {
    const options = (grup(questionId)?.options ?? []).filter((o) => !o.domains?.length);
    if (!options.length) continue;
    praguri.push({
      key: `comun_${questionId}`,
      questionId,
      label: questionId === "supr" ? "Comun — cât face pe zi" : "Comun — cât ia pe unitate",
      hint: "Opțiunile care apar în toate domeniile și nu intră în calcul.",
      options,
    });
  }

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
        <h2 className="text-lg font-semibold tracking-tight">Ținte personale</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-500">
          Lasă gol ca să se folosească ținta firmei. Completează doar unde vrei altceva — un om
          nou nu are de ce să aibă aceeași țintă cu unul cu cinci ani de teren.
        </p>
        <div className="card p-6">
          <TinteAgentiForm agents={(agentRows ?? []) as AgentTarget[]} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Domenii și randament</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-500">
          Romcrete vinde în toate domeniile, iar mecanizarea nu aduce același câștig peste tot.
          Randamentul de aici intră direct în calculul de amortizare arătat meseriașului pe teren.
        </p>
        <div className="card p-6">
          <DomeniiForm
            domains={domenii.map(
              (d): DomainRow => ({
                id: d.id,
                label: d.label,
                unit_label: d.unit_label,
                base: d.productivity_factor,
                override: d.override,
                active: d.active,
              }),
            )}
          />
        </div>
      </section>

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
