import { cache } from "react";

import { type Domain, matchesDomain } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import type { QuestionGroup, QuestionSection } from "@/lib/teren";

/**
 * Catalogul de întrebări din vizită. Stă în baza de date, nu în cod, deci
 * adăugarea unei întrebări noi nu cere deploy. `cache` îl încarcă o dată per cerere.
 *
 * Cu un domeniu dat, catalogul se îngustează la ce are sens acolo: un atelier
 * auto nu e întrebat în ce fază e tencuiala, iar „cât ia pe mp” devine „cât ia
 * pe mașină”. Fără domeniu — la raportare, unde se numără toate firmele — se
 * întoarce vocabularul întreg.
 */
const visibleIn = (domainId: string | null, domains?: string[] | null) =>
  !domainId || !domains || domains.length === 0 || domains.includes(domainId);

export const getQuestionCatalogue = cache(
  async (orgId: string, domain: Domain | null = null): Promise<QuestionSection[]> => {
    const supabase = await createClient();
    const domainId = domain?.id ?? null;

    const [{ data: sections }, { data: groups }, { data: options }] = await Promise.all([
      supabase.from("question_sections").select("*").order("position"),
      supabase.from("question_groups").select("*").order("position"),
      supabase.from("question_options").select("*").order("position"),
    ]);

    // Grupurile care își iau opțiunile din catalog: categoriile de pompe și de accesorii.
    const needsCatalog = (groups ?? []).some((g) => g.options_source);
    let pumpCategories: string[] = [];
    let accessoryCategories: string[] = [];

    if (needsCatalog) {
      const { data: items } = await supabase
        .from("catalog_items")
        .select("category, tech_type")
        .eq("org_id", orgId)
        .not("category", "is", null);

      const rows = (items ?? []) as { category: string | null; tech_type: string | null }[];
      const all = [...new Set(rows.map((i) => i.category as string))].sort((a, b) =>
        a.localeCompare(b, "ro"),
      );
      accessoryCategories = all.filter((c) => c.startsWith("Accesorii"));
      // Categoriile de pompe se îngustează la domeniul firmei: agentului nu-i
      // folosește la nimic o listă cu pompe de tencuit la un atelier auto.
      const potrivite = new Set(rows.filter((i) => matchesDomain(domain, i)).map((i) => i.category as string));
      pumpCategories = all.filter((c) => !c.startsWith("Accesorii") && potrivite.has(c));
    }

    const byGroup = new Map<string, { id: string; label: string; value: number | null; domains: string[] | null }[]>();
    for (const o of options ?? []) {
      if (!visibleIn(domainId, o.domains)) continue;
      const list = byGroup.get(o.group_id) ?? [];
      list.push({ id: o.id, label: o.label, value: o.value ?? null, domains: o.domains ?? null });
      byGroup.set(o.group_id, list);
    }

    const catalogOptions = (source: string | null) => {
      const source_ =
        source === "pump_categories"
          ? pumpCategories
          : source === "accessory_categories"
            ? accessoryCategories
            : [];
      return source_.map((c) => ({ id: c, label: c.replace(/^Accesorii — /, ""), value: null, domains: null }));
    };

    return (sections ?? []).map((s) => ({
      ...s,
      groups: (groups ?? [])
        .filter((g) => g.section_id === s.id && visibleIn(domainId, g.domains))
        .map(
          (g): QuestionGroup => ({
            ...g,
            label: (domainId && (g.label_by_domain as Record<string, string> | null)?.[domainId]) || g.label,
            options: g.options_source ? catalogOptions(g.options_source) : (byGroup.get(g.id) ?? []),
          }),
        )
        // Un grup rămas fără nicio opțiune în domeniul ales n-are ce căuta pe ecran.
        .filter((g) => g.kind !== "single" && g.kind !== "multi" ? true : g.options.length > 0),
    }));
  },
);

/** Eticheta unei opțiuni, pentru afișare în liste și pe fișa firmei. */
export function optionLabel(
  sections: QuestionSection[],
  groupId: string,
  optionId: string,
): string {
  for (const s of sections) {
    const g = s.groups.find((x) => x.id === groupId);
    if (g) return g.options.find((o) => o.id === optionId)?.label ?? optionId;
  }
  return optionId;
}
