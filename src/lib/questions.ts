import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { QuestionGroup, QuestionSection } from "@/lib/teren";

/**
 * Catalogul de întrebări din vizită. Stă în baza de date, nu în cod, deci
 * adăugarea unei întrebări noi nu cere deploy. `cache` îl încarcă o dată per cerere.
 */
export const getQuestionCatalogue = cache(async (orgId: string): Promise<QuestionSection[]> => {
  const supabase = await createClient();

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
      .select("category")
      .eq("org_id", orgId)
      .not("category", "is", null);

    const all = [...new Set((items ?? []).map((i) => i.category as string))].sort((a, b) =>
      a.localeCompare(b, "ro"),
    );
    accessoryCategories = all.filter((c) => c.startsWith("Accesorii"));
    pumpCategories = all.filter((c) => !c.startsWith("Accesorii"));
  }

  const byGroup = new Map<string, { id: string; label: string }[]>();
  for (const o of options ?? []) {
    const list = byGroup.get(o.group_id) ?? [];
    list.push({ id: o.id, label: o.label });
    byGroup.set(o.group_id, list);
  }

  const catalogOptions = (source: string | null) => {
    const source_ =
      source === "pump_categories"
        ? pumpCategories
        : source === "accessory_categories"
          ? accessoryCategories
          : [];
    return source_.map((c) => ({ id: c, label: c.replace(/^Accesorii — /, "") }));
  };

  return (sections ?? []).map((s) => ({
    ...s,
    groups: (groups ?? [])
      .filter((g) => g.section_id === s.id)
      .map(
        (g): QuestionGroup => ({
          ...g,
          options: g.options_source
            ? catalogOptions(g.options_source)
            : (byGroup.get(g.id) ?? []),
        }),
      ),
  }));
});

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
