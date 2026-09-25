import Link from "next/link";

import { startVisit } from "@/app/teren/actions";
import { CompanyFields } from "@/app/teren/company-fields";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { getDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import { TRADE_TYPES, lastVisitLabel, type ClientState } from "@/lib/teren";

export const metadata = { title: "Vizită nouă" };

export default async function VizitaNouaPage(props: PageProps<"/teren/vizita/noua">) {
  const { orgId } = await requireOrg();
  const { q, nou } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const firmaNoua = nou === "1";

  const supabase = await createClient();
  const domains = await getDomains(orgId);
  let query = supabase
    .from("client_state")
    .select("client_id, name, city, contact_person, last_visit")
    .eq("org_id", orgId)
    .limit(25);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,city.ilike.%${search}%,contact_person.ilike.%${search}%,cui.ilike.%${search}%`,
    );
  }

  const { data } = await query;
  const rows = (data ?? []) as Pick<ClientState, "client_id" | "name" | "city" | "contact_person" | "last_visit">[];
  rows.sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? ""));

  if (firmaNoua) {
    return (
      <div>
        <PageHeader back={{ href: "/teren/vizita/noua", label: "Înapoi" }} title="Firmă / meseriaș nou" />

        <form action={startVisit} className="card mt-3 space-y-3 p-3.5">
          <CompanyFields />

          <fieldset>
            <legend className="label">În ce domeniu lucrează</legend>
            <div className="flex flex-wrap gap-2">
              {domains.map((d, i) => (
                <label
                  key={d.id}
                  className="chip has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
                >
                  <input
                    type="radio"
                    name="domain"
                    value={d.id}
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  {d.short_label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              De aici pornesc întrebările din vizită, unitatea în care se socotește randamentul
              și pompele care i se potrivesc.
            </p>
          </fieldset>

          <fieldset>
            <legend className="label">Ce este (la construcții)</legend>
            <div className="flex flex-wrap gap-2">
              {TRADE_TYPES.map((t) => (
                <label key={t.id} className="chip has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white">
                  <input type="radio" name="trade_type" value={t.id} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Se deschide…">
            Începe vizita
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cu cine ai vorbit?" />

      <form className="my-3">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Caută firma, persoana de contact sau CUI-ul"
          autoComplete="off"
          className="input"
        />
      </form>

      <Link href="/teren/vizita/noua?nou=1" className="btn btn-primary btn-lg w-full">
        ＋ Firmă / meseriaș nou
      </Link>

      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.client_id}>
            <form action={startVisit}>
              <input type="hidden" name="client_id" value={r.client_id} />
              <button type="submit" className="card w-full p-3 text-left">
                <b className="text-[15px]">{r.name}</b>{" "}
                <span className="text-sm text-neutral-500">{r.city ?? ""}</span>
                <p className="text-xs text-neutral-500">
                  {[r.contact_person, lastVisitLabel(r.last_visit)].filter(Boolean).join(" · ")}
                </p>
              </button>
            </form>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          {search ? "Nicio firmă găsită. Poți crea una nouă." : "Încă nicio firmă."}
        </p>
      ) : null}
    </div>
  );
}
