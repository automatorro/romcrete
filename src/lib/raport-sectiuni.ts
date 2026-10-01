/**
 * Structura unui raport salvat: secțiunile și forma cifrelor înghețate. Fără
 * acces la baza de date, ca s-o poată folosi și formularele din browser.
 */
import type { ReportType } from "@/lib/perioade";

/** Secțiunile unui raport, în ordinea în care se citesc într-o ședință. */
export type ReportSection = "kpi" | "agenti" | "evolutie" | "palnie" | "vizite" | "oferte" | "piata" | "note";

export const SECTION_LABELS: Record<ReportSection, string> = {
  kpi: "Indicatori cheie",
  agenti: "Activitatea pe agenți",
  evolutie: "Evoluția în perioadă",
  palnie: "De la vizită la client",
  vizite: "Vizitele perioadei",
  oferte: "Ofertele perioadei",
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
  zi: ["kpi", "agenti", "vizite", "oferte", "note"],
  saptamana: ["kpi", "agenti", "evolutie", "palnie", "oferte", "note"],
  luna: ["kpi", "agenti", "evolutie", "palnie", "oferte", "piata"],
  trimestru: ["kpi", "agenti", "evolutie", "palnie", "piata"],
};

/** Secțiunile care au sens pentru cine e raportul: tabelul pe agenți e doar al echipei. */
export const sectionsFor = (scope: ReportScope): ReportSection[] =>
  scope === "echipa" ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s !== "agenti");

export const defaultSections = (type: ReportType, scope: ReportScope): ReportSection[] =>
  DEFAULTS[type].filter((s) => sectionsFor(scope).includes(s));

export type KpiFormat = "int" | "money" | "pct" | "dec";

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
  evolution: { label: string; vizite: number; oferte: number; valoare: number }[];
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
