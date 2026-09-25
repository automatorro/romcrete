/**
 * Datele agendei de teren. Ziua se socotește după ceasul din România, nu după
 * UTC: altfel, între miezul nopții și ora 3, „azi” ar fi încă ziua de ieri.
 */

const RO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ziua de azi în România, ca „AAAA-LL-ZZ”. */
export function todayRo(now = new Date()): string {
  return RO_DAY.format(now);
}

/** Adună zile la o dată „AAAA-LL-ZZ”, fără să depindă de fusul orar al serverului. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sâmbăta și duminica se mută pe luni: agenții nu fac vizite în weekend. */
export function toWorkingDay(iso: string): string {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return wd === 6 ? addDays(iso, 2) : wd === 0 ? addDays(iso, 1) : iso;
}

/** Adună zile lucrătoare: vineri + 1 înseamnă luni. */
export function addWorkingDays(iso: string, days: number): string {
  let d = iso;
  for (let i = 0; i < days; i++) d = toWorkingDay(addDays(d, 1));
  return d;
}

/** Datele rapide pentru pasul următor, socotite de azi și mutate pe zi lucrătoare. */
export function quickDates(today: string): { label: string; date: string }[] {
  const next = addWorkingDays(today, 1);
  return [
    // Vinerea, „mâine” e sâmbătă; butonul spune atunci deschis că e luni.
    { label: next === addDays(today, 1) ? "Mâine" : "Luni", date: next },
    { label: "Peste 3 zile", date: addWorkingDays(today, 3) },
    { label: "O săptămână", date: toWorkingDay(addDays(today, 7)) },
    { label: "2 săptămâni", date: toWorkingDay(addDays(today, 14)) },
  ];
}

/** Câte zile au trecut de la o dată până azi. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000,
  );
}

/** „mar., 7 oct.” — data scurtă, cu ziua săptămânii, pentru agendă. */
export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Pasul următor nu se poate lăsa fără dată, cu excepția renunțării explicite. */
export const STEP_WITHOUT_DATE = "nu";
