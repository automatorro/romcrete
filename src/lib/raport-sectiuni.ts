/**
 * Structura unui raport salvat: secțiunile și forma cifrelor înghețate. Fără
 * acces la baza de date, ca s-o poată folosi și formularele din browser.
 */
import type { ReportType } from "@/lib/perioade";

/** Secțiunile unui raport, în ordinea în care se citesc într-o ședință. */
export type ReportSection =
  | "retine" | "kpi" | "agenti" | "evolutie" | "palnie" | "asteptare" | "restante" | "owner"
  | "vizite" | "oferte" | "piata" | "note";

export const SECTION_LABELS: Record<ReportSection, string> = {
  retine: "De reținut",
  kpi: "Indicatori cheie",
  agenti: "Activitatea pe agenți",
  evolutie: "Vizitele față de țintă",
  palnie: "De la vizită la client",
  asteptare: "Oferte care așteaptă răspuns",
  restante: "Pași restanți",
  owner: "Întrebări pentru conducere",
  vizite: "Vizitele perioadei",
  oferte: "Ofertele emise în perioadă",
  piata: "Ce spune piața",
  note: "Ce au spus clienții",
};

export const ALL_SECTIONS = Object.keys(SECTION_LABELS) as ReportSection[];

/**
 * Pentru cine e raportul. Individual: un singur agent. Echipă: toți agenții
 * împreună, cu defalcarea pe agent. Sunt rapoarte separate, nu filtre ale
 * aceluiași raport: se salvează, se titrează și se trimit fiecare pe numele lui.
 */
export type ReportScope = "agent" | "echipa";

export const SCOPE_LABELS: Record<ReportScope, string> = {
  agent: "Raport individual",
  echipa: "Raport de echipă",
};

/** Ce intră implicit în fiecare tip de raport: operativ zilnic, strategic trimestrial. */
const DEFAULTS: Record<ReportType, ReportSection[]> = {
  zi: ["kpi", "agenti", "vizite", "oferte", "restante", "note"],
  saptamana: ["retine", "kpi", "agenti", "evolutie", "palnie", "asteptare", "restante", "owner", "note"],
  luna: ["retine", "kpi", "agenti", "evolutie", "palnie", "asteptare", "oferte", "piata"],
  trimestru: ["retine", "kpi", "agenti", "evolutie", "palnie", "piata"],
};

/**
 * Indicatorii mari, pe tip de raport: cei după care se iau decizii la nivelul
 * perioadei. Restul apar pe un singur rând dedesubt, ca raportul să nu fie un
 * zid de cifre egale ca importanță.
 */
export const PRIMARY_KPIS: Record<ReportType, string[]> = {
  zi: ["vizite", "firmeNoi", "telefoane", "oferte", "valoare", "restante"],
  saptamana: ["vizite", "oferte", "valoare", "acceptate", "asteptare", "restante"],
  luna: ["vizite", "oferte", "valoare", "acceptate", "castig", "asteptare"],
  trimestru: ["vizite", "oferte", "valoare", "acceptate", "castig", "asteptare"],
};

/** Secțiunile care au sens pentru cine e raportul: tabelul pe agenți e doar al echipei. */
export const sectionsFor = (scope: ReportScope): ReportSection[] =>
  scope === "echipa" ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s !== "agenti");

export const defaultSections = (type: ReportType, scope: ReportScope): ReportSection[] =>
  DEFAULTS[type].filter((s) => sectionsFor(scope).includes(s));

export type KpiFormat = "int" | "money" | "pct" | "dec";

/** Un lucru de reținut, cu tonul lui: bine, de urmărit sau doar de știut. */
export type Highlight = { tone: "bine" | "atentie" | "info"; text: string };

export type Kpi = {
  key: string;
  label: string;
  value: number;
  prev: number;
  format: KpiFormat;
  /** Ținta pe perioadă, unde există (vizitele). */
  target?: number | null;
  /** Unde „mai puțin” e mai bine (pașii restanți). */
  lowerIsBetter?: boolean;
  /** Ce anume se numără, când numele singur poate fi citit greșit. */
  hint?: string;
  /** Starea de acum, fără perioadă anterioară cu care să se compare. */
  noCompare?: boolean;
};

export type ReportSnapshot = {
  version: 1;
  type: ReportType;
  typeLabel: string;
  from: string;
  to: string;
  label: string;
  prevLabel: string;
  generatedAt: string;
  orgName: string;
  /** Lipsește la rapoartele salvate înainte de separarea individual / echipă. */
  scope?: ReportScope;
  filters: { agentId: string | null; agent: string | null; domainId: string | null; domain: string | null };
  kpis: Kpi[];
  agents: {
    agent: string;
    vizite: number;
    firmeNoi: number;
    telefoane: number;
    emailuri: number;
    /** Lipsește la rapoartele salvate înainte să existe WhatsApp în istoric. */
    whatsapp?: number;
    oferte: number;
    valoare: number;
    acceptate: number;
    tinta: number | null;
  }[];
  /** `tinta` și `viitor` lipsesc la rapoartele salvate înainte de grafic. */
  evolution: {
    label: string;
    /** Eticheta scurtă de sub coloană: „Lu 29”, „22–28.09”, „sept.”. */
    short?: string;
    vizite: number;
    oferte: number;
    valoare: number;
    tinta?: number | null;
    /** Perioadă care n-a venit încă: coloana goală nu e o zi proastă. */
    viitor?: boolean;
  }[];
  /** Cele de mai jos lipsesc la rapoartele salvate înainte să existe secțiunile lor. */
  highlights?: Highlight[];
  pending?: {
    total: number;
    count: number;
    /** Câte expiră în 7 zile de la data raportului, și valoarea lor. */
    expiring: number;
    expiringValue: number;
    rows: {
      number: string; client: string; agent: string; date: string; validUntil: string | null; gross: number; zile: number;
      /** Expiră în 7 zile de la data raportului (sau a expirat deja, fără răspuns). */
      expira?: boolean;
    }[];
  };
  overdue?: { count: number; rows: { client: string; agent: string; step: string | null; date: string; zile: number }[] };
  escalations?: { client: string; agent: string; date: string; items: string[] }[];
  funnel: { vizite: number; cuPas: number; oferteDinVizite: number; acceptate: number };
  visits: { date: string; agent: string; client: string; city: string | null; prima: boolean; nextStepDate: string | null }[];
  quotes: { number: string; date: string; client: string; agent: string; status: string; gross: number }[];
  /** `answered`: câte firme au răspuns la întrebare; lipsește la rapoartele mai vechi. */
  market: { group: string; rows: [string, number][]; answered?: number }[];
  notes: { date: string; client: string; agent: string; text: string }[];
};

/** Pentru cine e un raport salvat, și la cele de dinainte să existe câmpul. */
export const scopeOf = (s: Pick<ReportSnapshot, "scope" | "filters">): ReportScope =>
  s.scope ?? (s.filters.agentId ? "agent" : "echipa");
