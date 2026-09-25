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

/** Ce intră implicit în fiecare tip de raport: operativ zilnic, strategic trimestrial. */
export const DEFAULT_SECTIONS: Record<ReportType, ReportSection[]> = {
  zi: ["kpi", "agenti", "vizite", "oferte", "note"],
  saptamana: ["kpi", "agenti", "evolutie", "palnie", "oferte", "note"],
  luna: ["kpi", "agenti", "evolutie", "palnie", "oferte", "piata"],
  trimestru: ["kpi", "agenti", "evolutie", "palnie", "piata"],
};

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
  filters: { agentId: string | null; agent: string | null; domainId: string | null; domain: string | null };
  kpis: Kpi[];
  agents: {
    agent: string;
    vizite: number;
    firmeNoi: number;
    telefoane: number;
    emailuri: number;
    oferte: number;
    valoare: number;
    acceptate: number;
    tinta: number | null;
  }[];
  evolution: { label: string; vizite: number; oferte: number; valoare: number }[];
  funnel: { vizite: number; cuPas: number; oferteDinVizite: number; acceptate: number };
  visits: { date: string; agent: string; client: string; city: string | null; prima: boolean; nextStepDate: string | null }[];
  quotes: { number: string; date: string; client: string; agent: string; status: string; gross: number }[];
  market: { group: string; rows: [string, number][] }[];
  notes: { date: string; client: string; agent: string; text: string }[];
};
