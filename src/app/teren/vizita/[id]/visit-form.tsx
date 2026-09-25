"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { finishVisit, saveVisit } from "@/app/teren/actions";
import { STEP_WITHOUT_DATE, quickDates, shortDay } from "@/lib/agenda";
import { computePayback, demandFrom } from "@/lib/amortizare";
import type { MatchLevel, MaterialSuggestions } from "@/lib/materiale";
import { formatCatalogPrice, formatMoney, formatNumber } from "@/lib/totals";
import type { Answers, Notes, QuestionGroup, QuestionSection } from "@/lib/teren";

export type PumpOption = {
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
  /** Se configurează la comandă: nu intră în calculul de amortizare. */
  price_on_request: boolean;
};

type Props = {
  visitId: string;
  sections: QuestionSection[];
  pumps: PumpOption[];
  /** Pentru fiecare material, ce categorii de pompe îl acoperă și cu ce certitudine. */
  suggestions: MaterialSuggestions;
  /**
   * Ipotezele de calcul: randamentul vine din domeniul firmei, zilele lucrate
   * din Setări, iar unitatea de măsură spune în ce se socotește totul.
   */
  assumptions: {
    productivityFactor: number;
    workingDaysPerMonth: number;
    unitShort: string;
    unitLabel: string;
  };
  /** Ziua de azi în România, dată de server ca să nu difere la hidratare. */
  today: string;
  initial: {
    answers: Answers;
    notes: Notes;
    pumpSkus: string[];
    nextStepDate: string;
    visitDate: string;
  };
};

type Status = "idle" | "saving" | "saved" | "error";

type FormState = {
  answers: Answers;
  notes: Notes;
  pumpSkus: string[];
  nextStepDate: string;
  visitDate: string;
};

const STATUS_TEXT: Record<Status, string> = {
  idle: "",
  saving: "Se salvează…",
  saved: "✓ Salvat",
  error: "⚠ Fără confirmare — reîncerc",
};

export function VisitForm({ visitId, sections, pumps, suggestions, assumptions, today, initial }: Props) {
  const draftKey = `romcrete_vizita_${visitId}`;

  /** Tot ce se salvează stă într-o singură stare: o schimbare, o salvare. */
  const [form, setForm] = useState<FormState>(() => ({
    answers: initial.answers,
    notes: initial.notes,
    pumpSkus: initial.pumpSkus,
    nextStepDate: initial.nextStepDate,
    visitDate: initial.visitDate,
  }));
  const [status, setStatus] = useState<Status>("idle");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reîncercarea se programează prin referință, ca funcția să se poată chema
  // pe ea însăși fără să se lege de o versiune veche a stării.
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback(async () => {
    if (retry.current) clearTimeout(retry.current);
    setStatus("saving");
    const res = await saveVisit(visitId, {
      answers: form.answers,
      notes: form.notes,
      pump_skus: form.pumpSkus,
      next_step_date: form.nextStepDate || null,
      visit_date: form.visitDate,
    });
    if (res.ok) {
      dirty.current = false;
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      setStatus("saved");
      return true;
    }
    // Semnal pierdut pentru câteva secunde: reîncearcă singur, fără ca agentul
    // să trebuiască să observe. Copia locală rămâne până salvarea trece.
    setStatus("error");
    retry.current = setTimeout(() => flushRef.current(), 5000);
    return false;
  }, [form, visitId, draftKey]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, flush, draftKey]);

  // Avertizează la închiderea paginii dacă ultima salvare n-a apucat să treacă.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (retry.current) clearTimeout(retry.current);
    };
  }, []);

  const update = (patch: Partial<FormState>) => {
    dirty.current = true;
    setFinishError("");
    setForm((f) => ({ ...f, ...patch }));
  };

  /**
   * Vizita se încheie doar cu pasul următor stabilit și, dacă nu e o renunțare,
   * cu data lui. Fără ele firma dispare din agendă și nimeni nu mai revine.
   */
  const finish = async () => {
    // Se cere doar ce există în catalogul de întrebări al firmei.
    const asks = (id: string) => sections.some((s) => s.groups.some((g) => g.id === id));
    const step = typeof form.answers.urmator === "string" ? form.answers.urmator : "";
    const missing = asks("urmator") && !step
      ? "Alege pasul următor: ce faci mai departe cu firma asta."
      : asks("cuand") && step !== STEP_WITHOUT_DATE && !form.nextStepDate
        ? "Pune data pasului următor, ca firma să-ți apară în agendă în ziua aia."
        : "";
    if (missing) {
      setFinishError(missing);
      const field = document.getElementById(step ? "grup-cuand" : "grup-urmator");
      const section = field?.closest("details");
      if (section) section.open = true;
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setFinishing(true);
    if (timer.current) clearTimeout(timer.current);
    const saved = await flush();
    if (!saved) {
      setFinishing(false);
      setFinishError("Nu am putut salva vizita. Verifică semnalul și încearcă din nou.");
      return;
    }
    // La succes, acțiunea redirecționează spre „Azi”; revenirea aici e o eroare.
    await finishVisit(visitId);
    setFinishing(false);
  };

  const pickSingle = (gid: string, oid: string) =>
    update({ answers: { ...form.answers, [gid]: form.answers[gid] === oid ? "" : oid } });

  const pickMulti = (gid: string, oid: string) => {
    const cur = Array.isArray(form.answers[gid]) ? (form.answers[gid] as string[]) : [];
    update({
      answers: {
        ...form.answers,
        [gid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid],
      },
    });
  };

  const togglePump = (sku: string) =>
    update({
      pumpSkus: form.pumpSkus.includes(sku)
        ? form.pumpSkus.filter((x) => x !== sku)
        : [...form.pumpSkus, sku],
    });

  // Materialele bifate indică ce categorii de pompe merită discutate. Certitudinea
  // mai mare câștigă: ce scrie în fișa produsului bate ce am dedus noi.
  const suggested = new Map<string, MatchLevel>();
  const chosenMaterials = Array.isArray(form.answers.materiale)
    ? (form.answers.materiale as string[])
    : [];
  for (const material of chosenMaterials) {
    for (const [category, level] of Object.entries(suggestions[material] ?? {})) {
      if ((suggested.get(category) ?? 0) < level) suggested.set(category, level);
    }
  }

  // Amortizarea, recalculată la fiecare bifă: agentul o poate arăta pe loc.
  const valoareOptiune = (groupId: string, optionId: unknown) => {
    if (typeof optionId !== "string" || !optionId) return null;
    for (const s of sections) {
      const g = s.groups.find((x) => x.id === groupId);
      if (g) return g.options.find((o) => o.id === optionId)?.value ?? null;
    }
    return null;
  };

  const preturiAlese = form.pumpSkus
    .map((sku) => pumps.find((p) => p.sku === sku)?.unit_price)
    .filter((p): p is number => typeof p === "number" && p > 0);
  // Câteva pompe — LineLazer, Reactor — se configurează la comandă. Dacă agentul
  // a ales numai din alea, lipsa calculului nu e uitarea lui și trebuie spus.
  const toateLaCerere = form.pumpSkus.length > 0 && preturiAlese.length === 0;

  const payback = computePayback({
    unitsPerDay: valoareOptiune("supr", form.answers.supr),
    leiPerUnit: valoareOptiune("manopera", form.answers.manopera),
    productivityFactor: assumptions.productivityFactor,
    workingDaysPerMonth: assumptions.workingDaysPerMonth,
    pumpPrice: preturiAlese.length ? Math.min(...preturiAlese) : null,
    hasDemand: demandFrom(form.answers.refuzat),
  });

  const filled = (g: QuestionGroup) => {
    if (g.kind === "pump_picker") return form.pumpSkus.length;
    if (g.kind === "next_step_date") return form.nextStepDate ? 1 : 0;
    const v = form.answers[g.id];
    return Array.isArray(v) ? v.length : v ? 1 : 0;
  };

  return (
    <>
      <div className="card mb-3 flex items-center gap-3 p-3">
        <label className="text-sm text-neutral-500" htmlFor="visit_date">
          Data vizitei
        </label>
        <input
          id="visit_date"
          type="date"
          value={form.visitDate}
          onChange={(e) => update({ visitDate: e.target.value })}
          className="input flex-1"
        />
      </div>

      {sections.map((s) => {
        const completate = s.groups.reduce((n, g) => n + (filled(g) ? 1 : 0), 0);
        return (
          <details key={s.id} className="sec" open={s.open_by_default}>
            <summary>
              {s.title}
              <span className="ml-auto text-xs font-normal text-neutral-500">
                {completate}/{s.groups.length}
              </span>
            </summary>
            <div className="pb-3.5">
              {s.groups.map((g) => (
                <fieldset key={g.id} id={`grup-${g.id}`} className="mt-4 scroll-mt-4 first:mt-1">
                  <legend className="mb-1.5 text-sm text-neutral-500">{g.label}</legend>

                  {g.kind === "next_step_date" ? (
                    <NextStepDate
                      value={form.nextStepDate}
                      today={today}
                      optional={form.answers.urmator === STEP_WITHOUT_DATE}
                      onChange={(nextStepDate) => update({ nextStepDate })}
                    />
                  ) : g.kind === "pump_picker" ? (
                    <PumpPicker pumps={pumps} selected={form.pumpSkus} onToggle={togglePump} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {g.options.map((o) => {
                        const on =
                          g.kind === "multi"
                            ? (Array.isArray(form.answers[g.id])
                                ? (form.answers[g.id] as string[])
                                : []
                              ).includes(o.id)
                            : form.answers[g.id] === o.id;
                        const level =
                          g.options_source === "pump_categories" ? suggested.get(o.id) : undefined;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            title={
                              level === 2
                                ? "Sugerat: materialul e trecut în fișa produsului"
                                : level === 1
                                  ? "Sugerat: dedus după consistența materialului — de confirmat tehnic"
                                  : undefined
                            }
                            onClick={() =>
                              g.kind === "multi" ? pickMulti(g.id, o.id) : pickSingle(g.id, o.id)
                            }
                            className={`chip ${on ? "chip-on" : level ? "chip-sug" : ""}`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {g.options_source === "pump_categories" && suggested.size > 0 ? (
                    <p className="mt-1.5 text-xs text-neutral-500">
                      Conturul punctat arată categoriile potrivite materialelor bifate mai sus.
                      Cele deduse din consistență cer confirmare tehnică.
                    </p>
                  ) : null}

                  {g.allows_note ? (
                    <input
                      type="text"
                      value={form.notes[g.id] ?? ""}
                      onChange={(e) => update({ notes: { ...form.notes, [g.id]: e.target.value } })}
                      placeholder="Altele — scrie cu cuvintele lui"
                      className="input mt-2 text-sm"
                    />
                  ) : null}
                </fieldset>
              ))}
            </div>
          </details>
        );
      })}

      {payback ? (
        <section className="card mt-4 border-brand-200 p-4">
          <h2 className="text-base font-semibold">Calculul pentru el</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Pe cifrele lui, cu randamentul de {assumptions.productivityFactor}× și{" "}
            {assumptions.workingDaysPerMonth} zile lucrate pe lună.
          </p>

          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Face acum</dt>
              <dd className="tabular-nums">
                {formatNumber(payback.unitsNow)} {assumptions.unitShort}/zi
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Ar face mecanizat</dt>
              <dd className="tabular-nums">
                {formatNumber(payback.unitsMechanised)} {assumptions.unitShort}/zi
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">În plus pe zi</dt>
              <dd className="tabular-nums">
                {formatNumber(payback.extraUnitsPerDay)} {assumptions.unitShort} ·{" "}
                {formatMoney(payback.extraLeiPerDay)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-neutral-200 pt-1.5 font-semibold">
              <dt>În plus pe lună</dt>
              <dd className="tabular-nums">{formatMoney(payback.extraLeiPerMonth)}</dd>
            </div>
            {payback.months !== null ? (
              <div className="flex justify-between gap-3 text-base font-semibold text-brand-700">
                <dt>Pompa se plătește în</dt>
                <dd className="tabular-nums">
                  {formatNumber(payback.months)} {payback.months === 1 ? "lună" : "luni"}
                </dd>
              </div>
            ) : toateLaCerere ? (
              <p className="pt-1 text-xs text-neutral-500">
                Modelele alese se configurează la comandă, deci n-au preț de listă. Cere prețul
                la birou și calculul se completează singur.
              </p>
            ) : (
              <p className="pt-1 text-xs text-neutral-500">
                Alege un model mai sus ca să vezi în câte luni se plătește.
              </p>
            )}
          </dl>

          {payback.demandWarning ? (
            <p className="hint mt-3">
              A spus că <b>nu refuză lucrări</b>. Calculul presupune că are de lucru cât să umple
              capacitatea în plus — deocamdată n-are. Cu el, argumentul nu e viteza, ci efortul,
              calitatea constantă sau oamenii pe care nu-i găsește.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="hint mt-4">
          Bifează <b>cât face pe zi</b> ({assumptions.unitLabel}) și <b>cât ia pe{" "}
          {assumptions.unitShort}</b> ca să apară calculul de amortizare, cel care mută discuția de
          la „e scumpă” la „când o iau”.
        </p>
      )}

      {/* Loc sub ultimul card, ca bara de jos să nu-l acopere. */}
      <div className="h-20" aria-hidden />

      <div className="fixed inset-x-0 bottom-[57px] z-20 border-t border-neutral-200 bg-white px-3.5 py-2">
        <div className="mx-auto flex max-w-[760px] items-center gap-3">
          <span
            className={`flex-1 text-sm ${
              status === "error" ? "font-semibold text-[var(--color-bad)]" : "text-neutral-500"
            }`}
          >
            {STATUS_TEXT[status]}
          </span>
          <button type="button" onClick={flush} className="btn btn-secondary">
            Salvează
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="btn btn-ok btn-lg"
          >
            {finishing ? "Se încheie…" : "Termină vizita"}
          </button>
        </div>
        {finishError ? (
          <p role="alert" className="mx-auto mt-1.5 max-w-[760px] text-sm font-semibold text-[var(--color-bad)]">
            {finishError}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Data pasului următor: variantele uzuale dintr-o apăsare, restul din calendar. */
function NextStepDate({
  value,
  today,
  optional,
  onChange,
}: {
  value: string;
  today: string;
  optional: boolean;
  onChange: (date: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quickDates(today).map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => onChange(value === q.date ? "" : q.date)}
            className={`chip flex-col justify-center rounded-xl py-1.5 ${value === q.date ? "chip-on" : ""}`}
          >
            <span>{q.label}</span>
            <span className="text-xs opacity-80">{shortDay(q.date)}</span>
          </button>
        ))}
      </div>
      <input
        type="date"
        value={value}
        min={today}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-2 min-h-12"
        aria-label="Altă dată"
      />
      <p className="mt-1.5 text-xs text-neutral-500">
        {optional
          ? "Ai ales să nu mai insiști, deci data nu e obligatorie."
          : value
            ? `Firma îți apare în agendă ${shortDay(value)}.`
            : "Obligatorie la încheierea vizitei: în ziua aleasă firma îți apare pe ecranul „Azi”."}
      </p>
    </div>
  );
}

function PumpPicker({
  pumps,
  selected,
  onToggle,
}: {
  pumps: PumpOption[];
  selected: string[];
  onToggle: (sku: string) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = needle
    ? pumps.filter((p) => `${p.name} ${p.sku} ${p.category ?? ""}`.toLowerCase().includes(needle)).slice(0, 40)
    : pumps.filter((p) => selected.includes(p.sku));

  return (
    <div>
      {selected.length ? (
        <p className="mb-2 text-sm">
          {selected.length} {selected.length === 1 ? "model ales" : "modele alese"}
        </p>
      ) : null}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută modelul discutat"
        className="input"
      />
      <ul className="mt-2 space-y-1">
        {list.map((p) => {
          const on = selected.includes(p.sku);
          return (
            <li key={p.sku}>
              <button
                type="button"
                onClick={() => onToggle(p.sku)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  on ? "border-brand-600 bg-brand-50" : "border-neutral-200 bg-white"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-neutral-500">
                  {p.sku} · {formatCatalogPrice(p.unit_price, p.price_on_request)}
                  {p.price_on_request ? "" : " fără TVA"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {needle && list.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Niciun model găsit.</p>
      ) : null}
    </div>
  );
}
