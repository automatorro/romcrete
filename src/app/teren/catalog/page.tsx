import { requireOrg } from "@/lib/auth";
import { getDomains, matchesDomain } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/totals";
import type { CatalogItem } from "@/lib/types";

export const metadata = { title: "Catalog" };

export default async function TerenCatalogPage(props: PageProps<"/teren/catalog">) {
  const { orgId } = await requireOrg();
  const { q, cat, dom } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const category = typeof cat === "string" ? cat : "";
  const domeniu = typeof dom === "string" ? dom : "";

  const domains = await getDomains(orgId);
  const domain = domains.find((d) => d.id === domeniu) ?? null;
  const supabase = await createClient();
  const { data: allRows } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("category", { ascending: true, nullsFirst: false })
    .order("unit_price", { ascending: false });

  // Filtrarea pe domeniu ține și de tehnologie: aceeași categorie servește și
  // zugrăveala, și finisajul fin.
  const all = ((allRows ?? []) as CatalogItem[]).filter((i) => (domain ? matchesDomain(domain, i) : true));
  const categories = [...new Set(all.map((i) => i.category).filter(Boolean))] as string[];

  const needle = search.toLowerCase();
  const items = all.filter(
    (i) =>
      (!category || i.category === category) &&
      (!needle || `${i.name} ${i.sku ?? ""} ${i.description ?? ""}`.toLowerCase().includes(needle)),
  );

  const chipHref = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: search, cat: category, dom: domeniu, ...patch }))
      if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/teren/catalog?${s}` : "/teren/catalog";
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Catalog</h1>
      <p className="mt-0.5 text-sm text-neutral-500">
        {items.length} din {all.length} poziții · prețuri fără TVA
      </p>

      <form className="my-3">
        {category ? <input type="hidden" name="cat" value={category} /> : null}
        {domeniu ? <input type="hidden" name="dom" value={domeniu} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Caută model, cod, material"
          className="input"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <a
          href={chipHref({ dom: null, cat: null })}
          className={`chip chip-s ${domeniu ? "" : "chip-on"}`}
        >
          Toate domeniile
        </a>
        {domains.map((d) => (
          <a
            key={d.id}
            href={chipHref({ dom: domeniu === d.id ? null : d.id, cat: null })}
            className={`chip chip-s ${domeniu === d.id ? "chip-on" : ""}`}
          >
            {d.short_label}
          </a>
        ))}
        <span className="basis-full" />
        <a href={chipHref({ cat: null })} className={`chip chip-s ${category ? "" : "chip-on"}`}>
          Toate
        </a>
        {categories.map((c) => (
          <a
            key={c}
            href={chipHref({ cat: category === c ? null : c })}
            className={`chip chip-s ${category === c ? "chip-on" : ""}`}
          >
            {c.replace(/^Accesorii — /, "")}
          </a>
        ))}
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="card p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <b className="text-[15px]">{i.name}</b>
                <p className="text-xs text-neutral-500">
                  {[i.sku, i.category].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                {formatMoney(i.unit_price)}
                <span className="block text-xs font-normal text-neutral-500">/{i.unit}</span>
              </span>
            </div>
            {i.description ? (
              <p className="mt-1.5 text-xs text-neutral-500">{i.description}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nicio poziție pentru filtrul ales.</p>
      ) : null}
    </div>
  );
}
