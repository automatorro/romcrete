"use client";

import { useState } from "react";

const PUMPS = [
  {
    sku: "gx19",
    name: "Graco GX 19 (Entry Level)",
    price: 4_500,
    application: "Zugrăvit și vopsire fluidă.",
    priceNote: "Valoare preluată din calculatorul inițial; confirmă prețul actual.",
  },
  {
    sku: "gx21",
    name: "Graco GX 21 (zugrăvit)",
    price: 6_000,
    application: "Zugrăvit și vopsire fluidă.",
    priceNote: "Valoare preluată din calculatorul inițial; confirmă prețul actual.",
  },
  {
    sku: "hp110-gx21",
    name: "Pachet ToughTek HP110 + GX 21",
    price: 32_000,
    application: "Pachet pentru aplicarea materialelor vâscoase și lucrări de zugrăvit.",
    priceNote: "Valoare promoțională preluată din calculatorul inițial; confirmă oferta actuală.",
  },
  {
    sku: "2012264",
    name: "Graco ToughTek HP110",
    price: 29_153,
    application: "Gleturi grele, adezivi vâscoși cu granule și materiale premixate pe bază de gips.",
    priceNote: "Preț orientativ din catalog, cu TVA inclus. Confirmă prețul și configurația la ofertare.",
  },
  {
    sku: "17H577",
    name: "Graco RTX 5500 PI (interior)",
    price: 41_577,
    application: "Texturi și finisaje decorative pentru lucrări de interior.",
    priceNote: "Preț orientativ din catalog, cu TVA inclus. Confirmă prețul și configurația la ofertare.",
  },
  {
    sku: "18H405",
    name: "Graco Mark XV XT ProContractor",
    price: 71_227,
    application: "Materiale bituminoase grele, adezivi vâscoși și materiale fluide cu debit ridicat.",
    priceNote: "Preț orientativ din catalog, cu TVA inclus. Confirmă prețul și configurația la ofertare.",
  },
  {
    sku: "2012263",
    name: "Graco ToughTek LP120",
    price: 35_990,
    application: "Tencuieli decorative fine, adezivi pentru polistiren și materiale premixate ușoare.",
    priceNote: "Preț orientativ din catalog, cu TVA inclus. Confirmă prețul și configurația la ofertare.",
  },
  {
    sku: "17X986",
    name: "Graco T-MAX 6912",
    price: 49_990,
    application: "Glet, tencuieli, finisaje decorative și materiale texturate.",
    priceNote: "Preț orientativ din catalog, cu TVA inclus. Confirmă prețul și configurația la ofertare.",
  },
] as const;

const money = new Intl.NumberFormat("ro-RO", {
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat("ro-RO", {
  maximumFractionDigits: 1,
});

function NumberField({
  id,
  label,
  value,
  onChange,
  min = "0",
  step = "1",
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  step?: string;
  suffix: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input pr-20 tabular-nums"
          inputMode="decimal"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export function CalculatorForm({ standalone = false }: { standalone?: boolean }) {
  const [surface, setSurface] = useState("2000");
  const [dailyLaborCost, setDailyLaborCost] = useState("400");
  const [manualRate, setManualRate] = useState("150");
  const [manualWorkers, setManualWorkers] = useState("4");
  const [mechanisedRate, setMechanisedRate] = useState("600");
  const [mechanisedWorkers, setMechanisedWorkers] = useState("2");
  const [pumpSku, setPumpSku] = useState<string>(PUMPS[2].sku);

  const values = [surface, dailyLaborCost, manualRate, manualWorkers, mechanisedRate, mechanisedWorkers].map(Number);
  const valid =
    values.every((value) => Number.isFinite(value) && value > 0) &&
    Number.isInteger(Number(manualWorkers)) &&
    Number.isInteger(Number(mechanisedWorkers));
  const pump = PUMPS.find((item) => item.sku === pumpSku) ?? PUMPS[0];
  const [area, dailyCost, manualUnits, manualCrew, mechanisedUnits, mechanisedCrew] = values;

  const manualDays = valid ? area / manualUnits : 0;
  const mechanisedDays = valid ? area / mechanisedUnits : 0;
  const manualCost = valid ? manualDays * manualCrew * dailyCost : 0;
  const mechanisedCost = valid ? mechanisedDays * mechanisedCrew * dailyCost : 0;
  const laborDifference = manualCost - mechanisedCost;
  const paybackProjects = laborDifference > 0 ? pump.price / laborDifference : null;

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-6xl">
        {standalone ? (
          <header className="border-b border-neutral-200 pb-4 print:hidden">
            <p className="text-sm font-semibold text-brand-700">Romcrete</p>
          </header>
        ) : null}

        <div className="grid gap-8 py-8 print:block lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:gap-12 lg:py-12">
          <section aria-labelledby="page-title" className="print:hidden">
            <p className="text-xs font-semibold uppercase text-brand-700">Instrument de estimare</p>
            <h1 id="page-title" className="mt-2 max-w-2xl text-3xl font-semibold text-neutral-900 sm:text-4xl">
              Calculează recuperarea investiției
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
              Introdu datele lucrării și costul echipei. Compară manopera estimată și vezi câte
              proiecte similare ar acoperi prețul pompei.
            </p>

            <div className="mt-8 space-y-8">
              <section aria-labelledby="job-heading">
                <div className="mb-4 flex items-baseline gap-3 border-b border-neutral-200 pb-2">
                  <span className="text-xs font-semibold text-brand-700">01</span>
                  <h2 id="job-heading" className="text-lg font-semibold text-neutral-900">
                    Datele lucrării
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="surface"
                    label="Suprafața proiectului"
                    value={surface}
                    onChange={setSurface}
                    step="100"
                    suffix="m²"
                  />
                  <NumberField
                    id="daily-labor-cost"
                    label="Cost pe om, pe zi"
                    value={dailyLaborCost}
                    onChange={setDailyLaborCost}
                    step="50"
                    suffix="lei / zi"
                  />
                </div>
              </section>

              <section aria-labelledby="pump-heading">
                <div className="mb-4 flex items-baseline gap-3 border-b border-neutral-200 pb-2">
                  <span className="text-xs font-semibold text-brand-700">02</span>
                  <h2 id="pump-heading" className="text-lg font-semibold text-neutral-900">
                    Echipamentul
                  </h2>
                </div>
                <label htmlFor="pump" className="label">
                  Alege pompa
                </label>
                <select
                  id="pump"
                  value={pumpSku}
                  onChange={(event) => setPumpSku(event.target.value)}
                  className="input"
                >
                  {PUMPS.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.name} · {money.format(item.price)} lei
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className="max-w-xl text-neutral-600">{pump.application}</p>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  {pump.priceNote}
                </p>
              </section>

              <details open className="border-t border-neutral-200 pt-5">
                <summary className="cursor-pointer text-base font-semibold text-neutral-900">
                  Ipotezele de productivitate
                </summary>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Valorile inițiale sunt doar un exemplu. Modifică-le după material, șantier și
                  experiența echipei; calculatorul nu presupune că orice pompă are același randament.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="manual-rate"
                    label="Randament manual"
                    value={manualRate}
                    onChange={setManualRate}
                    suffix="m² / zi"
                  />
                  <NumberField
                    id="manual-workers"
                    label="Oameni, manual"
                    value={manualWorkers}
                    onChange={setManualWorkers}
                    step="1"
                    suffix="oameni"
                  />
                  <NumberField
                    id="mechanised-rate"
                    label="Randament mecanizat"
                    value={mechanisedRate}
                    onChange={setMechanisedRate}
                    suffix="m² / zi"
                  />
                  <NumberField
                    id="mechanised-workers"
                    label="Oameni, mecanizat"
                    value={mechanisedWorkers}
                    onChange={setMechanisedWorkers}
                    step="1"
                    suffix="oameni"
                  />
                </div>
              </details>
            </div>
          </section>

          <aside aria-labelledby="results-heading" aria-live="polite" className="lg:pt-1">
            <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase text-brand-700">Rezultatul estimării</p>
              <h2 id="results-heading" className="mt-1 text-xl font-semibold text-neutral-900">
                {pump.name}
              </h2>

              {!valid ? (
                <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Completează toate valorile cu un număr mai mare decât zero pentru a vedea estimarea.
                </p>
              ) : (
                <>
                  <div className="mt-6 border-b border-neutral-200 pb-5">
                    <p className="text-sm text-neutral-600">
                      {laborDifference >= 0 ? "Diferență estimată de manoperă" : "Cost suplimentar estimat de manoperă"}
                    </p>
                    <p className={`mt-1 text-3xl font-semibold tabular-nums ${laborDifference >= 0 ? "text-brand-700" : "text-amber-800"}`}>
                      {money.format(Math.abs(laborDifference))} lei
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">pentru proiectul introdus</p>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-neutral-600">Manual · {manualCrew} oameni</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {decimal.format(manualDays)} zile · {money.format(manualCost)} lei
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-neutral-600">Mecanizat · {mechanisedCrew} oameni</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {decimal.format(mechanisedDays)} zile · {money.format(mechanisedCost)} lei
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3">
                      <dt className="text-neutral-600">Preț pompă / pachet, orientativ</dt>
                      <dd className="text-right font-medium tabular-nums">{money.format(pump.price)} lei</dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-md bg-brand-50 p-4">
                    <p className="text-sm font-semibold text-neutral-900">Recuperarea investiției</p>
                    {paybackProjects === null ? (
                      <p className="mt-1 text-sm leading-6 text-neutral-700">
                        Cu aceste ipoteze, economia de manoperă nu acoperă prețul pompei. Ajustează
                        randamentele sau discută și valoarea capacității suplimentare.
                      </p>
                    ) : paybackProjects <= 1 ? (
                      <p className="mt-1 text-sm leading-6 text-neutral-700">
                        Investiția s-ar recupera în timpul primului proiect de această dimensiune,
                        dacă economia estimată se confirmă.
                      </p>
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-neutral-700">
                        Aproximativ <b className="tabular-nums">{decimal.format(paybackProjects)} proiecte</b> de
                        această dimensiune, dacă economia estimată se repetă la fiecare lucrare.
                      </p>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                disabled={!valid}
                className="btn btn-secondary no-print mt-5 w-full"
              >
                Tipărește estimarea
              </button>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500">
              Estimare orientativă bazată doar pe manoperă și valorile introduse. Nu include materiale,
              pregătirea și curățarea echipamentului, consumabile, mentenanță, finanțare sau taxe.
              Rezultatul nu reprezintă o garanție de productivitate ori de recuperare a investiției.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}