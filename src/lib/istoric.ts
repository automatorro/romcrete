/** Istoricul firmei: tipurile și etichetele, fără acces la baza de date, ca să le poată folosi și formularele din browser. */

/** Ce se poate nota de mână în istoric. Restul tipurilor le scrie aplicația. */
export const MANUAL_KINDS = [
  { id: "telefon", label: "Telefon" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "intalnire", label: "Ne-am văzut" },
  { id: "nota", label: "Notă" },
] as const;

export type ManualKind = (typeof MANUAL_KINDS)[number]["id"];

export const isManualKind = (k: string): k is ManualKind => MANUAL_KINDS.some((m) => m.id === k);

export type HistoryKind =
  | ManualKind
  | "vizita"
  | "pas_amanat"
  | "pas_inchis"
  | "oferta_creata"
  | "oferta_stare";

export const HISTORY_LABELS: Record<HistoryKind, string> = {
  vizita: "Vizită",
  telefon: "Telefon",
  email: "Email",
  whatsapp: "WhatsApp",
  intalnire: "Întâlnire",
  nota: "Notă",
  pas_amanat: "Pas amânat",
  pas_inchis: "Pas închis",
  oferta_creata: "Ofertă",
  oferta_stare: "Ofertă",
};

/** Un rând din istoric, gata de afișat: vizită, contact, pas sau ofertă. */
export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  /** „AAAA-LL-ZZ”, ziua în care s-a întâmplat. */
  date: string;
  /** Pentru ordinea în aceeași zi. */
  sortKey: string;
  title: string;
  lines: string[];
  agent: string | null;
  href: string | null;
  /** Rândurile scrise de mână se pot șterge de autor sau de conducere. */
  deletable: boolean;
};
