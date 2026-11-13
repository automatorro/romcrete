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

const asset = (file: string) => readFile(path.join(process.cwd(), "public", "oferta", file));

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

async function productParts(product: OfferProduct, index: number) {
  const { item, intro, contents, specs, benefits, recommendations, applications } = product;
  const parts: (Paragraph | Table)[] = [];

  // Imaginea produsului deschide prezentarea, alături de descriere și beneficii.
  const img = await toImage(product.image);
  const introLines = (intro ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const textSide = [
    para([text(`${index + 1}. ${item.name}`, { bold: true, size: 30 })], { before: index ? 480 : 240, after: 120, keepNext: true }),
    ...introLines.map((line, lineIndex) =>
      para([text(line, { bold: introLines.length > 1 && lineIndex === 0 })]),
    ),
    ...(benefits.length || recommendations.length
      ? [heading("Avantaje și beneficii"), ...[...benefits, ...recommendations].map(bullet)]
      : []),
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

  if (applications.length) parts.push(heading("Compatibilitate materiale"), ...applications.map(bullet));
  if (contents.length) parts.push(heading("Unitățile complete includ"), ...contents.map(bullet));

  if (specs.length) {
    const withNotes = specs.some((s) => s.note);
    const widths = withNotes
      ? [Math.round(CONTENT_W * 0.32), Math.round(CONTENT_W * 0.28), CONTENT_W - Math.round(CONTENT_W * 0.32) - Math.round(CONTENT_W * 0.28)]
      : [Math.round(CONTENT_W * 0.45), CONTENT_W - Math.round(CONTENT_W * 0.45)];
    const head = ["Parametru", "Valoare", ...(withNotes ? ["Observații / detalii suplimentare"] : [])];
    parts.push(heading(`Caracteristici tehnice ${item.name}`));
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

  return parts;
}

function financialTable(doc: OfferDocument) {
  const { totals, products, base, other } = doc;
  if (!products.length) return [];
  const cur = currencyLabel(base);
  const widths = [650, 1250, 3700, 950, 1770, CONTENT_W - 650 - 1250 - 3700 - 950 - 1770];
  const amountCell = (value: number, bold = false, color?: string) => [
    cellText(formatMoney(value, base), { bold, right: true, color }),
    ...(other ? [cellText(formatMoney(other.convert(value), other.currency), { right: true, size: 16, color: color ?? "595959" })] : []),
  ];
  const totalRow = (label: string, value: number, options: { bold?: boolean; shade?: string; color?: string } = {}) =>
    new TableRow({
      cantSplit: true,
      children: [
        cell([cellText(label, { bold: options.bold, right: true, color: options.color })], {
          width: CONTENT_W - widths[5],
          span: 5,
          shade: options.shade,
        }),
        cell(amountCell(value, options.bold, options.color), { width: widths[5], shade: options.shade }),
      ],
    });

  return [
    para("", { before: 200, after: 0 }),
    table(widths, [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: ["Nr.crt", "Cod", "Produs", "Buc", `Preț ${cur}/buc`, `Total ${cur}`]
          .map((label, index) =>
            cell([cellText(label, { bold: true, right: index >= 3 })], { width: widths[index], shade: "F2F2F2" }),
          ),
      }),
      ...products.map(({ item, sku, price }, index) => {
        const quantity = Number(item.quantity);
        const unitPrice = quantity ? price.net / quantity : price.net;
        return (
          new TableRow({
            cantSplit: true,
            children: [
              String(index + 1),
              sku ?? "",
              item.name,
              `${formatQuantity(item.quantity)} ${item.unit}`,
              "",
              "",
            ].map((value, cellIndex) =>
              cell(
                cellIndex === 4 ? amountCell(unitPrice) : cellIndex === 5 ? amountCell(price.net) : [cellText(value, { right: cellIndex === 0 || cellIndex === 3 })],
                { width: widths[cellIndex] },
              ),
            ),
          })
        );
      }),
      ...(totals
        ? [
            totalRow("Total fără TVA", totals.net, { bold: true }),
            totalRow("TVA", totals.vat),
            totalRow(`TOTAL ${cur.toUpperCase()} TVA INCLUS`, totals.gross, { bold: true, shade: DARK, color: "FFFFFF" }),
          ]
        : []),
    ]),
    para("Prețurile unitare și totalurile pe produs nu includ TVA.", { before: 40, after: 100 }),
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
  const logoBuf = await asset("sigla.png");
  const logoImg = await toImage(logoBuf);
  const footer = companyFooter(doc.organization);
  const { quote } = doc;

  const body: (Paragraph | Table)[] = [];
  body.push(partiesTable(doc));
  if (quote.title) body.push(para([text(quote.title, { bold: true })], { align: AlignmentType.CENTER }));
  if (doc.rateText) body.push(para([text(doc.rateText, { size: 18, color: "595959" })], { align: AlignmentType.RIGHT }));

  for (const [index, product] of doc.products.entries()) body.push(...(await productParts(product, index)));

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
    body.push(...quote.notes.split(/\r?\n/).map((l) => para(l)));
  }
  if (doc.terms.length) {
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
  const logoHeader = () =>
    new Header({
      children: logoImg ? [new Paragraph({ children: [imageRun(logoImg, 170, 45)], alignment: AlignmentType.RIGHT })] : [],
    });
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
            margin: { top: Math.round(2.2 * CM), bottom: Math.round(2.6 * CM), left: MARGIN_X, right: MARGIN_X, header: 400, footer: 300 },
          },
        },
        headers: {
          first: logoHeader(),
          default: logoHeader(),
        },
        footers: { first: pageFooter(), default: pageFooter() },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(document);
}
