"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export type FilterOption = { value: string; label: string; count?: number };

export type FilterGroup = {
  /** Parametrul din adresă: `etapa`, `prio`, `dom`. */
  param: string;
  /** Titlul grupului în panou: „Etapa”, „Prioritate”. */
  label: string;
  options: FilterOption[];
  /** Prima opțiune, fără filtru: „Toate”, „Toți agenții”. Lipsește la grupurile obligatorii. */
  allLabel?: string;
  /** O singură bifă, pornit/oprit: „Doar pașii restanți”. */
  toggle?: boolean;
  /** Pus în fața opțiunii pe rândul filtrelor active: „Prioritate” + „A”. */
  pillPrefix?: string;
};

export type Preset = { label: string; params: Record<string, string> };

type Props = {
  /** Pagina pe care se aplică filtrele: `/teren/firme`. */
  path: string;
  /** Parametrii din adresă, cei care au valoare. */
  params: Record<string, string>;
  groups: FilterGroup[];
  /** Căutarea liberă, în același rând cu butonul de filtre. */
  search?: { param: string; placeholder: string };
  /** Combinațiile folosite des, dintr-o atingere. Apar cât timp nu e niciun filtru pus. */
  presets?: Preset[];
  /** Filtre venite din altă parte (de pe „Azi”, pe localitate), fără loc în panou. */
  extra?: { param: string; label: string }[];
  /** Fixat sus la derulare: lista se poate parcurge fără să pierzi din vedere ce ai ales. */
  sticky?: boolean;
};

const urlFor = (path: string, params: Record<string, string>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
};

const without = (params: Record<string, string>, ...keys: string[]) =>
  Object.fromEntries(Object.entries(params).filter(([k]) => !keys.includes(k)));

/** Peste câte opțiuni un grup devine listă derulantă: pe telefon, alegătorul sistemului. */
const SELECT_FROM = 9;

// Variantele Tailwind nu se pot pune pe .chip-on (e în @layer components): se scriu explicit.
const CHECKED = "has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-brand-200";

/**
 * Bara de filtre a unei liste: căutarea și butonul „Filtre” pe un rând, iar
 * dedesubt, tot pe un singur rând, ce e aplicat acum (cu ✕) sau scurtăturile.
 * Opțiunile stau într-un panou care urcă de jos, grupate pe titluri, deci lista
 * începe imediat sub bară. Filtrele rămân în adresă, ca înainte.
 */
export function FilterBar({ path, params, groups, search, presets = [], extra = [], sticky = true }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  // Panoul pornește de fiecare dată din filtrele aplicate, nu din ce ai bifat și ai închis.
  const [openCount, setOpenCount] = useState(0);

  const filterParams = [...groups.map((g) => g.param), ...extra.map((e) => e.param)];
  const pills: { key: string; label: string; href?: string }[] = [];
  for (const g of groups) {
    const v = params[g.param];
    if (!v) continue;
    const opt = g.options.find((o) => o.value === v);
    const text = opt?.label ?? v;
    pills.push({
      key: g.param,
      label: g.pillPrefix ? `${g.pillPrefix} ${text}` : text,
      // Grupurile fără „Toate” au mereu o valoare: se schimbă din panou, nu se scot.
      href: g.allLabel !== undefined || g.toggle ? urlFor(path, without(params, g.param)) : undefined,
    });
  }
  for (const e of extra) {
    if (params[e.param]) pills.push({ key: e.param, label: e.label, href: urlFor(path, without(params, e.param)) });
  }
  const removable = pills.filter((p) => p.href);
  const clearHref = urlFor(path, without(params, ...filterParams));

  const open = () => {
    setOpenCount((n) => n + 1);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const apply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next = without(params, ...groups.map((g) => g.param));
    for (const g of groups) {
      const v = data.get(g.param);
      if (typeof v === "string" && v) next[g.param] = v;
    }
    close();
    router.push(urlFor(path, next));
  };

  const submitSearch = (value: string) => {
    if (!search) return;
    router.push(urlFor(path, { ...params, [search.param]: value.trim() }));
  };

  const presetOn = (p: Preset) =>
    filterParams.every((k) => (params[k] ?? "") === (p.params[k] ?? ""));

  return (
    <div className={sticky ? "filter-bar" : "space-y-2"}>
      <div className="flex gap-2">
        {search ? (
          <form
            role="search"
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(String(new FormData(e.currentTarget).get(search.param) ?? ""));
            }}
          >
            <input
              type="search"
              name={search.param}
              key={params[search.param] ?? ""}
              defaultValue={params[search.param] ?? ""}
              placeholder={search.placeholder}
              enterKeyHint="search"
              // ✕-ul din câmp golește căutarea: lista revine fără apăsare pe Enter.
              onChange={(e) => {
                if (!e.target.value && params[search.param]) submitSearch("");
              }}
              className="input min-h-12"
            />
          </form>
        ) : null}
        {groups.length ? (
          <button
            type="button"
            onClick={open}
            aria-haspopup="dialog"
            className={`btn btn-lg shrink-0 ${removable.length ? "btn-primary" : "btn-secondary"} ${search ? "" : "w-full sm:w-auto"}`}
          >
            <FilterIcon />
            Filtre
            {removable.length ? (
              <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-brand-700 tabular-nums">
                {removable.length}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {pills.length ? (
        <div className="chip-row" aria-label="Filtre aplicate">
          {pills.map((p) =>
            p.href ? (
              <Link key={p.key} href={p.href} className="chip chip-s chip-on shrink-0" aria-label={`Scoate filtrul ${p.label}`}>
                {p.label}
                <span aria-hidden className="ml-1.5 text-base leading-none opacity-80">
                  ✕
                </span>
              </Link>
            ) : (
              <button key={p.key} type="button" onClick={open} className="chip chip-s shrink-0 border-brand-600 text-brand-700">
                {p.label}
              </button>
            ),
          )}
          {removable.length > 1 ? (
            <Link href={clearHref} className="chip chip-s chip-alt shrink-0">
              Șterge tot
            </Link>
          ) : null}
        </div>
      ) : presets.length ? (
        <nav className="chip-row" aria-label="Scurtături">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={urlFor(path, { ...without(params, ...filterParams), ...p.params })}
              aria-current={presetOn(p) ? "true" : undefined}
              className="chip chip-s shrink-0"
            >
              {p.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <dialog
        ref={dialog}
        className="sheet"
        aria-label="Filtre"
        // Atingerea în afara panoului îl închide, ca la orice panou de telefon.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <form key={openCount} onSubmit={apply} className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <h2 className="text-base font-semibold">Filtre</h2>
            <button type="button" onClick={close} className="btn btn-ghost -mr-2 px-3 text-lg" aria-label="Închide">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
            {groups.map((g) => (
              <fieldset key={g.param}>
                <legend className="mb-2 text-sm font-semibold text-neutral-700">{g.label}</legend>
                {g.toggle ? (
                  <label className={`chip chip-s ${CHECKED}`}>
                    <input
                      type="checkbox"
                      name={g.param}
                      value={g.options[0]?.value}
                      defaultChecked={Boolean(params[g.param])}
                      className="sr-only"
                    />
                    {g.options[0]?.label}
                  </label>
                ) : g.options.length >= SELECT_FROM ? (
                  <select name={g.param} defaultValue={params[g.param] ?? ""} className="input min-h-12">
                    {g.allLabel !== undefined ? <option value="">{g.allLabel}</option> : null}
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                        {o.count !== undefined ? ` (${o.count})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...(g.allLabel !== undefined ? [{ value: "", label: g.allLabel } as FilterOption] : []), ...g.options].map(
                      (o) => (
                        <label key={o.value || "_toate"} className={`chip chip-s ${CHECKED}`}>
                          <input
                            type="radio"
                            name={g.param}
                            value={o.value}
                            defaultChecked={(params[g.param] ?? "") === o.value}
                            className="sr-only"
                          />
                          {o.label}
                          {o.count !== undefined ? (
                            <span className="ml-1.5 tabular-nums opacity-70">{o.count}</span>
                          ) : null}
                        </label>
                      ),
                    )}
                  </div>
                )}
              </fieldset>
            ))}
          </div>

          <div className="flex gap-2 border-t border-neutral-200 px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Link href={clearHref} onClick={close} className="btn btn-secondary btn-lg flex-1 whitespace-nowrap">
              Șterge tot
            </Link>
            <button type="submit" className="btn btn-primary btn-lg flex-1">
              Aplică
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5h14M6 10h8M8.5 15h3" />
    </svg>
  );
}
