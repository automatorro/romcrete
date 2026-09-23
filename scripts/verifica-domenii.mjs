/**
 * Verifică legătura dintre domenii, catalog și regulile de material.
 *
 * Două lucruri se pot strica tăcut: un domeniu ale cărui categorii nu prind nicio
 * pompă din catalog (agentul vede o listă goală) și o opțiune de material fără
 * regulă în cod (bifa nu sugerează nimic). Nici tsc, nici eslint nu le văd —
 * sunt potriviri între date și expresii regulate, nu între tipuri.
 *
 * Se rulează prin scripts/verifica-domenii.sh, care pregătește dump-urile.
 */

import { readFileSync } from "node:fs";

const SC = process.argv[2];
const catalog = JSON.parse(readFileSync(`${SC}/catalog.json`, "utf8"));
const domains = JSON.parse(readFileSync(`${SC}/domains.json`, "utf8"));

// Regulile reale din cod: se extrag din fișier și se evaluează cu motorul JS,
// ca să nu verific o copie a lor, ci chiar pe ele.
const src = readFileSync(new URL("../src/lib/materiale.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("MATERIAL_RULES: MaterialRule[] = ["), src.indexOf("\n];"));
// Fiecare regulă se citește separat, ca o obiecție de parsare să nu înghită tăcut
// regulile vecine — exact greșeala pe care testul o caută în date.
const rules = [];
for (const chunk of block.split(/\n  \{/).slice(1)) {
  const id = chunk.match(/id:\s*"([^"]+)"/)?.[1];
  const inc = chunk.match(/include:\s*\n?\s*(\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/)/)?.[1];
  const exc = chunk.match(/exclude:\s*\n?\s*(\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/)/)?.[1];
  if (!id || !inc) throw new Error(`regulă necitită: ${chunk.slice(0, 60)}`);
  rules.push({ id, include: eval(inc), exclude: exc ? eval(exc) : null });
}

const matchesDomain = (d, i) =>
  d.pump_categories.length === 0
    ? true
    : Boolean(
        i.category && d.pump_categories.includes(i.category) &&
        (!d.tech_types || d.tech_types.length === 0 || (i.tech_type && d.tech_types.includes(i.tech_type))),
      );

console.log(`Reguli de material citite din cod: ${rules.length}`);
console.log("\nPompe pe domeniu (categoria + tehnologia):");
let fail = 0;
for (const d of domains) {
  const n = catalog.filter((i) => i.category && !i.category.startsWith("Accesorii") && matchesDomain(d, i)).length;
  if (n === 0) fail++;
  console.log(`  ${n === 0 ? "✗" : "✓"} ${d.label.padEnd(42)} ${String(n).padStart(3)} poziții`);
}

console.log("\nCategorii sugerate de fiecare material:");
for (const r of rules) {
  const cats = new Set();
  for (const item of catalog) {
    if (!item.category || item.category.startsWith("Accesorii")) continue;
    const texts = [
      ...(item.materials?.certain ?? []),
      ...(item.materials?.equivalent ?? []),
      item.description ?? "",
    ];
    for (const t of texts) {
      const h = t.toLowerCase();
      if (h && r.include.test(h) && !(r.exclude && r.exclude.test(h))) cats.add(item.category);
    }
  }
  if (cats.size === 0) fail++;
  console.log(`  ${cats.size === 0 ? "✗" : "✓"} ${r.id.padEnd(12)} → ${[...cats].join(", ") || "NIMIC"}`);
}

console.log(fail === 0 ? "\nOK: fiecare domeniu are pompe și fiecare material sugerează ceva." : `\n${fail} probleme`);
process.exit(fail === 0 ? 0 : 1);
