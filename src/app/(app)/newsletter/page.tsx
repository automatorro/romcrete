import Link from "next/link";

import { createNewsletter } from "@/app/(app)/newsletter/actions";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import type { Newsletter } from "@/lib/newsletter";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";

export const metadata = { title: "Newslettere" };

type SentRow = { client_id: string; occurred_at: string; meta: { newsletter_id?: string } };

export default async function NewslettersPage(props: PageProps<"/newsletter">) {
  const { orgId, role } = await requireOrg();
  const { eroare } = await props.searchParams;

  const supabase = await createClient();
  const [{ data, error }, { data: sentRows }, { data: members }] = await Promise.all([
    supabase.from("newsletters").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }),
    // Trimiterile pe care le vede fiecare: agentul pe firmele lui, conducerea pe toate.
    supabase
      .from("client_activities")
      .select("client_id, occurred_at, meta")
      .eq("org_id", orgId)
      .eq("kind", "newsletter")
      .limit(10000),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
  ]);
  const newsletters = (data ?? []) as Newsletter[];
  const who = new Map((members ?? []).map((m) => [m.user_id as string, (m.full_name as string | null) ?? "Coleg"]));

  const stats = new Map<string, { firms: Set<string>; last: string }>();
  for (const r of (sentRows ?? []) as SentRow[]) {
    const id = r.meta?.newsletter_id;
    if (!id) continue;
    const s = stats.get(id) ?? { firms: new Set<string>(), last: "" };
    s.firms.add(r.client_id);
    if (r.occurred_at > s.last) s.last = r.occurred_at;
    stats.set(id, s);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Newslettere și anunțuri"
        description={
          role === "agent"
            ? "Scrii mesajul o dată, vezi exact cum arată, apoi îl trimiți firmelor tale din Outlook sau pe WhatsApp."
            : "Scrii mesajul o dată, vezi exact cum arată, apoi îl trimiți firmelor echipei din Outlook sau pe WhatsApp."
        }
      />

      {typeof eroare === "string" && eroare ? (
        <p role="alert" className="notice-error">
          {eroare}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="notice-error">
          Newsletterele nu s-au putut citi: {error.message}. Dacă tabelul lipsește, rulează migrația
          „20260929090000_newslettere.sql”.
        </p>
      ) : null}

      <form action={createNewsletter} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="nl-title" className="label">
            Newsletter nou
          </label>
          <input
            id="nl-title"
            name="title"
            placeholder="ex. Promoție de toamnă la pompele airless"
            className="input"
          />
        </div>
        <SubmitButton className="btn btn-primary" pendingLabel="Se creează…">
          ＋ Scrie newsletterul
        </SubmitButton>
      </form>

      {newsletters.length === 0 ? (
        <EmptyState
          title="Niciun newsletter încă"
          description="Începe cu o noutate: un produs nou, o promoție, o invitație la demonstrație. Textul pornește dintr-un model gata de completat."
        />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {newsletters.map((n) => {
            const s = stats.get(n.id);
            return (
              <li key={n.id}>
                <Link href={`/newsletter/${n.id}`} className="card block p-4 hover:border-brand-300">
                  <p className="font-semibold text-neutral-900">{n.title}</p>
                  {n.subject && n.subject !== n.title ? (
                    <p className="mt-0.5 truncate text-sm text-neutral-700">Subiect: {n.subject}</p>
                  ) : null}
                  <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-neutral-500">{n.body}</p>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                    <span>Modificat {formatDate(n.updated_at)}</span>
                    {n.created_by ? <span>de {who.get(n.created_by) ?? "un coleg"}</span> : null}
                    <span className={s ? "font-medium text-[var(--color-ok)]" : ""}>
                      {s
                        ? `Trimis la ${s.firms.size} ${s.firms.size === 1 ? "firmă" : "firme"} · ultima dată ${formatDate(s.last)}`
                        : "Netrimis încă"}
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
