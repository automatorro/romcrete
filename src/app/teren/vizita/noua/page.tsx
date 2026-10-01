import Link from "next/link";

import { startVisit } from "@/app/teren/actions";
import { CompanyFields } from "@/app/teren/company-fields";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { shortDay, todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { getDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import { TRADE_TYPES, lastVisitLabel, type ClientState } from "@/lib/teren";

export const metadata = { title: "Vizită nouă" };

export default async function VizitaNouaPage(props: PageProps<"/teren/vizita/noua">) {
  const { orgId } = await requireOrg();
  const { q, nou, data: ziParam } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const firmaNoua = nou === "1";
  // Din „Vizitele mele”: vizita se trece pe o zi trecută, din agenda de hârtie.
  const today = todayRo();
  const zi = typeof ziParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ziParam) && ziParam < today ? ziParam : null;
  const dateField = zi ? <input type="hidden" name="visit_date" value={zi} /> : null;
  const withDay = (params: Record<string, string>) => {
    const p = new URLSearchParams(params);
    if (zi) p.set("data", zi);
    const s = p.toString();
    return s ? `/teren/vizita/noua?${s}` : "/teren/vizita/noua";
  };
  const dayNotice = zi ? (
    <p className="card mt-3 p-3 text-sm">
      Vizita se trece pe <b className="capitalize">{shortDay(zi)}</b>. Ziua se poate schimba și din formularul vizitei.
    </p>
  ) : null;

  const supabase = await createClient();
  type Row = Pick<ClientState, "client_id" | "name" | "city" | "contact_person" | "last_visit">;
  const cols = "client_id, name, city, contact_person, last_visit";

  // Sub căutare: ce s-a găsit sau, fără căutare, ultimele firme vizitate.
  // Ordinea se cere bazei, nu se face după limită: altfel ieșeau 25 la întâmplare.
  let query = supabase.from("client_state").select(cols).eq("org_id", orgId);
  query = search
    ? query
        .or(`name.ilike.%${search}%,city.ilike.%${search}%,contact_person.ilike.%${search}%,cui.ilike.%${search}%`)
        .order("name")
        .limit(25)
    : query.order("last_visit", { ascending: false, nullsFirst: false }).limit(6);

  const [domains, { data }, { data: allData }] = await Promise.all([
    getDomains(orgId),
    query,
    // Lista derulantă cu toate firmele, în ordine alfabetică.
    supabase.from("client_state").select("client_id, name, city").eq("org_id", orgId).order("name").limit(2000),
  ]);
  const rows = (data ?? []) as Row[];
  const allFirms = (allData ?? []) as Pick<ClientState, "client_id" | "name" | "city">[];

  if (firmaNoua) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={{ href: withDay({}), label: "Înapoi" }} title="Firmă / meseriaș nou" />
        {dayNotice}

        <form action={startVisit} className="card mt-3 space-y-3 p-3.5">
          {dateField}
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
      <PageHeader
        title="Cu cine ai vorbit?"
        back={zi ? { href: `/teren/vizite?tip=saptamana&data=${zi}`, label: "Vizitele mele" } : undefined}
      />
      {dayNotice}

      <form className="my-3">
        {zi ? <input type="hidden" name="data" value={zi} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Caută firma, persoana de contact sau CUI-ul"
          autoComplete="off"
          className="input"
        />
      </form>

      {allFirms.length ? (
        <form action={startVisit} className="card mb-3 space-y-2 p-3">
          {dateField}
          <label htmlFor="client_id" className="text-sm font-medium text-neutral-700">
            Sau alege din toate firmele ({allFirms.length})
          </label>
          <div className="flex gap-2">
            {/* Pe telefon se deschide alegătorul sistemului: o listă lungă, derulată cu degetul. */}
            <select id="client_id" name="client_id" required defaultValue="" className="input min-h-12 min-w-0 flex-1">
              <option value="" disabled>
                Alege firma…
              </option>
              {allFirms.map((f) => (
                <option key={f.client_id} value={f.client_id}>
                  {f.name}
                  {f.city ? ` — ${f.city}` : ""}
                </option>
              ))}
            </select>
            <SubmitButton className="btn btn-primary btn-lg shrink-0" pendingLabel="…">
              Începe
            </SubmitButton>
          </div>
        </form>
      ) : null}

      <Link href={withDay({ nou: "1" })} className="btn btn-secondary btn-lg w-full lg:w-auto">
        ＋ Firmă / meseriaș nou
      </Link>

      {rows.length ? (
        <h2 className="mt-4 mb-1.5 text-sm font-semibold text-neutral-700">
          {search ? `Găsite pentru „${search}”` : "Vizitate recent"}
        </h2>
      ) : null}
      <ul className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.client_id}>
            <form action={startVisit}>
              <input type="hidden" name="client_id" value={r.client_id} />
              {dateField}
              <button type="submit" className="card h-full w-full p-3 text-left">
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
