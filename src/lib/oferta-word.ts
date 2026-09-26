import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type TableVerticalAlign,
  type ParagraphChild,
} from "docx";
import sharp from "sharp";

import {
  companyFooter,
  currencyLabel,
  joinAddress,
  priceRows,
  type OfferDocument,
  type OfferProduct,
} from "@/lib/oferta-document";
import { formatDate, formatMoney, formatQuantity } from "@/lib/totals";

/**
 * Oferta ca document Word, cu același conținut și aceeași ordine ca PDF-ul,
 * ca agentul să o poată modifica înainte de trimitere.
 */

// Unitățile Word: DXA = 1/20 pt (1 cm ≈ 567); mărimea fontului în jumătăți de punct.
const CM = 567;
const PAGE_W = 21 * CM;
const MARGIN_X = Math.round(1.6 * CM);
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const FONT = "Open Sans";
const BLUE = "00B0F0";
const DARK = "262626";
const GREY = "BFBFBF";

const line: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: GREY };
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const boxBorders = { top: line, left: line, bottom: line, right: line };
const noBorders = { top: none, left: none, bottom: none, right: none, insideHorizontal: none, insideVertical: none };

type Img = { data: Buffer; type: "jpg" | "png"; width: number; height: number };

/** O poză (data: URI sau fișier), gata de pus în Word: JPG sau PNG, cu dimensiunile ei. */
async function toImage(source: string | Buffer | null): Promise<Img | null> {
  if (!source) return null;
  try {
    const input = typeof source === "string" ? Buffer.from(source.slice(source.indexOf(",") + 1), "base64") : source;
    const meta = await sharp(input).metadata();
    // Word citește doar JPG, PNG, GIF, BMP: celelalte (WEBP, AVIF) se transformă în PNG.
    if (meta.format === "jpeg" || meta.format === "png") {
      return { data: input, type: meta.format === "jpeg" ? "jpg" : "png", width: meta.width ?? 1, height: meta.height ?? 1 };
    }
    const png = await sharp(input).png().toBuffer({ resolveWithObject: true });
    return { data: png.data, type: "png", width: png.info.width, height: png.info.height };
  } catch {
    return null;
  }
}

/** Poza, încadrată într-un dreptunghi de maxW × maxH pixeli, cu proporțiile păstrate. */
function imageRun(img: Img, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
  });
}

const asset = (file: string) => readFile(path.join(process.cwd(), "public", "oferta", file)).catch(() => null);

const text = (value: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text: value, bold: opts.bold, size: opts.size, color: opts.color, font: FONT });

function para(children: ParagraphChild[] | string, opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number; keepNext?: boolean } = {}) {
  return new Paragraph({
    children: typeof children === "string" ? [text(children)] : children,
    alignment: opts.align,
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0 },
    keepNext: opts.keepNext,
  });
}

/** „Etichetă: valoare”, cu eticheta îngroșată; un rând gol nu se scrie. */
const labelled = (label: string, value: string | null | undefined) =>
  value ? para([text(`${label}: `, { bold: true }), text(value)], { after: 40 }) : null;

/**
 * Titlul unei părți a ofertei: casetă, scris albastru, ca în oferta model.
 * Caseta e un tabel cu o celulă: chenarul de paragraf al bibliotecii iese în
 * altă ordine decât cere Word și l-ar putea raporta ca deteriorat.
 */
const banner = (title: string) => [
  new Paragraph({ children: [], spacing: { before: 200, after: 0 }, keepNext: true }),
  table([CONTENT_W], [
    new TableRow({
      cantSplit: true,
      children: [
        cell(
          [
            new Paragraph({
              children: [new TextRun({ text: title, font: "Impact", size: 34, color: BLUE })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              keepNext: true,
            }),
          ],
          { width: CONTENT_W },
        ),
      ],
    }),
  ]),
  new Paragraph({ children: [], spacing: { after: 120 }, keepNext: true }),
];

const heading = (title: string) => para([text(title, { bold: true, size: 24 })], { before: 200, after: 80, keepNext: true });

/** „ProConnect™ – permite…”: numele avantajului îngroșat, restul normal. */
function bullet(value: string) {
  const match = value.match(/^(.{2,60}?)\s+[–-]\s+(.+)$/);
  const children = match ? [text(match[1], { bold: true }), text(` – ${match[2]}`)] : [text(value)];
  return new Paragraph({ children, numbering: { reference: "bulinute", level: 0 }, spacing: { after: 40 } });
}

function cell(children: Paragraph[], opts: { width: number; shade?: string; borders?: boolean; span?: number; align?: TableVerticalAlign }) {
  return new TableCell({
    children,
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.span,
    shading: opts.shade ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shade } : undefined,
    borders: opts.borders === false ? { top: none, left: none, bottom: none, right: none } : boxBorders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: opts.align,
  });
}

const cellText = (value: string, opts: { bold?: boolean; color?: string; right?: boolean; size?: number } = {}) =>
  new Paragraph({
    children: [text(value, { bold: opts.bold, color: opts.color, size: opts.size })],
    alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 0 },
  });

function table(widths: number[], rows: TableRow[], borders = true) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows,
    borders: borders ? undefined : noBorders,
  });
}

// ------------------------------------------------------------------ părțile ofertei

function partiesTable(doc: OfferDocument) {
  const { organization, agent, quote, client } = doc;
  const left = [
    labelled("Ofertă întocmită de", organization.name),
    labelled("Reprezentant companie", agent.name),
    labelled("Telefon", agent.phone),
    labelled("Email", agent.email),
    labelled("Numărul ofertei", quote.number),
    labelled("Data la care a fost întocmită oferta", formatDate(quote.issue_date)),
    doc.validityDays
      ? labelled("Valabilitatea ofertei", `${doc.validityDays} de zile`)
      : labelled("Valabilă până la", quote.valid_until ? formatDate(quote.valid_until) : null),
  ].filter((p): p is Paragraph => p !== null);
  const right = [
    labelled("În atenția", client?.contact_person),
    labelled("Compania", client?.name),
    labelled("CUI", client?.cui),
    labelled("Tel", client?.phone),
    labelled("E-mail", client?.email),
    labelled("Adresa", client ? joinAddress(client.address, client.city, client.county) : null),
    labelled("Șantier", quote.site_address),
  ].filter((p): p is Paragraph => p !== null);

  const half = (CONTENT_W - 200) / 2;
  return table(
    [half, 200, half],
    [
      new TableRow({
        children: [
          cell(left.length ? left : [para("")], { width: half }),
          cell([para("")], { width: 200, borders: false }),
          cell(right.length ? right : [para("")], { width: half }),
        ],
      }),
    ],
    false,
  );
}

async function productParts(product: OfferProduct, index: number, doc: OfferDocument) {
  const { item, intro, contents, specs, benefits, recommendations, applications, price } = product;
  const parts: (Paragraph | Table)[] = [];

  parts.push(para([text(`${index + 1}. ${item.name}`, { bold: true, size: 28 })], { before: index ? 480 : 240, after: 120, keepNext: true }));

  // Poza în stânga, prezentarea și ce conține în dreapta, ca în oferta model.
  const img = await toImage(product.image);
  const textSide = [
    ...(intro ? intro.split(/\r?\n/).filter(Boolean).map((p) => para(p, { align: AlignmentType.JUSTIFIED })) : []),
    ...(contents.length ? [para([text("CONȚINE:", { bold: true })], { before: 80, after: 40 }), ...contents.map(bullet)] : []),
  ];
  if (img) {
    const imgW = Math.round(6.4 * CM);
    parts.push(
      table(
        [imgW, CONTENT_W - imgW],
        [
          new TableRow({
            cantSplit: true,
            children: [
              cell([new Paragraph({ children: [imageRun(img, 230, 250)], alignment: AlignmentType.CENTER })], {
                width: imgW,
                borders: false,
                align: VerticalAlign.CENTER,
              }),
              cell(textSide.length ? textSide : [para("")], { width: CONTENT_W - imgW, borders: false }),
            ],
          }),
        ],
        false,
      ),
    );
  } else {
    parts.push(...textSide);
  }

  if (specs.length) {
    const withNotes = specs.some((s) => s.note);
    const widths = withNotes
      ? [Math.round(CONTENT_W * 0.32), Math.round(CONTENT_W * 0.28), CONTENT_W - Math.round(CONTENT_W * 0.32) - Math.round(CONTENT_W * 0.28)]
      : [Math.round(CONTENT_W * 0.45), CONTENT_W - Math.round(CONTENT_W * 0.45)];
    const head = ["Parametru", "Valoare", ...(withNotes ? ["Observații / detalii suplimentare"] : [])];
    parts.push(heading("Specificații tehnice cheie"));
    parts.push(
      table(widths, [
        new TableRow({
          tableHeader: true,
          children: head.map((h, i) => cell([cellText(h, { bold: true })], { width: widths[i], shade: "F2F2F2" })),
        }),
        ...specs.map(
          (s) =>
            new TableRow({
              cantSplit: true,
              children: [s.label, s.value, ...(withNotes ? [s.note ?? ""] : [])].map((v, i) =>
                cell([cellText(v)], { width: widths[i] }),
              ),
            }),
        ),
      ]),
    );
  }

  for (const [title, items] of [
    ["Avantaje și beneficii", benefits],
    ["Recomandări și condiții de utilizare", recommendations],
    ["Aplicații recomandate", applications],
  ] as const) {
    if (items.length) parts.push(heading(title), ...items.map(bullet));
  }

  // Prețul produsului, imediat sub el, în lei și în euro.
  const { base, other } = doc;
  const widths = other ? [Math.round(CONTENT_W * 0.5), Math.round(CONTENT_W * 0.25), CONTENT_W - Math.round(CONTENT_W * 0.5) - Math.round(CONTENT_W * 0.25)] : [Math.round(CONTENT_W * 0.6), CONTENT_W - Math.round(CONTENT_W * 0.6)];
  const rows = priceRows(item, price, Number(doc.quote.discount_pct));
  parts.push(para("", { after: 120 }));
  parts.push(
    table(widths, [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          cell([cellText(`Preț · ${index + 1}. ${item.name}`, { bold: true, color: "FFFFFF" })], { width: widths[0], shade: DARK }),
          cell([cellText(currencyLabel(base), { bold: true, color: "FFFFFF", right: true })], { width: widths[1], shade: DARK }),
          ...(other ? [cell([cellText(currencyLabel(other.currency), { bold: true, color: "FFFFFF", right: true })], { width: widths[2], shade: DARK })] : []),
        ],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell([cellText(row.label, { bold: row.strong })], { width: widths[0] }),
              cell([cellText(formatMoney(row.value, base), { bold: row.strong, right: true })], { width: widths[1] }),
              ...(other
                ? [cell([cellText(formatMoney(other.convert(row.value), other.currency), { bold: row.strong, right: true, color: "1D4F91" })], { width: widths[2] })]
                : []),
            ],
          }),
      ),
    ]),
  );
  return parts;
}

function financialTable(doc: OfferDocument) {
  const { totals, products, base, other } = doc;
  if (!totals) return [];
  const cur = currencyLabel(base);
  const w = [1250, 2900, 750, 1750, 1750];
  w.push(CONTENT_W - w.reduce((a, b) => a + b, 0));
  const vatRates = [...new Set(products.map((p) => Number(p.item.vat_rate)))];
  const head = ["Part N", "Denumire", "Cant.", `Preț unitar ${cur} fără TVA`, `Valoare ${cur} fără TVA`, vatRates.length === 1 ? `TVA (${vatRates[0]}%)` : "TVA"];
  const sumRow = (label: string, a: string, b: string, opts: { bold?: boolean; shade?: string; color?: string } = {}) =>
    new TableRow({
      cantSplit: true,
      children: [
        cell([cellText(label, { bold: opts.bold, right: true, color: opts.color })], { width: w[0] + w[1] + w[2] + w[3], span: 4, shade: opts.shade }),
        ...(b === "__span__"
          ? [cell([cellText(a, { bold: opts.bold, right: true, color: opts.color })], { width: w[4] + w[5], span: 2, shade: opts.shade })]
          : [
              cell([cellText(a, { bold: opts.bold, right: true })], { width: w[4] }),
              cell([cellText(b, { bold: opts.bold, right: true })], { width: w[5] }),
            ]),
      ],
    });

  return [
    ...banner("OFERTĂ FINANCIARĂ"),
    table(w, [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell([cellText(h, { bold: true, right: i >= 2 })], { width: w[i], shade: "F2F2F2" })) }),
      ...products.map(
        ({ item, sku, price }) =>
          new TableRow({
            cantSplit: true,
            children: [
              sku ?? "",
              item.name,
              `${formatQuantity(item.quantity)} ${item.unit}`,
              formatMoney(item.unit_price, base),
              formatMoney(price.net, base),
              formatMoney(price.vat, base),
            ].map((v, i) => cell([cellText(v, { right: i >= 2 })], { width: w[i] })),
          }),
      ),
      ...(totals.quoteDiscount > 0
        ? [sumRow(`din care discount ofertă ${Number(doc.quote.discount_pct)}%`, `−${formatMoney(totals.quoteDiscount, base)}`, "")]
        : []),
      sumRow("Total fără TVA / TVA", formatMoney(totals.net, base), formatMoney(totals.vat, base), { bold: true }),
      sumRow(`TOTAL ${cur.toUpperCase()} TVA INCLUS`, formatMoney(totals.gross, base), "__span__", { bold: true, shade: DARK, color: "FFFFFF" }),
      ...(other
        ? [sumRow(`Echivalent în ${other.currency === "EUR" ? "euro" : "lei"}, TVA inclus`, formatMoney(other.convert(totals.gross), other.currency), "__span__", { bold: true })]
        : []),
    ]),
  ];
}

async function signatureBlock(doc: OfferDocument) {
  const [stamp, signature] = await Promise.all([toImage(doc.stamp), toImage(doc.agent.signature)]);
  const images: ParagraphChild[] = [];
  if (stamp) images.push(imageRun(stamp, 110, 110), new TextRun({ text: "   " }));
  if (signature) images.push(imageRun(signature, 170, 85));
  const w = Math.round(8 * CM);
  return table(
    [CONTENT_W - w, w],
    [
      new TableRow({
        cantSplit: true,
        children: [
          cell([para("")], { width: CONTENT_W - w, borders: false }),
          cell(
            [
              para([text(`Reprezentant ${doc.organization.name}`, { bold: true })], { align: AlignmentType.CENTER, after: 0 }),
              ...(doc.agent.name ? [para(doc.agent.name, { align: AlignmentType.CENTER })] : []),
              images.length
                ? new Paragraph({ children: images, alignment: AlignmentType.CENTER })
                : para([text("semnătură și ștampilă", { color: "808080", size: 18 })], { align: AlignmentType.CENTER, before: 600 }),
            ],
            { width: w, borders: false },
          ),
        ],
      }),
    ],
    false,
  );
}

// ------------------------------------------------------------------ documentul

export async function buildOfferDocx(doc: OfferDocument): Promise<Buffer> {
  const [bannerBuf, logoBuf] = await Promise.all([asset("antet.jpg"), asset("sigla.png")]);
  const [bannerImg, logoImg] = await Promise.all([toImage(bannerBuf), toImage(logoBuf)]);
  const footer = companyFooter(doc.organization);
  const { quote } = doc;

  const body: (Paragraph | Table)[] = [];
  if (bannerImg) body.push(new Paragraph({ children: [imageRun(bannerImg, 640, 290)], alignment: AlignmentType.CENTER, spacing: { after: 240 } }));
  body.push(partiesTable(doc));
  body.push(...banner("OFERTĂ TEHNICO – FINANCIARĂ"));
  if (quote.title) body.push(para([text(quote.title, { bold: true })], { align: AlignmentType.CENTER }));
  if (doc.rateText) body.push(para([text(doc.rateText, { size: 18, color: "595959" })], { align: AlignmentType.RIGHT }));

  for (const [index, product] of doc.products.entries()) body.push(...(await productParts(product, index, doc)));

  if (doc.other && doc.products.length) {
    body.push(
      para(
        [
          text(
            `Valorile în ${doc.other.currency === "EUR" ? "euro" : "lei"} sunt calculate la cursul de mai sus; facturarea se face în ${doc.base === "RON" ? "lei" : "euro"}.`,
            { size: 18, color: "737373" },
          ),
        ],
        { align: AlignmentType.RIGHT, before: 160 },
      ),
    );
  }

  body.push(...financialTable(doc));

  if (quote.notes) {
    body.push(heading("Observații"), ...quote.notes.split(/\r?\n/).map((l) => para(l)));
  }
  if (doc.terms.length) {
    body.push(...banner("CONDIȚII ȘI TERMENE DE PLATĂ"));
    for (const term of doc.terms) {
      body.push(
        new Paragraph({
          children: [...(term.label ? [text(`${term.label}: `, { bold: true })] : []), text(term.text)],
          numbering: { reference: "bulinute", level: 0 },
          spacing: { after: 60 },
        }),
      );
    }
  }
  body.push(para("", { after: 240 }));
  body.push(await signatureBlock(doc));

  const small = (value: string, bold = false) => text(value, { size: 15, bold, color: bold ? "111111" : "404040" });
  const pageFooter = () =>
    new Footer({
    children: [
      new Paragraph({ border: { top: line }, spacing: { after: 0 }, children: [] }),
      para([small(footer.title, true)], { align: AlignmentType.CENTER, after: 0 }),
      ...footer.lines.map((l) => para([small(l)], { align: AlignmentType.CENTER, after: 0 })),
      para(
        [
          small("Pagina "),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, font: FONT, color: "737373" }),
          small(" din "),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, font: FONT, color: "737373" }),
        ],
        { align: AlignmentType.CENTER, after: 0 },
      ),
    ],
  });

  const document = new Document({
    creator: doc.organization.name,
    title: `Oferta ${quote.number}`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    numbering: {
      config: [
        {
          reference: "bulinute",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 400, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: PAGE_W, height: Math.round(29.7 * CM) },
            margin: { top: Math.round(1.2 * CM), bottom: Math.round(2.6 * CM), left: MARGIN_X, right: MARGIN_X, header: 400, footer: 300 },
          },
        },
        // Prima pagină are antetul mare în pagină; următoarele, doar sigla sus.
        headers: {
          first: new Header({ children: [] }),
          default: new Header({
            children: logoImg ? [new Paragraph({ children: [imageRun(logoImg, 170, 45)], alignment: AlignmentType.RIGHT })] : [],
          }),
        },
        footers: { first: pageFooter(), default: pageFooter() },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(document);
}
