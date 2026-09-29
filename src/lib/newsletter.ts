/**
 * Newsletterele: textul, personalizarea și canalele, fără acces la baza de
 * date, ca previzualizarea din browser și trimiterea să folosească exact
 * aceleași reguli.
 */

export type Channel = "email" | "whatsapp";

export const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", whatsapp: "WhatsApp" };

export type Newsletter = {
  id: string;
  org_id: string;
  title: string;
  subject: string;
  body: string;
  unsubscribe_note: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Firma, cu ce trebuie pentru trimitere și pentru filtrele listei. */
export type Recipient = {
  id: string;
  name: string;
  contact_person: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  preferred_channel: Channel | null;
  newsletter_opt_out: boolean;
  owner_agent_id: string | null;
  domain: string | null;
};

/** Cine trimite: semnătura din text și adresa pusă la „Către” când firmele stau în BCC. */
export type Sender = { name: string; phone: string | null; email: string | null; company: string };

/** Câmpurile care se completează singure, pe firmă sau din datele celui care trimite. */
export const PLACEHOLDERS = [
  { key: "persoana", label: "Persoana de contact", perClient: true },
  { key: "firma", label: "Numele firmei", perClient: true },
  { key: "oras", label: "Localitatea", perClient: true },
  { key: "agent", label: "Numele tău", perClient: false },
  { key: "telefon", label: "Telefonul tău", perClient: false },
  { key: "firma_mea", label: "Firma noastră", perClient: false },
] as const;

export const UNSUBSCRIBE_NOTE = "Dacă nu mai doriți să primiți aceste mesaje, răspundeți cu „STOP”.";

const PER_CLIENT = new RegExp(`\\{(${PLACEHOLDERS.filter((p) => p.perClient).map((p) => p.key).join("|")})\\}`);

/** Textul folosește câmpuri care diferă de la o firmă la alta. */
export const usesClientFields = (...texts: string[]) => texts.some((t) => PER_CLIENT.test(t));

/**
 * Completează câmpurile din text. Ce lipsește rămâne gol, iar urmele lăsate
 * („Bună ziua, !”, spații duble) se curăță, ca textul să se citească firesc.
 * Fără firmă (emailul comun, cu BCC) câmpurile firmei rămân goale.
 */
export function personalize(text: string, sender: Sender, client?: Recipient | null): string {
  const values: Record<string, string> = {
    persoana: client?.contact_person?.trim() ?? "",
    firma: client?.name?.trim() ?? "",
    oras: client?.city?.trim() ?? "",
    agent: sender.name,
    telefon: sender.phone ?? "",
    firma_mea: sender.company,
  };
  return text
    .replace(/\{([a-z_]+)\}/g, (all, key: string) => (key in values ? values[key] : all))
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+([,.!?;:])/g, "$1")
        .replace(/,([!?.])/g, "$1")
        .replace(/([,;:])\1+/g, "$1")
        // Separatorul rămas fără pereche: „Romcrete · ” când lipsește telefonul.
        .replace(/^[ \t]*[·|][ \t]*|[ \t]*[·|][ \t]*$/g, "")
        .replace(/[ \t]+$/g, ""),
    )
    .join("\n");
}

/** Textul complet al mesajului, cu nota de dezabonare la final dacă e bifată. */
export function fullBody(body: string, unsubscribeNote: boolean): string {
  const text = body.trimEnd();
  return unsubscribeNote ? `${text}\n\n${UNSUBSCRIBE_NOTE}` : text;
}

/**
 * Emailul pleacă ca text simplu: semnele de formatare din WhatsApp (*aldin*,
 * _cursiv_, ~tăiat~) ar apărea ca atare, deci în email se scot.
 */
export const stripWhatsAppMarks = (text: string) =>
  text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/(^|[\s(])([*_~])(\S(?:[^\n]*?\S)?)\2(?=$|[\s).,!?:;])/gm, "$1$3");

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Adresele valide din câmpul de email al firmei; unele firme au trecute două. */
export const emailsOf = (raw: string | null) =>
  (raw ?? "")
    .split(/[\s,;/]+/)
    .map((x) => x.trim().replace(/^mailto:/i, ""))
    .filter((x) => EMAIL.test(x));

/**
 * Numărul în formatul cerut de WhatsApp: doar cifre, cu prefixul țării.
 * Numerele românești scrise „0722 123 456” devin „40722123456”. Din câmpurile
 * cu mai multe numere se ia primul mobil, altfel primul număr.
 */
export function whatsappNumber(raw: string | null): string | null {
  const candidates = (raw ?? "")
    .split(/[,;/]|\s{2,}|\bsau\b/)
    .map((part) => {
      let d = part.trim().replace(/^\+/, "00").replace(/\D/g, "");
      if (d.startsWith("00")) d = d.slice(2);
      else if (d.startsWith("0") && d.length === 10) d = `4${d}`;
      else if (d.startsWith("7") && d.length === 9) d = `40${d}`;
      return d.length >= 10 && d.length <= 15 ? d : null;
    })
    .filter((d): d is string => d !== null);
  return candidates.find((d) => d.startsWith("407")) ?? candidates[0] ?? null;
}

/** „40722123456” → „+40 722 123 456”, ca agentul să recunoască numărul. */
export const formatPhone = (digits: string) =>
  digits.startsWith("40") && digits.length === 11
    ? `+40 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
    : `+${digits}`;

/**
 * Pe ce canal primește firma newsletterul: canalul ales în fișă, dacă are
 * datele pentru el; altfel emailul, apoi WhatsApp. `only` restrânge la un canal.
 * `null` = nu se poate trimite (a refuzat sau nu are nici email, nici telefon).
 */
export function channelFor(c: Recipient, only?: Channel | null): Channel | null {
  if (c.newsletter_opt_out) return null;
  const has: Record<Channel, boolean> = {
    email: emailsOf(c.email).length > 0,
    whatsapp: whatsappNumber(c.phone) !== null,
  };
  if (only) return has[only] ? only : null;
  if (c.preferred_channel && has[c.preferred_channel]) return c.preferred_channel;
  if (has.email) return "email";
  if (has.whatsapp) return "whatsapp";
  return null;
}

/**
 * Lungimea maximă a unui link „mailto:”. Outlook clasic pe Windows taie sau
 * refuză linkurile mai lungi de ~2.000 de caractere; peste limită, textul
 * emailului se copiază și se lipește în Outlook.
 */
export const MAILTO_LIMIT = 1900;

/** Câte adrese într-un singur email cu BCC: serverele de email refuză listele prea lungi. */
export const BCC_MAX = 50;

export const mailtoUrl = ({ to, bcc, subject, body }: { to?: string[]; bcc?: string[]; subject: string; body?: string }) => {
  const params = [
    bcc?.length ? `bcc=${bcc.map(encodeURIComponent).join(",")}` : "",
    `subject=${encodeURIComponent(subject)}`,
    body ? `body=${encodeURIComponent(body)}` : "",
  ].filter(Boolean);
  return `mailto:${(to ?? []).map(encodeURIComponent).join(",")}?${params.join("&")}`;
};

/**
 * Împarte firmele în emailuri cu BCC: cel mult `BCC_MAX` firme pe email și
 * un link care încape în limita Outlook (fără text; textul se adaugă la
 * deschidere doar dacă mai încape).
 */
export function bccBatches<T extends { emails: string[] }>(items: T[], to: string[], subject: string): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  const fits = (list: T[]) =>
    list.length <= BCC_MAX && mailtoUrl({ to, bcc: list.flatMap((i) => i.emails), subject }).length <= MAILTO_LIMIT;
  for (const item of items) {
    if (cur.length && !fits([...cur, item])) {
      batches.push(cur);
      cur = [];
    }
    cur.push(item);
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
