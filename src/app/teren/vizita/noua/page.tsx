import Link from "next/link";

import { startVisit } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TRADE_TYPES, lastVisitLabel, type ClientState } from "@/lib/teren";

export const metadata = { title: "Vizită nouă" };

export default async function VizitaNouaPage(props: PageProps<"/teren/vizita/noua">) {
  const { orgId } = await requireOrg();
  const { q, nou } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const firmaNoua = nou === "1";

  const supabase = await createClient();
  let query = supabase
    .from("client_state")
    .select("client_id, name, city, last_visit")
    .eq("org_id", orgId)
    .limit(25);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);

  const { data } = await query;
  const rows = (data ?? []) as Pick<ClientState, "client_id" | "name" | "city" | "last_visit">[];
  rows.sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? ""));

  if (firmaNoua) {
    return (
      <div>
        <Link href="/teren/vizita/noua" className="text-sm text-brand-700 hover:underline">
          ← Înapoi
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Firmă / meseriaș nou</h1>

        <form action={startVisit} className="card mt-3 space-y-3 p-3.5">
          <div>
            <label className="label" htmlFor="name">
              Nume *
            </label>
            <input id="name" name="name" required autoComplete="off" className="input" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="city">
                Localitate
              </label>
              <input id="city" name="city" className="input" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="phone">
                Telefon
              </label>
              <input id="phone" name="phone" type="tel" className="input" />
            </div>
          </div>

          <fieldset>
            <legend className="label">Ce este</legend>
            <div className="flex flex-wrap gap-2">
              {TRADE_TYPES.map((t) => (
                <label key={t.id} className="chip has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white">
                  <input type="radio" name="trade_type" value={t.id} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton className="btn btn-primary w-full" pendingLabel="Se deschide…">
            Începe vizita
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Cu cine ai vorbit?</h1>

      <form className="my-3">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Caută firma sau meseriașul"
          autoComplete="off"
          className="input"
        />
      </form>

      <Link href="/teren/vizita/noua?nou=1" className="btn btn-primary w-full">
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
                <p className="text-xs text-neutral-500">{lastVisitLabel(r.last_visit)}</p>
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
