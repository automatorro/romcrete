"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  importApply,
  importCrawl,
  importPhotos,
  importSeeds,
  importTestPage,
  type ApplyResult,
} from "@/app/(app)/catalog/import/actions";
import { formatSku } from "@/lib/cautare-catalog";
import { categoryFor, planImport, type ExistingItem, type ImportPlan } from "@/lib/catalog-import";
import { urlKey, type PageReading, type ShopProduct } from "@/lib/magazin-import";
import type { PhotoResult } from "@/lib/magazin-poze";

/** Câte pagini cere browserul odată; serverul le citește câte 4 în paralel. */
const CRAWL_BATCH = 12;
/** Oprire de siguranță: magazinul are sute de pagini, nu zeci de mii. */
const MAX_PAGES = 6000;
const APPLY_BATCH = 40;

type Crawl = {
  running: boolean;
  finished: boolean;
  stopped: boolean;
  read: number;
  queued: number;
  failed: string[];
  notes: string[];
};

const lei = (n: number | null) =>
  n ? `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei` : "la cerere";

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export function ImportWizard({
  existing,
  vatRate,
  photos,
}: {
  existing: ExistingItem[];
  vatRate: number;
  photos: { saved: number; missing: number };
}) {
  const [crawl, setCrawl] = useState<Crawl>({ running: false, finished: false, stopped: false, read: 0, queued: 0, failed: [], notes: [] });
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [productUrls, setProductUrls] = useState<string[]>([]);
  const stopRef = useRef(false);

  const [off, setOff] = useState<Set<string> | null>(null);
  const [applying, setApplying] = useState<{ done: number; total: number } | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);

  const plan: ImportPlan | null = useMemo(
    () => (crawl.finished || crawl.stopped) && products.length ? planImport(products, existing, vatRate, productUrls) : null,
    [crawl.finished, crawl.stopped, products, existing, vatRate, productUrls],
  );
  // Dezactivările propuse (familiile înlocuite) sunt bifate; restul le bifează omul.
  const deactivate = off ?? new Set(plan?.deactivations.filter((d) => d.suggested).map((d) => d.id) ?? []);

  async function runCrawl() {
    stopRef.current = false;
    setApplied(null);
    setOff(null);
    setProducts([]);
    setProductUrls([]);
    setCrawl({ running: true, finished: false, stopped: false, read: 0, queued: 0, failed: [], notes: [] });

    let seeds: { urls: string[]; notes: string[] };
    try {
      seeds = await importSeeds();
    } catch (e) {
      setCrawl((c) => ({ ...c, running: false, notes: [e instanceof Error ? e.message : "Magazinul nu a răspuns."] }));
      return;
    }
    const seen = new Set(seeds.urls.map(urlKey));
    const queue = [...seeds.urls];
    const found = new Map<string, ShopProduct>();
    const pages: string[] = [];
    const failed: string[] = [];
    let read = 0;

    while (queue.length && !stopRef.current && read < MAX_PAGES) {
      const batch = queue.splice(0, CRAWL_BATCH);
      let result;
      try {
        result = await importCrawl(batch);
      } catch {
        // Serverul n-a răspuns deloc: paginile se mai încearcă o dată, la coadă.
        failed.push(...batch);
        read += batch.length;
        continue;
      }
      for (const page of result) {
        read++;
        if (page.error) failed.push(page.url);
        if (page.product) {
          pages.push(page.url);
          const key = urlKey(page.product.url);
          const known = found.get(key);
          found.set(key, known ? { ...known, aliases: [...new Set([...known.aliases, ...page.product.aliases])] } : page.product);
        }
        for (const link of page.links) {
          const key = urlKey(link);
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(link);
          }
        }
      }
      setCrawl((c) => ({ ...c, read, queued: queue.length, failed: [...failed] }));
      setProducts([...found.values()]);
    }

    // O a doua încercare pentru paginile care n-au răspuns.
    if (failed.length && !stopRef.current) {
      const retry = failed.splice(0);
      for (const batch of chunks(retry, CRAWL_BATCH)) {
        const result = await importCrawl(batch).catch(() => batch.map((url) => ({ url, error: "fără răspuns", product: null, links: [] })));
        for (const page of result) {
          if (page.error) failed.push(page.url);
          if (page.product) {
            pages.push(page.url);
            const key = urlKey(page.product.url);
            if (!found.has(key)) found.set(key, page.product);
          }
        }
      }
    }

    setProducts([...found.values()]);
    setProductUrls(pages);
    const notes = [...seeds.notes];
    if (read >= MAX_PAGES) notes.push(`Oprit la ${MAX_PAGES} de pagini citite — magazinul pare mai mare decât ne așteptam.`);
    setCrawl({ running: false, finished: !stopRef.current, stopped: stopRef.current, read, queued: queue.length, failed, notes });
  }

  async function runApply() {
    if (!plan) return;
    const inserts = chunks(plan.inserts, APPLY_BATCH);
    const updates = chunks(plan.updates, APPLY_BATCH);
    const seen = chunks(plan.unchanged, 400);
    const steps = Math.max(inserts.length, updates.length, seen.length, 1);
    const total: ApplyResult = { inserted: 0, updated: 0, deactivated: 0, errors: [] };
    setApplying({ done: 0, total: steps });
    for (let i = 0; i < steps; i++) {
      try {
        const r = await importApply({
          inserts: inserts[i] ?? [],
          updates: updates[i] ?? [],
          seen: seen[i] ?? [],
          deactivate: i === 0 ? [...deactivate] : [],
        });
        total.inserted += r.inserted;
        total.updated += r.updated;
        total.deactivated += r.deactivated;
        total.errors.push(...r.errors);
      } catch (e) {
        total.errors.push(`Calupul ${i + 1}: ${e instanceof Error ? e.message : "eroare"}`);
      }
      setApplying({ done: i + 1, total: steps });
    }
    setApplying(null);
    setApplied(total);
  }

  const existingOnShop = existing.filter((e) => e.shop_url).length;
  const recognized = plan ? plan.updates.length + plan.unchanged.length : 0;

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-semibold">1. Inventarul magazinului</h2>
        <p className="text-sm text-neutral-600">
          Robotul pornește de la pagina de catalog și urmează toate legăturile, categorie cu categorie. Nu scrie nimic
          în catalog. Durează câteva minute; lasă pagina deschisă.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={crawl.running} onClick={runCrawl}>
            {crawl.running ? "Se citește magazinul…" : crawl.finished || crawl.stopped ? "Reia inventarul" : "Pornește inventarul"}
          </button>
          {crawl.running ? (
            <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
              Oprește
            </button>
          ) : null}
        </div>
        {crawl.read || crawl.running ? (
          <p className="text-sm tabular-nums">
            {crawl.read} pagini citite · {crawl.queued} în așteptare · <strong>{products.length} produse găsite</strong>
            {crawl.failed.length ? <span className="text-amber-700"> · {crawl.failed.length} pagini fără răspuns</span> : null}
          </p>
        ) : null}
        {crawl.notes.map((n) => (
          <p key={n} className="text-sm text-neutral-600">
            {n}
          </p>
        ))}
        {crawl.stopped ? (
          <p className="text-sm text-amber-700">
            Inventar oprit înainte de final: poți aplica ce s-a găsit, dar lista „nu mai apare în magazin” nu e sigură.
          </p>
        ) : null}
        {crawl.failed.length && !crawl.running ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-amber-700">Paginile care n-au răspuns ({crawl.failed.length})</summary>
            <ul className="mt-2 list-disc pl-5 break-all text-neutral-600">
              {crawl.failed.slice(0, 100).map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {(crawl.finished || crawl.stopped) && !products.length ? (
          <p className="text-sm text-red-700">
            Robotul n-a recunoscut nicio pagină de produs. Verifică o pagină de produs mai jos („Verifică o pagină”) și
            trimite rezultatul, ca să ajustăm cititorul.
          </p>
        ) : null}
      </section>

      {plan ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">2. Ce se schimbă în catalog</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Produse (pagini) în magazin" value={products.length} />
            <Stat label="Poziții, câte una pe cod" value={plan.rows} />
            <Stat label="Poziții noi de adăugat" value={plan.inserts.length} strong />
            <Stat label="Poziții existente de actualizat" value={plan.updates.length} />
            <Stat label="Poziții existente, neschimbate" value={plan.unchanged.length} />
            <Stat label="Dubluri între categorii (intră o dată)" value={plan.duplicates} />
          </ul>
          <p className="text-sm text-neutral-600">
            Verificare: din cele {existingOnShop} poziții din catalog care au adresă în magazin, {recognized} au fost
            recunoscute.
            {plan.inserts.filter((i) => i.price_on_request).length
              ? ` ${plan.inserts.filter((i) => i.price_on_request).length} poziții noi n-au preț în magazin și intră „la cerere”.`
              : ""}
            {plan.inserts.filter((i) => !i.sku).length
              ? ` ${plan.inserts.filter((i) => !i.sku).length} n-au cod și apar cu codul „la cerere”.`
              : ""}
          </p>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              Pozițiile noi ({plan.inserts.length})
            </summary>
            <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left">
                  <tr>
                    <th className="px-2 py-1">Denumire</th>
                    <th className="px-2 py-1">Cod</th>
                    <th className="px-2 py-1">Categorie</th>
                    <th className="px-2 py-1 text-right">Preț cu TVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {plan.inserts.map((i, n) => (
                    <tr key={`${i.sku ?? i.name}-${n}`}>
                      <td className="px-2 py-1">
                        <a href={i.shop_url} target="_blank" rel="noreferrer" className="hover:underline">
                          {i.name}
                        </a>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{formatSku(i.sku)}</td>
                      <td className="px-2 py-1 text-neutral-500">{i.category}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{lei(i.price_with_vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              Pozițiile actualizate ({plan.updates.length})
            </summary>
            <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm">
              {plan.updates.map((u) => (
                <li key={u.id}>
                  <strong>{u.name}</strong>: {u.what.join("; ")}
                </li>
              ))}
            </ul>
          </details>

          {plan.deactivations.length ? (
            <details open>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                De dezactivat ({deactivate.size} bifate din {plan.deactivations.length})
              </summary>
              <p className="mt-2 text-sm text-neutral-600">
                Nu se șterge nimic: o poziție dezactivată rămâne pe ofertele vechi și se poate reactiva din catalog.
              </p>
              <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm">
                {plan.deactivations.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={deactivate.has(d.id)}
                        onChange={(e) => {
                          const next = new Set(deactivate);
                          if (e.target.checked) next.add(d.id);
                          else next.delete(d.id);
                          setOff(next);
                        }}
                      />
                      <span>
                        {d.name} <span className="text-neutral-500">({formatSku(d.sku)}) — {d.reason}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(applying) || Boolean(applied) || crawl.running}
              onClick={runApply}
            >
              {applying ? `Se scrie… ${applying.done}/${applying.total}` : applied ? "Aplicat" : "Aplică în catalog"}
            </button>
            {applied ? (
              <p className="text-sm">
                {applied.inserted} adăugate · {applied.updated} actualizate · {applied.deactivated} dezactivate
                {applied.errors.length ? <span className="text-red-700"> · {applied.errors.length} erori</span> : null}
                {" · "}
                <Link href="/catalog" className="font-medium text-brand-700 hover:underline">
                  Vezi catalogul
                </Link>
              </p>
            ) : null}
          </div>
          {applied?.errors.length ? (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {applied.errors.slice(0, 50).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <PhotosStep initial={photos} refreshKey={applied ? applied.inserted : 0} />

      <TestPage existing={existing} />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <li className="rounded-lg border border-neutral-200 px-3 py-2">
      <span className="block text-neutral-500">{label}</span>
      <span className={`text-lg tabular-nums ${strong ? "font-semibold text-brand-700" : "font-medium"}`}>{value}</span>
    </li>
  );
}

/** Pasul 3: prima poză a fiecărui produs fără poză, micșorată și păstrată în baza de date. */
function PhotosStep({ initial, refreshKey }: { initial: { saved: number; missing: number }; refreshKey: number }) {
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failures, setFailures] = useState<PhotoResult[]>([]);
  const stopRef = useRef(false);

  async function run() {
    stopRef.current = false;
    setRunning(true);
    const skip: string[] = failures.map((f) => f.id);
    let left = Infinity;
    while (left > 0 && !stopRef.current) {
      let r;
      try {
        r = await importPhotos(skip);
      } catch {
        break;
      }
      if (!r.results.length) {
        left = 0;
        break;
      }
      const bad = r.results.filter((x) => !x.ok);
      skip.push(...bad.map((x) => x.id));
      setFailures((f) => [...f, ...bad]);
      setSaved((n) => n + r.results.filter((x) => x.ok).length);
      left = r.remaining;
      setRemaining(left);
    }
    setRunning(false);
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">3. Pozele produselor</h2>
      <p className="text-sm text-neutral-600">
        Pentru fiecare produs fără poză se descarcă prima poză de pe pagina lui din magazin, micșorată pentru ofertă.
        Pozele puse de mână nu se ating. Acum: {initial.saved} cu poză, {initial.missing} fără
        {refreshKey ? " (înainte de import; produsele noi se adaugă la listă)" : ""}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={running} onClick={run}>
          {running ? "Se descarcă…" : failures.length || saved ? "Continuă" : "Descarcă pozele lipsă"}
        </button>
        {running ? (
          <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
            Oprește
          </button>
        ) : null}
        {saved || remaining !== null ? (
          <p className="text-sm tabular-nums">
            {saved} poze salvate{remaining !== null ? ` · ${remaining} rămase` : ""}
            {failures.length ? <span className="text-amber-700"> · {failures.length} fără poză</span> : null}
          </p>
        ) : null}
      </div>
      {failures.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-amber-700">Produsele la care nu s-a putut ({failures.length})</summary>
          <ul className="mt-2 list-disc pl-5 text-neutral-600">
            {failures.map((f) => (
              <li key={f.id}>
                <Link href={`/catalog/${f.id}`} className="hover:underline">
                  {f.name}
                </Link>{" "}
                — {f.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Ce înțelege robotul dintr-o singură pagină: pentru verificare, înainte de import. */
function TestPage({ existing }: { existing: ExistingItem[] }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ reading?: PageReading; links?: number; error?: string } | null>(null);
  const categories = useMemo(
    () => [...new Set(existing.map((e) => e.category).filter((c): c is string => Boolean(c)))],
    [existing],
  );
  const product = result?.reading?.product;

  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">Verifică o pagină</h2>
      <p className="text-sm text-neutral-600">
        Lipește adresa unui produs din magazin ca să vezi ce citește robotul din ea: nume, cod, preț, variante, poză.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setResult(await importTestPage(url).catch(() => ({ error: "Serverul nu a răspuns." })));
          setBusy(false);
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://shop.romcrete.ro/catalog/…"
          className="input min-w-64 flex-1"
          required
        />
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {busy ? "Se citește…" : "Verifică"}
        </button>
      </form>
      {result?.error ? <p className="text-sm text-red-700">{result.error}</p> : null}
      {result?.reading ? (
        <div className="space-y-2 text-sm">
          <p className="text-neutral-500">
            Semnale: {result.reading.signals.join(" · ")} · {result.links} legături către catalog
          </p>
          {product ? (
            <div className="flex gap-4">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image} alt="" className="h-28 w-28 shrink-0 rounded border border-neutral-200 object-contain" />
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-neutral-500">Nume</dt>
                <dd>{product.name}</dd>
                <dt className="text-neutral-500">Cod</dt>
                <dd>{formatSku(product.sku)}</dd>
                <dt className="text-neutral-500">Preț cu TVA</dt>
                <dd>{lei(product.price)}</dd>
                <dt className="text-neutral-500">Categorie</dt>
                <dd>
                  {categoryFor(product, categories)}
                  <span className="text-neutral-500"> ({product.breadcrumb.join(" › ") || "din adresă"})</span>
                </dd>
                <dt className="text-neutral-500">Adresă</dt>
                <dd className="break-all">{product.url}</dd>
                <dt className="text-neutral-500">Variante</dt>
                <dd>
                  {product.variants.length ? (
                    <ul>
                      {product.variants.map((v, i) => (
                        <li key={`${v.sku}-${i}`}>
                          {formatSku(v.sku)} — {v.name} — {lei(v.price)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "niciuna (un singur cod)"
                  )}
                </dd>
              </dl>
            </div>
          ) : (
            <p>Nu e pagină de produs (listă, categorie sau altceva).</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
