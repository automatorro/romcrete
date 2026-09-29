"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { logNewsletterSent, saveNewsletter, type NewsletterDraft } from "@/app/(app)/newsletter/actions";
import { FormMessage } from "@/components/form-message";
import {
  bccBatches,
  CHANNEL_LABELS,
  channelFor,
  emailHtml,
  emailsOf,
  formatPhone,
  fullBody,
  hasTextLinks,
  htmlToNewsletterText,
  linksAsText,
  mailtoUrl,
  MAILTO_LIMIT,
  personalize,
  PLACEHOLDERS,
  stripWhatsAppMarks,
  usesClientFields,
  whatsappNumber,
  whatsappUrl,
  type Channel,
  type Newsletter,
  type Recipient,
  type Sender,
} from "@/lib/newsletter";
import { formatDate } from "@/lib/totals";
import type { ActionState } from "@/lib/validation";

export type SentInfo = { at: string; channel: Channel };

type ChannelMode = "preferat" | Channel;
type EmailMode = "bcc" | "individual";
type Show = "toate" | "email" | "whatsapp" | "fara" | "netrimise";

type Row = Recipient & { channel: Channel | null; emails: string[]; wa: string | null };

/**
 * Newsletterul, de la text la trimitere: textul cu previzualizarea exactă pe
 * email și pe WhatsApp, alegerea firmelor și trimiterea din Outlook-ul local
 * sau din WhatsApp. Aplicația nu trimite nimic singură: deschide mesajul gata
 * scris, iar omul apasă „Trimite”.
 */
export function NewsletterWorkspace({
  newsletter,
  canEdit,
  recipients,
  sent,
  agents,
  domains,
  sender,
}: {
  newsletter: Newsletter;
  canEdit: boolean;
  recipients: Recipient[];
  sent: Record<string, SentInfo>;
  agents: { id: string; name: string }[];
  domains: { id: string; label: string }[];
  sender: Sender;
}) {
  // ------------------------------------------------------------ textul
  const initial: NewsletterDraft = {
    title: newsletter.title,
    subject: newsletter.subject,
    body: newsletter.body,
    unsubscribe_note: newsletter.unsubscribe_note,
  };
  const [draft, setDraft] = useState<NewsletterDraft>(initial);
  const [saved, setSaved] = useState<NewsletterDraft>(initial);
  const [saveState, setSaveState] = useState<ActionState>(null);
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = () =>
    startSaving(async () => {
      const res = await saveNewsletter(newsletter.id, draft);
      setSaveState(res);
      if (res?.success) setSaved(draft);
    });

  // Textul nesalvat nu se pierde la o închidere din greșeală a paginii.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const subjectText = (c: Recipient | null) => personalize(draft.subject.trim() || draft.title, sender, c);
  const messageFor = (c: Recipient | null) => fullBody(personalize(draft.body, sender, c), draft.unsubscribe_note);
  // WhatsApp și emailul simplu nu pot ascunde adresa sub text: linkul se scrie după text.
  const whatsappText = (c: Recipient | null) => linksAsText(messageFor(c));
  const emailText = (c: Recipient | null) => stripWhatsAppMarks(whatsappText(c));
  const emailRichHtml = (c: Recipient | null) => emailHtml(messageFor(c));
  const personalized = usesClientFields(draft.body, draft.subject);

  // ------------------------------------------------------------ firmele
  const [channelMode, setChannelMode] = useState<ChannelMode>("preferat");
  const rows: Row[] = useMemo(
    () =>
      recipients.map((c) => ({
        ...c,
        channel: channelFor(c, channelMode === "preferat" ? null : channelMode),
        emails: emailsOf(c.email),
        wa: whatsappNumber(c.phone),
      })),
    [recipients, channelMode],
  );

  const [sentNow, setSentNow] = useState<Record<string, SentInfo>>({});
  const sentAll = { ...sent, ...sentNow };

  const [q, setQ] = useState("");
  const [agent, setAgent] = useState("");
  const [city, setCity] = useState("");
  const [domain, setDomain] = useState("");
  const [show, setShow] = useState<Show>("toate");
  const cities = useMemo(
    () => [...new Set(recipients.map((c) => c.city?.trim()).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "ro")),
    [recipients],
  );
  const agentName = new Map(agents.map((a) => [a.id, a.name]));

  const needle = q.trim().toLocaleLowerCase("ro");
  const filtered = rows.filter((c) => {
    if (needle && ![c.name, c.contact_person, c.city, c.email, c.phone].some((v) => v?.toLocaleLowerCase("ro").includes(needle))) return false;
    if (agent && (agent === "fara" ? c.owner_agent_id !== null : c.owner_agent_id !== agent)) return false;
    if (city && c.city?.trim() !== city) return false;
    if (domain && (c.domain ?? "") !== domain) return false;
    if (show === "email" && c.channel !== "email") return false;
    if (show === "whatsapp" && c.channel !== "whatsapp") return false;
    if (show === "fara" && c.channel !== null) return false;
    if (show === "netrimise" && (sentAll[c.id] || c.channel === null)) return false;
    return true;
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectable = filtered.filter((c) => c.channel !== null);
  const selectShown = () => setSelected((prev) => new Set([...prev, ...selectable.map((c) => c.id)]));

  const chosen = rows.filter((c) => selected.has(c.id) && c.channel !== null);
  const byEmail = chosen.filter((c) => c.channel === "email");
  const byWhatsApp = chosen.filter((c) => c.channel === "whatsapp");
  const unreachable = rows.filter((c) => c.channel === null).length;

  // ------------------------------------------------------------ trimiterea
  const [emailModeChoice, setEmailMode] = useState<EmailMode | null>(null);
  const emailMode: EmailMode = emailModeChoice ?? (personalized ? "individual" : "bcc");
  // Emailul formatat (linkuri pe text, aldin, liste) se lipește în Outlook; implicit când textul are linkuri pe text.
  const [emailRichChoice, setEmailRich] = useState<boolean | null>(null);
  const emailRich = emailRichChoice ?? hasTextLinks(draft.body);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const markOpened = (keys: string[]) => setOpened((prev) => new Set([...prev, ...keys]));

  const log = async (channel: Channel, ids: string[]) => {
    const res = await logNewsletterSent(newsletter.id, channel, ids);
    if (res.error) {
      setNotice({ text: `Mesajul s-a deschis, dar trimiterea nu s-a notat în istoric: ${res.error}`, error: true });
      return;
    }
    const at = new Date().toISOString();
    setSentNow((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { at, channel }])) }));
  };

  /**
   * Deschide emailul în Outlook. Emailul formatat și textul prea lung pentru
   * un link „mailto:” se copiază, iar în Outlook se lipesc cu Ctrl+V.
   */
  const openEmail = (to: string[], bcc: string[], subject: string, body: string, html: string) => {
    let url = mailtoUrl({ to, bcc, subject, body });
    if (emailRich) {
      url = mailtoUrl({ to, bcc, subject });
      void copyRich(html, body).then((ok) =>
        setNotice({
          text: ok
            ? "Emailul s-a deschis cu destinatarii și subiectul. Textul formatat, cu linkurile, e copiat: dă clic în corpul emailului din Outlook și apasă Ctrl+V."
            : "Textul nu s-a putut copia: apasă „Copiază textul emailului” și lipește-l în Outlook cu Ctrl+V.",
          error: !ok,
        }),
      );
    } else if (url.length > MAILTO_LIMIT) {
      url = mailtoUrl({ to, bcc, subject });
      void copy(body).then((ok) =>
        setNotice({
          text: ok
            ? "Textul e lung pentru un link de email, așa că l-am copiat: în Outlook, dă clic în corpul emailului și apasă Ctrl+V."
            : "Textul e lung pentru un link de email: apasă „Copiază textul emailului” și lipește-l în Outlook cu Ctrl+V.",
        }),
      );
    } else {
      setNotice(null);
    }
    window.location.assign(url);
  };

  const sendBcc = (batch: Row[]) => {
    const to = sender.email ? [sender.email] : [];
    openEmail(to, batch.flatMap((c) => c.emails), subjectText(null), emailText(null), emailRichHtml(null));
    markOpened(batch.map((c) => `email:${c.id}`));
    void log("email", batch.map((c) => c.id));
  };

  const sendEmailTo = (c: Row) => {
    openEmail(c.emails, [], subjectText(c), emailText(c), emailRichHtml(c));
    markOpened([`email:${c.id}`]);
    void log("email", [c.id]);
  };

  const sendWhatsApp = (c: Row) => {
    if (!c.wa) return;
    // Deschis direct din apăsare, altfel browserul blochează fereastra nouă.
    window.open(whatsappUrl(c.wa, whatsappText(c)), "_blank", "noopener");
    setNotice(null);
    markOpened([`whatsapp:${c.id}`]);
    void log("whatsapp", [c.id]);
  };

  const batches = bccBatches(byEmail, sender.email ? [sender.email] : [], subjectText(null));

  // ------------------------------------------------------------ previzualizarea
  const [tab, setTab] = useState<Channel>("email");
  const [previewId, setPreviewId] = useState("");
  const previewPool = chosen.length ? chosen : rows.filter((c) => c.channel !== null).slice(0, 300);
  const commonEmail = tab === "email" && emailMode === "bcc";
  const previewClient = commonEmail
    ? null
    : (previewPool.find((c) => c.id === previewId) ??
      previewPool.find((c) => c.channel === tab) ??
      previewPool[0] ??
      null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const edit = (patch: Partial<NewsletterDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaveState(null);
  };
  /** Înlocuiește selecția cu textul dat; cursorul rămâne după el sau selectează `select`. */
  const replaceSelection = (text: string, select?: [number, number]) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    edit({ body: value.slice(0, s) + text + value.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      if (select) el.setSelectionRange(s + select[0], s + select[1]);
      else el.setSelectionRange(s + text.length, s + text.length);
    });
  };
  /** Link pe textul selectat, ca în Word: `[text](adresă)`. */
  const addLink = () => {
    const el = bodyRef.current;
    if (!el) return;
    const raw = window.prompt("Adresa linkului (de pe site, ex. https://shop.romcrete.ro/…)", "https://")?.trim();
    if (!raw || raw === "https://") return;
    const url = /^(https?:\/\/|mailto:)/i.test(raw) ? raw : raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
    const label = el.value.slice(el.selectionStart, el.selectionEnd).trim() || "textul linkului";
    replaceSelection(`[${label}](${url})`, [1, 1 + label.length]);
  };
  /** Textul lipit din Word își păstrează linkurile, aldinul și listele. */
  const pasteRich = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html || !/<a\s|<b[\s>]|<strong|<i[\s>]|<em[\s>]|<li|mso-|font-weight/i.test(html)) return;
    const text = htmlToNewsletterText(html);
    if (!text) return;
    e.preventDefault();
    replaceSelection(text);
  };

  /** Pune textul la cursor sau îmbracă selecția, ca în WhatsApp. */
  const insert = (before: string, after = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    edit({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      const caret = e + before.length + after.length;
      el.setSelectionRange(after ? s + before.length : caret, after ? e + before.length : caret);
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Textul și previzualizarea, una lângă alta pe calculator. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="text-base font-semibold">1. Mesajul</h2>
          {!canEdit ? (
            <p className="notice">
              Textul l-a scris un coleg: îl poți trimite așa cum e. Ca să-l schimbi, apasă „Fă o copie” sus.
            </p>
          ) : null}
          <div>
            <label htmlFor="nl-name" className="label">
              Numele newsletterului (doar pentru tine)
            </label>
            <input
              id="nl-name"
              value={draft.title}
              onChange={(e) => edit({ title: e.target.value })}
              readOnly={!canEdit}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="nl-subject" className="label">
              Subiectul emailului
            </label>
            <input
              id="nl-subject"
              value={draft.subject}
              onChange={(e) => edit({ subject: e.target.value })}
              readOnly={!canEdit}
              placeholder={draft.title}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="nl-body" className="label">
              Textul
            </label>
            {canEdit ? (
              <div className="mb-1.5 flex flex-wrap gap-1.5" role="toolbar" aria-label="Completează în text">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insert(`{${p.key}}`)}
                    className="chip chip-s"
                    title={`Se înlocuiește cu ${p.label.toLowerCase()}`}
                  >
                    + {p.label}
                  </button>
                ))}
                <span className="mx-1 w-px bg-neutral-200" aria-hidden />
                <button type="button" onClick={() => insert("*", "*")} className="chip chip-s font-bold" title="Aldin pe WhatsApp">
                  B
                </button>
                <button type="button" onClick={() => insert("_", "_")} className="chip chip-s italic" title="Cursiv pe WhatsApp">
                  I
                </button>
                <button type="button" onClick={() => insert("\n- ")} className="chip chip-s" title="Rând de listă">
                  • listă
                </button>
                <button type="button" onClick={addLink} className="chip chip-s" title="Selectează textul, apoi pune linkul în spatele lui">
                  🔗 Link
                </button>
              </div>
            ) : null}
            <textarea
              id="nl-body"
              ref={bodyRef}
              value={draft.body}
              onChange={(e) => edit({ body: e.target.value })}
              onPaste={canEdit ? pasteRich : undefined}
              readOnly={!canEdit}
              rows={16}
              className="input font-mono text-[14px] leading-relaxed"
            />
            <p className="hint mt-1 text-xs text-neutral-500">
              Câmpurile în acolade se completează singure pentru fiecare firmă. Textul lipit din Word își păstrează
              linkurile, aldinul și listele. Un link pe text se scrie [text](https://…): în emailul formatat textul
              devine clicabil, iar pe WhatsApp adresa apare după text. *Aldinul* și _cursivul_ se văd pe WhatsApp.
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.unsubscribe_note}
              onChange={(e) => edit({ unsubscribe_note: e.target.checked })}
              disabled={!canEdit}
              className="h-5 w-5"
            />
            Adaugă la final cum se pot dezabona (recomandat)
          </label>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-ok">
                {saving ? "Se salvează…" : dirty ? "Salvează textul" : "Salvat"}
              </button>
              {dirty ? <span className="text-sm text-neutral-500">Modificări nesalvate</span> : null}
            </div>
          ) : null}
          <FormMessage state={saveState} />
        </section>

        <section className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-base font-semibold">Cum îl primește clientul</h2>
            <div className="flex gap-1" role="tablist" aria-label="Canalul previzualizat">
              {(["email", "whatsapp"] as Channel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  role="tab"
                  aria-selected={tab === ch}
                  onClick={() => setTab(ch)}
                  className={`chip chip-s ${tab === ch ? "chip-on" : ""}`}
                >
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>

          {commonEmail ? (
            <p className="text-xs text-neutral-500">
              Emailul comun: toate firmele din BCC primesc exact acest text.
              {personalized ? " Câmpurile firmei ({persoana}, {firma}, {oras}) rămân goale — pentru ele alege „Câte un email pe firmă” la trimitere." : ""}
            </p>
          ) : previewPool.length ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Văzut de</span>
              <select
                value={previewClient?.id ?? ""}
                onChange={(e) => setPreviewId(e.target.value)}
                className="input min-h-10 flex-1 py-1"
              >
                {previewPool.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.contact_person ? ` · ${c.contact_person}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-neutral-500">Nicio firmă cu email sau telefon: previzualizarea arată textul fără datele firmei.</p>
          )}

          {tab === "email" ? (
            <EmailPreview
              from={sender.email ? `${sender.name} <${sender.email}>` : sender.name}
              to={
                commonEmail
                  ? (sender.email ?? "")
                  : previewClient
                    ? emailsOf(previewClient.email).join(", ") || "— firma nu are email —"
                    : ""
              }
              bcc={commonEmail ? byEmail.length : 0}
              subject={subjectText(previewClient)}
              body={emailText(previewClient)}
              html={emailRich ? emailRichHtml(previewClient) : null}
            />
          ) : (
            <WhatsAppPreview
              name={previewClient?.contact_person || previewClient?.name || "Client"}
              phone={previewClient ? whatsappNumber(previewClient.phone) : null}
              text={whatsappText(previewClient)}
            />
          )}
          {previewClient && personalized && !previewClient.contact_person && /\{persoana\}/.test(draft.body) ? (
            <p className="text-xs text-neutral-500">
              Firma nu are persoană de contact în fișă, așa că {"{persoana}"} rămâne gol. Verifică dacă salutul se citește bine.
            </p>
          ) : null}
        </section>
      </div>

      {/* 2. Firmele */}
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="flex-1 text-base font-semibold">2. Cui îl trimiți</h2>
          <span className="text-sm text-neutral-500">
            {chosen.length} {chosen.length === 1 ? "firmă aleasă" : "firme alese"} · {byEmail.length} pe email ·{" "}
            {byWhatsApp.length} pe WhatsApp
          </span>
        </div>

        <fieldset className="mt-3">
          <legend className="label">Pe ce canal</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["preferat", "Cum preferă fiecare firmă"],
                ["email", "Doar pe email"],
                ["whatsapp", "Doar pe WhatsApp"],
              ] as [ChannelMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setChannelMode(id)}
                aria-pressed={channelMode === id}
                className={`chip chip-s ${channelMode === id ? "chip-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Canalul preferat se alege în fișa firmei; fără alegere, emailul dacă îl are, altfel WhatsApp.
          </p>
        </fieldset>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută firmă, persoană, oraș"
            aria-label="Caută firme"
            className="input"
          />
          {agents.length ? (
            <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agentul" className="input">
              <option value="">Toți agenții</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  Firmele lui {a.name}
                </option>
              ))}
              <option value="fara">Fără agent</option>
            </select>
          ) : null}
          {cities.length > 1 ? (
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Localitatea" className="input">
              <option value="">Toate localitățile</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : null}
          {domains.length > 1 ? (
            <select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domeniul" className="input">
              <option value="">Toate domeniile</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["toate", "Toate"],
              ["email", "Pe email"],
              ["whatsapp", "Pe WhatsApp"],
              ["netrimise", "Care nu l-au primit"],
              ["fara", `Nu se pot contacta · ${unreachable}`],
            ] as [Show, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setShow(id)}
              aria-pressed={show === id}
              className={`chip chip-s ${show === id ? "chip-on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectShown} disabled={!selectable.length} className="btn btn-secondary btn-sm">
            Bifează toate cele afișate ({selectable.length})
          </button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size} className="btn btn-ghost btn-sm">
            Golește selecția
          </button>
        </div>

        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Încă nicio firmă. Firmele se adaugă din vizite, din „Clienți” sau prin importul din Excel.
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nicio firmă pentru filtrul ales.</p>
        ) : (
          <ul className="mt-3 max-h-[28rem] divide-y divide-neutral-200 overflow-y-auto rounded-xl border border-neutral-200">
            {filtered.map((c) => {
              const s = sentAll[c.id];
              const disabled = c.channel === null;
              return (
                <li key={c.id}>
                  <label
                    className={`flex min-h-14 items-start gap-3 px-3 py-2.5 ${disabled ? "bg-neutral-50" : "cursor-pointer hover:bg-brand-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id) && !disabled}
                      disabled={disabled}
                      onChange={() => toggle(c.id)}
                      className="mt-1 h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        <b className={disabled ? "text-neutral-500" : ""}>{c.name}</b>
                        <span className="text-sm text-neutral-500">
                          {[c.contact_person, c.city].filter(Boolean).map((x) => ` · ${x}`).join("")}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {[c.emails.join(", "), c.wa ? formatPhone(c.wa) : c.phone].filter(Boolean).join(" · ") || "fără email și telefon"}
                        {agents.length && c.owner_agent_id ? ` · ${agentName.get(c.owner_agent_id) ?? "agent"}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      {c.newsletter_opt_out ? (
                        <span className="text-[var(--color-bad)]">nu mai vrea newslettere</span>
                      ) : c.channel ? (
                        <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5">
                          {CHANNEL_LABELS[c.channel]}
                          {c.preferred_channel === c.channel ? " · preferat" : ""}
                        </span>
                      ) : (
                        <Link href={`/teren/firma/${c.id}`} className="font-medium text-brand-700 hover:underline">
                          {channelMode === "preferat" ? "completează email/telefon" : `fără ${CHANNEL_LABELS[channelMode]}`}
                        </Link>
                      )}
                      {s ? (
                        <span className="text-[var(--color-ok)]">
                          primit {formatDate(s.at)} · {CHANNEL_LABELS[s.channel]}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Trimiterea */}
      <section className="card space-y-4 p-4">
        <h2 className="text-base font-semibold">3. Trimite</h2>
        {dirty ? (
          <p className="notice-error" role="alert">
            Salvează textul înainte de trimitere, ca în istoricul firmelor să rămână exact ce a plecat.
          </p>
        ) : chosen.length === 0 ? (
          <p className="text-sm text-neutral-500">Bifează mai sus firmele cărora le trimiți newsletterul.</p>
        ) : null}
        {notice ? (
          <p role={notice.error ? "alert" : "status"} className={notice.error ? "notice-error" : "notice-ok"}>
            {notice.text}
          </p>
        ) : null}

        {!dirty && byEmail.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="flex-1 font-semibold">Pe email, din Outlook · {byEmail.length}</h3>
              <button type="button" onClick={() => {
                const c = emailMode === "bcc" ? null : byEmail[0];
                void (emailRich ? copyRich(emailRichHtml(c), emailText(c)) : copy(emailText(c))).then((ok) => setNotice({ text: ok ? "Textul emailului e copiat." : "Textul nu s-a putut copia.", error: !ok }));
              }} className="btn btn-ghost btn-sm">
                Copiază textul emailului
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEmailMode("bcc")}
                aria-pressed={emailMode === "bcc"}
                className={`chip chip-s ${emailMode === "bcc" ? "chip-on" : ""}`}
              >
                Un email comun, firmele în BCC
              </button>
              <button
                type="button"
                onClick={() => setEmailMode("individual")}
                aria-pressed={emailMode === "individual"}
                className={`chip chip-s ${emailMode === "individual" ? "chip-on" : ""}`}
              >
                Câte un email pe firmă, personalizat
              </button>
            </div>

            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" checked={emailRich} onChange={(e) => setEmailRich(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Email formatat, ca în Word: linkuri pe text, aldin, liste.
                <span className="block text-xs text-neutral-500">
                  Outlook se deschide cu destinatarii și subiectul, iar textul formatat e deja copiat: dai clic în
                  corpul emailului și apeși Ctrl+V. Fără bifă, textul vine scris în email, simplu, cu adresele
                  linkurilor după text.
                </span>
              </span>
            </label>

            {emailMode === "bcc" ? (
              <>
                <p className="text-xs text-neutral-500">
                  Firmele stau în BCC, deci nu își văd adresele una alteia; la „Către” ești tu
                  {sender.email ? ` (${sender.email})` : ""}.{" "}
                  {batches.length > 1
                    ? `Sunt ${batches.length} emailuri, ca Outlook și serverul de email să le primească fără să le taie.`
                    : ""}{" "}
                  În Outlook poți atașa o broșură PDF înainte de „Trimite”.
                </p>
                <ul className="space-y-2">
                  {batches.map((batch, i) => {
                    const done = batch.every((c) => opened.has(`email:${c.id}`));
                    return (
                      <li key={batch.map((c) => c.id).join()} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-2.5">
                        <span className="min-w-0 flex-1 text-sm">
                          <b>Emailul {i + 1}</b> · {batch.length} {batch.length === 1 ? "firmă" : "firme"}
                          <span className="block truncate text-xs text-neutral-500">{batch.map((c) => c.name).join(", ")}</span>
                        </span>
                        <button type="button" onClick={() => sendBcc(batch)} className={`btn ${done ? "btn-secondary" : "btn-primary"}`}>
                          {done ? "✓ Deschis · din nou" : "Deschide în Outlook"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <Queue
                rows={byEmail}
                channel="email"
                opened={opened}
                describe={(c) => c.emails.join(", ")}
                onSend={sendEmailTo}
                hint="Fiecare firmă primește emailul ei, cu numele și persoana de contact completate. După ce apeși „Trimite” în Outlook, revino aici pentru următoarea."
              />
            )}
          </div>
        ) : null}

        {!dirty && byWhatsApp.length ? (
          <div className="space-y-3 border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0">
            <h3 className="font-semibold">Pe WhatsApp · {byWhatsApp.length}</h3>
            <Queue
              rows={byWhatsApp}
              channel="whatsapp"
              opened={opened}
              describe={(c) => (c.wa ? formatPhone(c.wa) : "")}
              onSend={sendWhatsApp}
              hint="Se deschide conversația cu firma, cu mesajul scris; tu apeși „Trimite” în WhatsApp. WhatsApp nu permite trimiterea automată în masă, așa că mesajele pleacă unul câte unul."
            />
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">
          Fiecare mesaj deschis se notează în istoricul firmei ca „Newsletter”, separat de emailurile și telefoanele
          din rapoarte.
        </p>
      </section>
    </div>
  );
}

/** Firmele care primesc pe rând: butonul mare deschide următoarea. */
function Queue({
  rows,
  channel,
  opened,
  describe,
  onSend,
  hint,
}: {
  rows: Row[];
  channel: Channel;
  opened: Set<string>;
  describe: (c: Row) => string;
  onSend: (c: Row) => void;
  hint: string;
}) {
  const isOpened = (c: Row) => opened.has(`${channel}:${c.id}`);
  const next = rows.find((c) => !isOpened(c));
  const done = rows.filter(isOpened).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">{hint}</p>
      {next ? (
        <button type="button" onClick={() => onSend(next)} className={`btn btn-lg w-full justify-start ${channel === "whatsapp" ? "btn-ok" : "btn-primary"}`}>
          <span className="min-w-0 flex-1 truncate text-left">
            {done ? "Următoarea" : "Începe cu"}: {next.name}
          </span>
          <span className="text-sm opacity-80">
            {done + 1} / {rows.length}
          </span>
        </button>
      ) : (
        <p className="notice-ok">Toate cele {rows.length} mesaje au fost deschise.</p>
      )}
      <ul className="max-h-72 divide-y divide-neutral-200 overflow-y-auto rounded-xl border border-neutral-200">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className={isOpened(c) ? "text-neutral-500" : "font-medium"}>{c.name}</span>
              <span className="block truncate text-xs text-neutral-500">{describe(c)}</span>
            </span>
            <button type="button" onClick={() => onSend(c)} className="btn btn-secondary btn-sm">
              {isOpened(c) ? "✓ Din nou" : "Deschide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Emailul așa cum apare în Outlook: formatat (lipit cu Ctrl+V) sau text simplu, cu linkurile clicabile. */
function EmailPreview({
  from,
  to,
  bcc,
  subject,
  body,
  html,
}: {
  from: string;
  to: string;
  bcc: number;
  subject: string;
  body: string;
  html: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-sm">
      <div className="bg-[#0f6cbd] px-3 py-1.5 text-xs font-medium text-white">Mesaj · Outlook</div>
      <dl className="divide-y divide-neutral-200 border-b border-neutral-200 text-sm">
        <PreviewField label="De la" value={from} />
        <PreviewField label="Către" value={to || "—"} />
        {bcc ? <PreviewField label="Bcc" value={`${bcc} ${bcc === 1 ? "firmă" : "firme"} (nu se văd între ele)`} /> : null}
        <PreviewField label="Subiect" value={subject || "— fără subiect —"} strong />
      </dl>
      {html ? (
        // HTML-ul e construit de `emailHtml` din text scăpat de caractere speciale: e același care se lipește în Outlook.
        <div
          className="max-h-[32rem] overflow-y-auto px-4 py-3 text-[15px] leading-normal break-words [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div
          className="max-h-[32rem] overflow-y-auto px-4 py-3 text-[15px] leading-normal break-words whitespace-pre-wrap text-[#242424]"
          style={{ fontFamily: 'Aptos, Calibri, "Segoe UI", Arial, sans-serif' }}
        >
          {linkify(body)}
        </div>
      )}
    </div>
  );
}

function PreviewField({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2 px-3 py-1.5">
      <dt className="w-16 shrink-0 text-neutral-500">{label}</dt>
      <dd className={`min-w-0 break-words ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

/** Mesajul așa cum apare în WhatsApp: balonul verde, cu aldin, cursiv și linkuri. */
function WhatsAppPreview({ name, phone, text }: { name: string; phone: string | null; text: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 shadow-sm">
      <div className="flex items-center gap-2 bg-[#008069] px-3 py-2 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-sm font-semibold">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block text-xs opacity-80">{phone ? formatPhone(phone) : "fără număr de WhatsApp"}</span>
        </span>
      </div>
      <div className="max-h-[32rem] overflow-y-auto bg-[#efeae2] p-3">
        <div className="ml-auto w-fit max-w-[88%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 pt-1.5 pb-1 text-[14.5px] leading-snug break-words whitespace-pre-wrap text-[#111b21] shadow-sm">
          {whatsappFormat(text)}
          <span className="float-right mt-1 ml-3 text-[11px] text-[#667781]">acum ✓✓</span>
        </div>
      </div>
    </div>
  );
}

const LINK = /(https?:\/\/[^\s<>]+[^\s<>.,;:!?)"'»”]|www\.[^\s<>]+[^\s<>.,;:!?)"'»”]|[^\s<>@()]+@[^\s<>@()]+\.[a-z]{2,})/gi;

function linkify(text: string, keyPrefix = "l"): React.ReactNode[] {
  return text.split(LINK).map((part, i) => {
    if (i % 2 === 0) return part;
    const href = part.includes("@") && !part.startsWith("http") ? `mailto:${part}` : part.startsWith("www.") ? `https://${part}` : part;
    return (
      <a key={`${keyPrefix}${i}`} href={href} target="_blank" rel="noreferrer" className="text-[#0f6cbd] underline">
        {part}
      </a>
    );
  });
}

/** Aceleași reguli ca `stripWhatsAppMarks`: semnul lipit de cuvânt, la margine de cuvânt. */
const WA_MARK = /(^|[\s(])([*_~])(\S(?:[^\n]*?\S)?)\2(?=$|[\s).,!?:;])/gm;

function whatsappFormat(text: string, depth = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(WA_MARK)) {
    const start = m.index ?? 0;
    out.push(...linkify(text.slice(last, start) + m[1], `t${depth}-${start}-`));
    const inner = depth < 3 ? whatsappFormat(m[3], depth + 1) : [m[3]];
    const key = `f${depth}-${start}`;
    out.push(
      m[2] === "*" ? <strong key={key}>{inner}</strong> : m[2] === "_" ? <em key={key}>{inner}</em> : <s key={key}>{inner}</s>,
    );
    last = start + m[0].length;
  }
  out.push(...linkify(text.slice(last), `t${depth}-end-`));
  return out;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Browserele vechi sau paginile fără HTTPS: prin selecție.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

/** Copiază emailul formatat: Outlook îl lipește cu linkurile pe text, aldinul și listele. */
async function copyRich(html: string, plain: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    // Browserele fără ClipboardItem: se selectează HTML-ul randat și se copiază ca din pagină.
    const el = document.createElement("div");
    el.innerHTML = html;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand("copy");
    sel?.removeAllRanges();
    el.remove();
    return ok;
  }
}
