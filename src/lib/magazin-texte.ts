import { parse, type HTMLElement } from "node-html-parser";

import type { ProductSheetTexts } from "@/lib/fisa-produs";

/**
 * Textele fișei produsului luate din pagina lui din magazin: prezentarea, ce
 * conține, avantajele, recomandările și aplicațiile. Specificațiile tehnice se
 * iau separat (vezi `shopSpecs`).
 *
 * Nu depinde de o structură anume a magazinului: caută zona de descriere a
 * produsului, o citește în ordine și împarte textul după titlurile ei
 * („Avantaje”, „Aplicații”, „Conține”…). Ce nu are titlu devine prezentare.
 * Dacă pagina n-are o zonă de descriere, rămâne descrierea scurtă a paginii.
 */

type Section = "intro" | "package_contents" | "benefits" | "recommendations" | "applications" | "skip";

const plain = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Titlul unei părți a descrierii → unde merge textul de sub el. */
function sectionOf(heading: string): Section | null {
  const h = plain(heading);
  if (/specifica|date tehnice|caracteristici tehnice|parametri|dimensiuni|descarca|documenta|manual|video|recenzi|intrebari/.test(h)) return "skip";
  if (/contin|pachet|livrat|livreaza|in cutie|include|componen|kit/.test(h)) return "package_contents";
  if (/aplica|domenii|materiale|utilizari|potrivit|ideal pentru|se foloseste/.test(h)) return "applications";
  if (/recomand|conditii de utilizare|sfaturi|intretinere|important|atentie/.test(h)) return "recommendations";
  if (/avantaj|beneficii|de ce|puncte forte|tehnologi|caracteristici|functii|functionalitati|performant/.test(h)) return "benefits";
  if (/descriere|prezentare|despre/.test(h)) return "intro";
  return null;
}

/** Rânduri care țin de magazin (coș, preț, livrare), nu de produs. */
const NOISE = /\b(pret|lei|ron|cos|adauga|comanda|stoc|livrare gratuita|transport gratuit|cookie|newsletter|login|cont|rate|finantare|recenzi)\b/;

const ENTITY: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };

function clean(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITY[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .replace(/^[\s•·*–-]+/, "")
    .trim();
}

const BLOCK = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "section", "article", "ul", "ol", "table", "tbody", "tr", "td", "dl", "dt", "dd", "blockquote", "br"]);

/** Zona de descriere a produsului: după nume (id, clasă), altfel cel mai bogat bloc de paragrafe. */
function findDescription(root: HTMLElement): HTMLElement | null {
  const candidates = root.querySelectorAll("[id],[class],[itemprop]").filter((el) => {
    const key = plain(`${el.id} ${el.classNames} ${el.getAttribute("itemprop") ?? ""}`);
    return /descri|description|product-desc|product_desc|tab-content|tabs-content|product-info|detalii|prezentare/.test(key);
  });
  const score = (el: HTMLElement) => {
    const text = el.textContent.replace(/\s+/g, " ").length;
    return text > 60 && text < 30_000 ? text : 0;
  };
  let best: { el: HTMLElement; s: number } | undefined = candidates
    .map((el) => ({ el, s: score(el) }))
    .sort((a, b) => b.s - a.s)[0];
  if (!best?.s) {
    // Fără nume de recunoscut: părintele cu cele mai multe paragrafe lungi.
    const parents = new Map<HTMLElement, number>();
    for (const p of root.querySelectorAll("p")) {
      const len = p.textContent.trim().length;
      if (len > 80 && p.parentNode) parents.set(p.parentNode as HTMLElement, (parents.get(p.parentNode as HTMLElement) ?? 0) + len);
    }
    const top = [...parents.entries()].sort((a, b) => b[1] - a[1])[0];
    best = top ? { el: top[0], s: top[1] } : undefined;
  }
  return best?.s ? best.el : null;
}

type Piece = { kind: "heading" | "para" | "item"; text: string };

/** Textul zonei, în ordine: titluri, paragrafe și puncte de listă. */
function pieces(el: HTMLElement): Piece[] {
  const out: Piece[] = [];
  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      const c = child as HTMLElement;
      const tag = c.rawTagName?.toLowerCase() ?? "";
      if (/^h[1-6]$/.test(tag)) {
        out.push({ kind: "heading", text: clean(c.textContent) });
      } else if (tag === "li") {
        out.push({ kind: "item", text: clean(c.textContent) });
      } else if (tag === "p") {
        // Un paragraf doar cu text îngroșat și scurt e, de fapt, un titlu.
        const strong = c.querySelector("strong,b");
        const text = clean(c.textContent);
        if (strong && clean(strong.textContent) === text && text.length < 80) out.push({ kind: "heading", text });
        else splitBreaks(c).forEach((t) => out.push({ kind: "para", text: t }));
      } else if (BLOCK.has(tag)) {
        // Un div cu text direct (fără paragrafe) se citește ca paragraf.
        const hasBlocks = c.childNodes.some((n) => n.nodeType === 1 && BLOCK.has((n as HTMLElement).rawTagName?.toLowerCase() ?? ""));
        if (hasBlocks) walk(c);
        else if (c.textContent.trim()) splitBreaks(c).forEach((t) => out.push({ kind: "para", text: t }));
      }
    }
  };
  walk(el);
  return out.filter((p) => p.text.length > 1);
}

/** Un paragraf cu rânduri despărțite prin <br> are, de fapt, mai multe idei. */
function splitBreaks(el: HTMLElement): string[] {
  return el.innerHTML
    .split(/<br\s*\/?>/i)
    .map((part) => clean(part.replace(/<[^>]+>/g, " ")))
    .filter(Boolean);
}

/** Descrierea scurtă a paginii: din datele produsului (JSON-LD), altfel din meta. */
function metaDescription(root: HTMLElement): string | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const list = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const node of list) {
        if (String(node?.["@type"] ?? "").toLowerCase() === "product" && typeof node.description === "string") {
          const text = clean(node.description.replace(/<[^>]+>/g, " "));
          if (text.length > 40) return text;
        }
      }
    } catch {
      // date invalide pe pagină: mergem mai departe
    }
  }
  for (const name of ['meta[property="og:description"]', 'meta[name="description"]']) {
    const text = clean(root.querySelector(name)?.getAttribute("content") ?? "");
    if (text.length > 40) return text;
  }
  return null;
}

const MAX_ITEMS = 10;
const MAX_ITEM = 320;
const MAX_INTRO = 900;

export type ShopTexts = Pick<ProductSheetTexts, "intro" | "package_contents" | "benefits" | "recommendations" | "applications">;

export function extractShopTexts(html: string): ShopTexts {
  const empty: ShopTexts = { intro: null, package_contents: null, benefits: null, recommendations: null, applications: null };
  let root: HTMLElement;
  try {
    root = parse(html, { comment: false, blockTextElements: { script: true, style: false, pre: true } });
  } catch {
    return empty;
  }
  const meta = metaDescription(root);
  for (const junk of root.querySelectorAll("header,footer,nav,form,aside,style,noscript,button,select,iframe")) junk.remove();

  const zone = findDescription(root);
  const found: Record<Exclude<Section, "skip">, string[]> = {
    intro: [],
    package_contents: [],
    benefits: [],
    recommendations: [],
    applications: [],
  };

  if (zone) {
    let current: Section = "intro";
    for (const piece of pieces(zone)) {
      if (piece.kind === "heading") {
        current = sectionOf(piece.text) ?? current;
        continue;
      }
      if (current === "skip" || NOISE.test(plain(piece.text)) || piece.text.length > 1200) continue;
      // „Presiune maximă: 227 bar” e o specificație, nu o idee: rămâne pentru tabel.
      if (/^[^:]{2,45}:\s*[\d~≈<>]/.test(piece.text) && piece.text.length < 90) continue;
      if (current === "intro") {
        // Punctele de listă de dinaintea oricărui titlu sunt, de regulă, avantajele.
        if (piece.kind === "item") found.benefits.push(piece.text);
        else found.intro.push(piece.text);
      } else {
        found[current].push(piece.text);
      }
    }
  }

  const unique = (list: string[]) => [...new Set(list)];
  const asList = (list: string[]) => {
    const items = unique(list).filter((t) => t.length <= MAX_ITEM).slice(0, MAX_ITEMS);
    return items.length ? items.join("\n") : null;
  };

  // Prezentarea: primele paragrafe, cât încap într-o casetă lizibilă pe A4.
  let intro = "";
  for (const para of unique(found.intro)) {
    if ((intro + para).length > MAX_INTRO) break;
    intro = intro ? `${intro}\n${para}` : para;
  }
  if (!intro && meta) intro = meta.slice(0, MAX_INTRO);

  return {
    intro: intro || null,
    package_contents: asList(found.package_contents),
    benefits: asList(found.benefits),
    recommendations: asList(found.recommendations),
    applications: asList(found.applications),
  };
}
