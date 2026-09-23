/**
 * Legătura dintre materialele cu care lucrează meseriașul și categoriile de pompe.
 *
 * Regulile sunt cele din aplicația de teren, păstrate ca atare: fiecare material
 * are cuvinte care îl indică și cuvinte care îl exclud. Excluderile contează —
 * „vopsea lavabilă” și „vopsea anticorozivă industrială” cer pompe complet
 * diferite, iar fără ele orice pompă de vopsit ar părea potrivită pentru orice.
 */

export type MaterialRule = {
  id: string;
  label: string;
  include: RegExp;
  exclude?: RegExp;
};

export const MATERIAL_RULES: MaterialRule[] = [
  {
    id: "tencuiala",
    label: "Tencuială (mecanizată / gips / ciment)",
    include: /tencuial|premix|stuc|plaster/,
    exclude: /industrial|epoxid|anticoroz/,
  },
  {
    id: "glet",
    label: "Glet / chit",
    include: /glet|filler|chituir|joint|umplutur|compus de îmbinare|noroi pentru gips/,
    exclude: /industrial|epoxid|anticoroz/,
  },
  {
    id: "vopsea",
    label: "Vopsea lavabilă",
    include:
      /lavabil|latex|emulsi|acrilic|pe bază de apă|vopsele decorative|vopsea de interior|vopsea de exterior|interior paint/,
    exclude: /marcaj|anticoroz|epoxid|rutier|industrial/,
  },
  {
    id: "amorsa",
    label: "Amorsă / grund",
    include: /amors|primer|grund/,
    exclude: /industrial|epoxid|anticoroz/,
  },
  { id: "sapa", label: "Șapă / autonivelant", include: /șap|autoniv|pardosel/, exclude: /anticoroz/ },
  {
    id: "termo",
    label: "Termosistem / adeziv polistiren",
    include: /eifs|polistiren|termo/,
    exclude: /anticoroz/,
  },
  {
    id: "hidro",
    label: "Hidroizolații / spumă / poliuree",
    include: /poliuree|spum|bicomponent|hidroizol|bituminos/,
    exclude: /anticoroz/,
  },
  {
    id: "email",
    label: "Email / lac / lemn",
    include: /email|enamel|\blac\b|baiț|stain|ulei|alchid/,
    exclude: /anticoroz|industrial|epoxid/,
  },
  {
    id: "indus",
    label: "Anticoroziv / ignifug (industrial)",
    include: /anticoroz|intumesc|ignifug|epoxid|industrial/,
  },
  { id: "marcaje", label: "Marcaje rutiere", include: /marcaj|rutier|trafic|reflector/ },
  // Materialele domeniilor din afara construcțiilor. Fiecare opțiune nouă din
  // `materiale` are nevoie de o regulă aici: fără ea, bifa n-ar sugera nicio
  // categorie de pompe, adică n-ar folosi la nimic.
  {
    id: "epoxid",
    label: "Epoxidice / poliuretanice bicomponente",
    include: /epoxid|bicomponent|poliuretanic/,
    exclude: /marcaj|rutier/,
  },
  {
    id: "ignifug",
    label: "Vopsea intumescentă / ignifugă",
    include: /intumesc|ignifug|protecție la foc/,
  },
  {
    id: "vopseaauto",
    label: "Vopsea auto / lacuri fine",
    include: /\blac\b|lacuri fine|emailuri fine|vopsele fine|vopsele decorative fine|baiț|finisaje fine|mobilier/,
    exclude: /anticoroz|industrial|marcaj|tencuial/,
  },
  {
    id: "rasini",
    label: "Rășini de injectare",
    include: /rășin|rasin|inject/,
  },
];

/** 2 = scrie în fișa produsului, 1 = dedus după consistență, de confirmat tehnic. */
export type MatchLevel = 1 | 2;

export type MaterialSuggestions = Record<string, Record<string, MatchLevel>>;

type CatalogRow = {
  category: string | null;
  description: string | null;
  materials: { certain?: string[]; equivalent?: string[] } | null;
};

/**
 * Pentru fiecare material, ce categorii de pompe îl acoperă și cu ce certitudine.
 * Se calculează o dată pe server; ecranul de vizită doar reunește categoriile
 * materialelor bifate, fără să primească tot catalogul în browser.
 */
export function buildMaterialSuggestions(items: CatalogRow[]): MaterialSuggestions {
  const out: MaterialSuggestions = {};

  for (const rule of MATERIAL_RULES) {
    const categories: Record<string, MatchLevel> = {};

    for (const item of items) {
      if (!item.category || item.category.startsWith("Accesorii")) continue;

      const certain = item.materials?.certain ?? [];
      const equivalent = item.materials?.equivalent ?? [];
      // Textele se testează separat: un cuvânt de excludere într-un text nu
      // trebuie să anuleze potrivirea din alt text al aceluiași produs.
      const candidates: [string, MatchLevel][] = [
        ...certain.map((t): [string, MatchLevel] => [t, 2]),
        ...equivalent.map((t): [string, MatchLevel] => [t, 1]),
        [item.description ?? "", 1],
      ];

      for (const [text, level] of candidates) {
        const haystack = text.toLowerCase();
        if (!haystack) continue;
        if (!rule.include.test(haystack)) continue;
        if (rule.exclude?.test(haystack)) continue;
        if ((categories[item.category] ?? 0) < level) categories[item.category] = level;
      }
    }

    if (Object.keys(categories).length) out[rule.id] = categories;
  }

  return out;
}
