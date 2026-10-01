/**
 * Structura unui raport salvat: secțiunile și forma cifrelor înghețate. Fără
 * acces la baza de date, ca s-o poată folosi și formularele din browser.
 */
import type { ReportType } from "@/lib/perioade";

/** Secțiunile unui raport, în ordinea în care se citesc într-o ședință. */
export type ReportSection =
  | "retine" | "reflectie" | "kpi" | "agenti" | "evolutie" | "palnie" | "asteptare" | "fereastra"
  | "restante" | "uitate" | "owner" | "vizite" | "oferte" | "piata" | "note";

export const SECTION_LABELS: Record<ReportSection, string> = {
  retine: "De reținut",
  reflectie: "Din teren, pe scurt",
  kpi: "Indicatori cheie",
  agenti: "Activitatea pe agenți",
  evolutie: "Vizitele față de țintă",
  palnie: "De la vizită la client",
  asteptare: "Oferte care așteaptă răspuns",
  fereastra: "Ce se deschide în curând",
  restante: "Pași restanți",
  uitate: "Firme calde fără contact",
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
  saptamana: [
    "retine", "reflectie", "kpi", "agenti", "evolutie", "palnie", "asteptare", "fereastra", "restante", "uitate", "owner",
  ],
  luna: ["retine", "reflectie", "kpi", "agenti", "evolutie", "palnie", "asteptare", "fereastra", "oferte", "piata"],
  trimestru: ["retine", "reflectie", "kpi", "agenti", "evolutie", "palnie", "fereastra", "piata"],
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

/**
 * Partea scrisă de om, pe patru întrebări fixe. Ultima e cea mai importantă:
 * face din raport un dialog cu conducerea, nu doar un control al agentului.
 */
export const REFLECTION_QUESTIONS = [
  { key: "amers", label: "Ce a mers", placeholder: "O demonstrație reușită, o firmă câștigată, un argument care a prins." },
  { key: "nuamers", label: "Ce n-a mers și de ce", placeholder: "O ofertă pierdută, o firmă care s-a răcit, o zi pierdută pe drum." },
  { key: "piata", label: "Ce văd în piață", placeholder: "Prețuri, concurență, ce cer clienții, ce s-a schimbat față de luna trecută." },
  { key: "nevoie", label: "De ce am nevoie de la conducere", placeholder: "Un preț, o decizie, un utilaj de demonstrație, o vizită împreună." },
] as const;

export type ReflectionKey = (typeof REFLECTION_QUESTIONS)[number]["key"];
export type Reflection = Partial<Record<ReflectionKey, string>>;

export const hasReflection = (r?: Reflection | null): boolean =>
  Boolean(r && Object.values(r).some((t) => t?.trim()));

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
  /** Firme care spun că ar cumpăra curând sau au utilajul de schimbat: privirea înainte. */
  opportunities?: {
    count: number;
    rows: { client: string; agent: string; reasons: string[]; interest: string | null; nextStep: string | null; nextStepDate: string | null }[];
  };
  /** Firme calde, fără pas stabilit, la care a trecut termenul de revenire. */
  slipping?: { count: number; rows: { client: string; agent: string; lastVisit: string | null; zile: number; interest: string | null }[] };
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
