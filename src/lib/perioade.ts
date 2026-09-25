import { addDays, addWorkingDays } from "@/lib/agenda";
import type { Granularity } from "@/lib/activitate";

/** Tipurile de raport: fiecare acoperă o perioadă calendaristică întreagă. */
export type ReportType = "zi" | "saptamana" | "luna" | "trimestru";

export const REPORT_TYPES: { id: ReportType; label: string; adjective: string; hint: string }[] = [
  { id: "zi", label: "Zilnic", adjective: "zilnic", hint: "Vizitele zilei, pe agent, cu pașii următori" },
  { id: "saptamana", label: "Săptămânal", adjective: "săptămânal", hint: "Ținte, evoluție pe zile, restanțe" },
  { id: "luna", label: "Lunar", adjective: "lunar", hint: "Oferte și valoare, pâlnie, piața" },
  { id: "trimestru", label: "Trimestrial", adjective: "trimestrial", hint: "Tendințe pe luni, conversie, clasament" },
];

export const isReportType = (v: unknown): v is ReportType =>
  v === "zi" || v === "saptamana" || v === "luna" || v === "trimestru";

export type Period = {
  type: ReportType;
  from: string;
  to: string;
  /** „Săptămâna 39 · 22–28 sept. 2026” */
  label: string;
  /** Perioada calendaristică anterioară, pentru comparație. */
  prevFrom: string;
  prevTo: string;
  /** O zi din perioada anterioară / următoare, pentru navigare. */
  prevAnchor: string;
  nextAnchor: string;
  /** Cum se taie evoluția din interiorul perioadei. */
  granularity: Granularity;
};

const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const LUNI_SCURT = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
};
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const scurt = (s: string) => {
  const { m, d } = parts(s);
  return `${d} ${LUNI_SCURT[m - 1]}`;
};

/** Numărul săptămânii ISO (luni–duminică), cum apare în calendarele de birou. */
function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function bounds(type: ReportType, anchor: string): { from: string; to: string } {
  const { y, m } = parts(anchor);
  if (type === "zi") return { from: anchor, to: anchor };
  if (type === "saptamana") {
    const shift = (new Date(`${anchor}T12:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(anchor, -shift);
    return { from, to: addDays(from, 6) };
  }
  if (type === "luna") return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) };
  const q0 = Math.floor((m - 1) / 3) * 3 + 1;
  return { from: iso(y, q0, 1), to: iso(y, q0 + 2, lastDay(y, q0 + 2)) };
}

function labelOf(type: ReportType, from: string, to: string): string {
  const a = parts(from);
  if (type === "zi") {
    const wd = new Intl.DateTimeFormat("ro-RO", { weekday: "long", timeZone: "UTC" }).format(new Date(`${from}T12:00:00Z`));
    return `${wd}, ${a.d} ${LUNI[a.m - 1]} ${a.y}`;
  }
  if (type === "saptamana") return `Săptămâna ${isoWeek(from)} · ${scurt(from)} – ${scurt(to)} ${parts(to).y}`;
  if (type === "luna") return `${LUNI[a.m - 1][0].toUpperCase()}${LUNI[a.m - 1].slice(1)} ${a.y}`;
  return `Trimestrul ${Math.floor((a.m - 1) / 3) + 1} ${a.y} · ${LUNI[a.m - 1]} – ${LUNI[parts(to).m - 1]}`;
}

/** Perioada calendaristică de tipul cerut care conține ziua `anchor`. */
export function periodFor(type: ReportType, anchor: string): Period {
  const { from, to } = bounds(type, anchor);
  // Raportul zilnic sare peste weekend: lunea se compară cu vinerea.
  let prevAnchor = addDays(from, -1);
  if (type === "zi") while ([0, 6].includes(new Date(`${prevAnchor}T12:00:00Z`).getUTCDay())) prevAnchor = addDays(prevAnchor, -1);
  const prev = bounds(type, prevAnchor);
  return {
    type,
    from,
    to,
    label: labelOf(type, from, to),
    prevFrom: prev.from,
    prevTo: prev.to,
    prevAnchor,
    nextAnchor: type === "zi" ? addWorkingDays(to, 1) : addDays(to, 1),
    granularity: type === "trimestru" ? "luna" : type === "luna" ? "saptamana" : "zi",
  };
}

/** Numele perioadei anterioare, pentru coloana „față de”. */
export const previousLabel: Record<ReportType, string> = {
  zi: "ziua lucrătoare anterioară",
  saptamana: "săptămâna anterioară",
  luna: "luna anterioară",
  trimestru: "trimestrul anterior",
};
