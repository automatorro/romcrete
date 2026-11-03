import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { getAllDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";

import { addOccupation, confirmClassification } from "./actions";

export const metadata = { title: "Încadrarea firmelor" };

const PAGE_SIZE = 25;

type ClientRow = {
  id: string;
  name: string;
  city: string | null;
  domain: string | null;
  trade_type: string | null;
  occupation_id: string | null;
  classification_status: "needs_review" | "confirmed";
  classification_note: string | null;
  classified_at: string | null;
  classified_by: string | null;
};

type OccupationRow = { id: string; domain_id: string; label: string; active: boolean };

export default async function ClassificationPage(props: PageProps<"/setari/incadrare">) {
  const { orgId, role } = await requireOrg();
  if (role === "agent") notFound();

  const { status: rawStatus, pagina: rawPage, eroare } = await props.searchParams;
  const status = rawStatus === "all" || rawStatus === "confirmed" ? rawStatus : "needs_review";
  const page = Math.max(1, Number(rawPage) || 1);
  const domains = await getAllDomains(orgId);
  const supabase = await createClient();

  let clientQuery = supabase
    .from("clients")
    .select(
      "id, name, city, domain, trade_type, occupation_id, classification_status, classification_note, classified_at, classified_by",
      { count: "exact" },
    )
    .eq("org_id", orgId)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") clientQuery = clientQuery.eq("classification_status", status);

  const [clientsResult, occupationsResult, membershipsResult, pendingCountResult, totalCountResult] = await Promise.all([
    clientQuery,
    supabase
      .from("org_occupations")
      .select("id, domain_id, label, active")
      .eq("org_id", orgId)
      .order("domain_id")
      .order("label"),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("classification_status", "needs_review"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const migrationError = clientsResult.error ?? occupationsResult.error ?? pendingCountResult.error ?? totalCountResult.error;
  if (migrationError) {
    return (
      <div>
        <PageHeader back={{ href: "/setari", label: "Setări firmă" }} title="Încadrarea firmelor" />
        <div role="alert" className="notice-error">
          Revizuirea încadrărilor nu este disponibilă. Aplică manual migrarea
          {" "}<code>20261103100000_clasificare_firme.sql</code> în Supabase, apoi reîncarcă pagina.
        </div>
      </div>
    );
  }

  const clients = (clientsResult.data ?? []) as ClientRow[];
  const occupations = (occupationsResult.data ?? []) as OccupationRow[];
  const members = membershipsResult.data ?? [];
  const domainNames = new Map(domains.map((domain) => [domain.id, domain.label]));
  const memberNames = new Map(members.map((member) => [member.user_id as string, member.full_name as string | null]));
  const occupationNames = new Map(occupations.map((occupation) => [occupation.id, occupation.label]));
  const pendingCount = pendingCountResult.count ?? 0;
  const totalCount = totalCountResult.count ?? clients.length;
  const filteredCount = clientsResult.count ?? clients.length;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const activeOccupations = occupations.filter((occupation) => occupation.active);
  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status !== "needs_review") params.set("status", status);
    if (nextPage > 1) params.set("pagina", String(nextPage));
    const query = params.toString();
    return query ? `/setari/incadrare?${query}` : "/setari/incadrare";
  };

  return (
    <div>
      <PageHeader
        back={{ href: "/setari", label: "Setări firmă" }}
        title="Încadrarea firmelor"
        description={`${pendingCount} de revizuit · ${totalCount} firme în total`}
      />

      {pendingCount > 0 ? (
        <p className="hint mb-4">
          Firmele de revizuit își păstrează domeniul actual și continuă să intre în rapoarte conform acelei valori.
          Compară rezultatele pe domenii după ce ai verificat baza.
        </p>
      ) : null}

      {typeof eroare === "string" && eroare ? (
        <p role="alert" className="notice-error mb-3">{eroare}</p>
      ) : null}

      <section className="mb-5">
        <h2 className="text-base font-semibold">Vocabularul ocupațiilor</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Catalogul pornește gol. Adaugă doar denumiri validate din portofoliul real; nu modifică etichetele istorice.
        </p>
        <form action={addOccupation} className="mt-3 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(14rem,2fr)_auto]">
          <label className="sr-only" htmlFor="occupation-domain">Domeniu</label>
          <select id="occupation-domain" name="domain_id" required defaultValue="" className="input">
            <option value="" disabled>Alege domeniul…</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.label}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="occupation-label">Ocupație</label>
          <input
            id="occupation-label"
            name="label"
            required
            minLength={2}
            maxLength={100}
            className="input"
            placeholder="Denumirea validată a ocupației"
          />
          <SubmitButton className="btn btn-secondary" pendingLabel="Se salvează…">Adaugă ocupația</SubmitButton>
        </form>
        {occupations.length ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            {occupations.map((occupation) => (
              <li key={occupation.id}>
                {domainNames.get(occupation.domain_id) ?? occupation.domain_id}: {occupation.label}
                {!occupation.active ? " · inactivă" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Revizuirea firmelor</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Confirmarea actualizează domeniul folosit de aplicație și păstrează o urmă a schimbării.
            </p>
          </div>
          <form>
            <label htmlFor="classification-status" className="sr-only">Filtrează după stare</label>
            <select
              id="classification-status"
              name="status"
              defaultValue={status}
              className="input min-w-44"
            >
              <option value="needs_review">De revizuit</option>
              <option value="confirmed">Confirmate</option>
              <option value="all">Toate</option>
            </select>
            <button type="submit" className="btn btn-secondary ml-2">Aplică</button>
          </form>
        </div>

        {!activeOccupations.length ? (
          <p className="notice-info mt-3">
            Adaugă mai întâi ocupațiile validate. Până atunci, firmele și domeniile lor existente rămân neschimbate.
          </p>
        ) : null}

        {clients.length ? (
          <ul className="mt-3 space-y-2">
            {clients.map((client) => (
              <li key={client.id} className="card p-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <b>{client.name}</b>
                  <span className="text-sm text-neutral-500">{client.city ?? ""}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-600">
                  Acum: {domainNames.get(client.domain ?? "") ?? client.domain ?? "domeniu lipsă"}
                  {client.trade_type ? ` · meserie istorică: ${client.trade_type}` : " · fără meserie istorică"}
                  {client.occupation_id ? ` · ocupație: ${occupationNames.get(client.occupation_id) ?? "inactivă"}` : ""}
                </p>
                {client.classified_at ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    Confirmată {new Date(client.classified_at).toLocaleDateString("ro-RO")}
                    {client.classified_by ? ` de ${memberNames.get(client.classified_by) ?? "membru al conducerii"}` : ""}
                  </p>
                ) : null}
                {client.classification_note ? (
                  <p className="mt-1 text-xs text-neutral-600">Notă: {client.classification_note}</p>
                ) : null}
                <form action={confirmClassification} className="mt-3 grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_minmax(12rem,1fr)_auto]">
                  <input type="hidden" name="client_id" value={client.id} />
                  <label className="sr-only" htmlFor={`occupation-${client.id}`}>Ocupația firmei</label>
                  <select
                    id={`occupation-${client.id}`}
                    name="occupation_id"
                    required
                    defaultValue={client.occupation_id ?? ""}
                    className="input"
                  >
                    <option value="" disabled>Alege domeniul și ocupația…</option>
                    {domains.map((domain) => {
                      const options = activeOccupations.filter((occupation) => occupation.domain_id === domain.id);
                      return options.length ? (
                        <optgroup key={domain.id} label={domain.label}>
                          {options.map((occupation) => (
                            <option key={occupation.id} value={occupation.id}>{occupation.label}</option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                  <label className="sr-only" htmlFor={`note-${client.id}`}>Notă de încadrare</label>
                  <input
                    id={`note-${client.id}`}
                    name="classification_note"
                    maxLength={500}
                    defaultValue={client.classification_note ?? ""}
                    className="input"
                    placeholder="Notă opțională pentru audit"
                  />
                  <SubmitButton className="btn btn-primary" pendingLabel="Se confirmă…">Confirmă încadrarea</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card mt-3 p-4 text-sm text-neutral-600">Nu sunt firme pentru filtrul ales.</p>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Paginarea firmelor" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link className="btn btn-secondary" href={makeHref(page - 1)}>Pagina anterioară</Link> : <span />}
            <span className="text-neutral-600">Pagina {page} din {pageCount}</span>
            {page < pageCount ? <Link className="btn btn-secondary" href={makeHref(page + 1)}>Pagina următoare</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </div>
  );
}