import { notFound } from "next/navigation";

import { deleteNewsletter, duplicateNewsletter } from "@/app/(app)/newsletter/actions";
import { NewsletterWorkspace, type SentInfo } from "@/app/(app)/newsletter/[id]/workspace";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionContext, requireOrg } from "@/lib/auth";
import { getAllDomains } from "@/lib/domenii";
import type { Channel, Newsletter, Recipient } from "@/lib/newsletter";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage(props: PageProps<"/newsletter/[id]">) {
  const { id } = await props.params;
  const { eroare } = await props.searchParams;
  const { orgId, organization, user, role } = await requireOrg();
  const management = role !== "agent";

  const supabase = await createClient();
  const [{ data }, { data: clientRows, error: clientError }, { data: sentRows }, { data: members }, domains, session] =
    await Promise.all([
      supabase.from("newsletters").select("*").eq("id", id).maybeSingle(),
      // RLS dă fiecăruia firmele lui: agentul pe ale lui, conducerea pe toate.
      supabase
        .from("clients")
        .select("id, name, contact_person, city, email, phone, preferred_channel, newsletter_opt_out, owner_agent_id, domain")
        .eq("org_id", orgId)
        .order("name")
        .limit(5000),
      supabase
        .from("client_activities")
        .select("client_id, occurred_at, meta")
        .eq("kind", "newsletter")
        .eq("meta->>newsletter_id", id)
        .order("occurred_at", { ascending: false }),
      supabase.from("memberships").select("user_id, full_name, role").eq("org_id", orgId),
      getAllDomains(orgId),
      getSessionContext(),
    ]);

  if (!data) notFound();
  const newsletter = data as Newsletter;
  const recipients = (clientRows ?? []) as Recipient[];

  // Cea mai recentă trimitere la fiecare firmă.
  const sent: Record<string, SentInfo> = {};
  for (const r of (sentRows ?? []) as { client_id: string; occurred_at: string; meta: { channel?: Channel } }[]) {
    if (!sent[r.client_id]) sent[r.client_id] = { at: r.occurred_at, channel: r.meta?.channel ?? "email" };
  }

  const me = session?.membership;
  const agents = management
    ? (members ?? []).map((m) => ({ id: m.user_id as string, name: (m.full_name as string | null) ?? "Fără nume" }))
    : [];
  const canEdit = management || newsletter.created_by === user.id;

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/newsletter", label: "Toate newsletterele" }}
        title={newsletter.title}
        actions={
          <>
            <form action={duplicateNewsletter}>
              <input type="hidden" name="id" value={newsletter.id} />
              <SubmitButton className="btn btn-secondary" pendingLabel="Se copiază…">
                Fă o copie
              </SubmitButton>
            </form>
            {canEdit ? (
              <form action={deleteNewsletter}>
                <input type="hidden" name="id" value={newsletter.id} />
                <SubmitButton
                  className="btn btn-danger-ghost"
                  pendingLabel="Se șterge…"
                  confirmLabel="Da, șterge"
                  confirm={`Ștergi newsletterul „${newsletter.title}”? Trimiterile rămân în istoricul firmelor.`}
                >
                  Șterge
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      {typeof eroare === "string" && eroare ? (
        <p role="alert" className="notice-error">
          {eroare}
        </p>
      ) : null}
      {clientError ? (
        <p role="alert" className="notice-error">
          Firmele nu s-au putut citi: {clientError.message}. Dacă lipsesc coloanele noi, rulează migrația
          „20260929090000_newslettere.sql”.
        </p>
      ) : null}

      <NewsletterWorkspace
        newsletter={newsletter}
        canEdit={canEdit}
        recipients={recipients}
        sent={sent}
        agents={agents}
        domains={domains.map((d) => ({ id: d.id, label: d.short_label }))}
        sender={{
          name: me?.full_name?.trim() || user.email || organization.name,
          phone: me?.phone?.trim() || organization.phone || null,
          email: me?.contact_email?.trim() || user.email,
          company: organization.name,
        }}
      />
    </div>
  );
}
