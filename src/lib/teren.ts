/** Tipurile catalogului de întrebări și ale vizitei, așa cum vin din baza de date. */

export type QuestionKind = "single" | "multi" | "next_step_date" | "pump_picker";

export type QuestionOption = { id: string; label: string };

export type QuestionGroup = {
  id: string;
  section_id: string;
  label: string;
  kind: QuestionKind;
  allows_note: boolean;
  options_source: "pump_categories" | "accessory_categories" | null;
  counts_for_priority: boolean;
  position: number;
  options: QuestionOption[];
};

export type QuestionSection = {
  id: string;
  title: string;
  position: number;
  open_by_default: boolean;
  groups: QuestionGroup[];
};

/** Răspunsurile unei vizite: text la alegere unică, listă la alegere multiplă. */
export type Answers = Record<string, string | string[]>;
/** „Altele”: text liber, pe același id de grup. */
export type Notes = Record<string, string>;

export type Visit = {
  id: string;
  org_id: string;
  client_id: string;
  agent_id: string | null;
  visit_date: string;
  answers: Answers;
  notes: Notes;
  pump_skus: string[];
  next_step_date: string | null;
  next_step_done_at: string | null;
  escalation_done_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Rândul din view-ul client_state: starea firmei, derivată din vizitele ei. */
export type ClientState = {
  client_id: string;
  org_id: string;
  owner_agent_id: string | null;
  name: string;
  trade_type: string | null;
  city: string | null;
  phone: string | null;
  answers: Answers;
  stage: string | null;
  interest: string | null;
  priority: "A" | "B" | "C" | "?";
  visit_count: number;
  last_visit: string | null;
  next_step: string | null;
  next_step_date: string | null;
  next_step_visit_id: string | null;
  next_step_late: boolean | null;
  pending_escalations: number;
};

export const TRADE_TYPES: QuestionOption[] = [
  { id: "tencuitor", label: "Tencuitor" },
  { id: "glet", label: "Gletuitor / zugrav" },
  { id: "sapist", label: "Șapist" },
  { id: "general", label: "Constructor general" },
  { id: "firma", label: "Firmă de construcții" },
  { id: "alt", label: "Altceva" },
];

export const tradeLabel = (id: string | null) =>
  TRADE_TYPES.find((t) => t.id === id)?.label ?? "";

/** Câte zile au trecut de la o dată calendaristică. */
export function daysAgo(date: string | null): number | null {
  if (!date) return null;
  const then = new Date(`${date}T12:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86400000);
}

export function lastVisitLabel(date: string | null): string {
  const d = daysAgo(date);
  if (d === null) return "nevizitat încă";
  if (d === 0) return "ultima vizită: azi";
  if (d === 1) return "ultima vizită: ieri";
  return `ultima vizită: acum ${d} zile`;
}

/**
 * Ce nu s-a aflat încă despre firmă. Aceleași reguli ca în aplicația de teren:
 * întrebările fără care agentul nu poate califica meseriașul.
 */
export function gaps(a: Answers): string[] {
  const has = (k: string) => {
    const v = a[k];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  };
  const out: string[] = [];
  if (!has("mod")) out.push("cum lucrează");
  if (!has("materiale")) out.push("materiale");
  if (!has("supr")) out.push("suprafață/zi");
  if (!has("scule")) out.push("scule");
  if ((a.mod === "manual" || a.mod === "mixt") && !has("dece")) out.push("de ce manual");
  if (!has("interes")) out.push("interes");
  if (!has("decide")) out.push("cine decide");
  return out;
}
