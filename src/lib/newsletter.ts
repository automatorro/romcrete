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

/**
 * Linkurile pe text, ca în Word: `[vezi pompa Mark V](https://…)`. În email
 * (formatat) textul devine clicabil; unde nu se poate ascunde adresa (WhatsApp,
 * emailul simplu), linkul se scrie după text, în paranteză.
 */
export const LINK_MD = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;

export const hasTextLinks = (text: string) => new RegExp(LINK_MD.source).test(text);

export const linksAsText = (text: string) =>
  text.replace(LINK_MD, (_all, label: string, url: string) => {
    const shown = url.replace(/^mailto:/, "");
    return label.trim() === shown || label.trim() === url ? shown : `${label} (${shown})`;
  });

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

const RAW_URL = /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>]+[^\s<>.,;:!?)"'»”])/g;

/** Un rând de text, cu linkuri, aldin, cursiv și tăiat, gata de pus în HTML. */
function inlineHtml(line: string): string {
  const links: string[] = [];
  // Linkurile se scot întâi, ca semnele de formatare din adrese să rămână neatinse.
  let out = escapeHtml(line).replace(
    new RegExp(LINK_MD.source, "g"),
    (_all, label: string, url: string) => {
      links.push(`<a href="${url}" style="color:#0f6cbd">${label}</a>`);
      return `\u0000${links.length - 1}\u0000`;
    },
  );
  out = out.replace(RAW_URL, (_all, pre: string, url: string) => {
    const href = url.startsWith("www.") ? `https://${url}` : url;
    links.push(`<a href="${href}" style="color:#0f6cbd">${url}</a>`);
    return `${pre}\u0000${links.length - 1}\u0000`;
  });
  out = out.replace(/(^|[\s(])([^\s<>@()\u0000]+@[^\s<>@()\u0000]+\.[a-z]{2,})/gi, (_all, pre: string, mail: string) => {
    links.push(`<a href="mailto:${mail}" style="color:#0f6cbd">${mail}</a>`);
    return `${pre}\u0000${links.length - 1}\u0000`;
  });
  out = out.replace(/(^|[\s(])([*_~])(\S(?:[^\n]*?\S)?)\2(?=$|[\s).,!?:;])/g, (_all, pre: string, mark: string, inner: string) => {
    const tag = mark === "*" ? "strong" : mark === "_" ? "em" : "s";
    return `${pre}<${tag}>${inner}</${tag}>`;
  });
  return out.replace(/\u0000(\d+)\u0000/g, (_all, i: string) => links[Number(i)]);
}

/**
 * Emailul formatat, ca în Word: paragrafe, liste cu „- ”, aldin, cursiv și
 * linkuri ascunse sub text. Se lipește în Outlook (Ctrl+V), pentru că un link
 * „mailto:” poate duce doar text simplu.
 */
export function emailHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n");
      const parts: string[] = [];
      let list: string[] = [];
      const flush = () => {
        if (list.length) parts.push(`<ul style="margin:0 0 0 24px;padding:0;list-style:disc">${list.join("")}</ul>`);
        list = [];
      };
      let para: string[] = [];
      const flushPara = () => {
        if (para.length) parts.push(`<p style="margin:0">${para.join("<br>")}</p>`);
        para = [];
      };
      for (const line of lines) {
        const item = /^\s*[-•]\s+(.*)$/.exec(line);
        if (item) {
          flushPara();
          list.push(`<li>${inlineHtml(item[1])}</li>`);
        } else {
          flush();
          para.push(inlineHtml(line));
        }
      }
      flushPara();
      flush();
      return `<div style="margin:0 0 14px 0">${parts.join("")}</div>`;
    })
    .join("");
  return `<div style="font-family:Aptos,Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;color:#242424">${html}</div>`;
}

/**
 * Textul lipit din Word (sau din alt email, dintr-o pagină web) adus la forma
 * din aplicație: linkurile păstrate ca `[text](adresă)`, aldinul ca *text*,
 * cursivul ca _text_, listele cu „- ”. Fără asta, lipirea păstrează doar
 * textul, iar adresele din spatele linkurilor se pierd.
 */
export function htmlToNewsletterText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/[\s\u00a0]+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const style = (el.getAttribute("style") ?? "").toLowerCase();
    // Word pune buline și numere ca text ascuns în liste; lista o facem noi.
    if (style.includes("mso-list:ignore") || ["style", "script", "head", "title", "meta"].includes(tag)) return "";
    const inner = [...el.childNodes].map(walk).join("");
    const wrap = (mark: string) => {
      const t = inner.trim();
      return t ? inner.replace(t, `${mark}${t}${mark}`) : inner;
    };

    if (tag === "br") return "\n";
    if (tag === "a") {
      const href = el.getAttribute("href") ?? "";
      const text = inner.replace(/\s+/g, " ").trim();
      if (!/^(https?:|mailto:)/i.test(href) || !text) return inner;
      return text === href || text === href.replace(/^mailto:/i, "") ? href.replace(/^mailto:/i, "") : `[${text}](${href})`;
    }
    if (tag === "b" || tag === "strong" || /font-weight:\s*(bold|[6-9]00)/.test(style)) return wrap("*");
    if (tag === "i" || tag === "em" || /font-style:\s*italic/.test(style)) return wrap("_");
    if (tag === "s" || tag === "strike" || tag === "del") return wrap("~");
    if (tag === "li" || /msolistparagraph/i.test(el.className)) return `\n- ${inner.trim()}\n`;
    if (/^h[1-6]$/.test(tag)) return `\n\n*${inner.trim()}*\n\n`;
    if (["p", "div", "tr", "section", "article", "blockquote"].includes(tag)) return `\n${inner.trim()}\n\n`;
    if (tag === "td" || tag === "th") return `${inner.trim()} `;
    return inner;
  };
  return walk(doc.body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n- (.*)\n\n(?=- )/g, "\n- $1\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\n- [^\n]*)\n{2,}(?=- )/g, "$1\n")
    .trim();
}

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
