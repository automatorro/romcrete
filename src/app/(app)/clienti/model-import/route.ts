import ExcelJS from "exceljs";

import { requireOrg } from "@/lib/auth";
import { IMPORT_FIELDS, TEMPLATE_HEADERS } from "@/lib/import-clienti";

// exceljs are nevoie de Node, nu de runtime-ul edge.
export const runtime = "nodejs";

const WIDTHS: Record<string, number> = { name: 32, address: 34, notes: 34, email: 26, contact_person: 24 };

/** Fișierul model pentru importul clienților: capul de tabel și un rând de exemplu. */
export async function GET() {
  await requireOrg();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Clienți", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_FIELDS.map((field) => ({
    header: TEMPLATE_HEADERS[field],
    key: field,
    width: WIDTHS[field] ?? 16,
  }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0033AB" } };

  // Telefonul și CUI-ul ca text, ca Excel să nu le mănânce zeroul din față.
  ws.getColumn("phone").numFmt = "@";
  ws.getColumn("cui").numFmt = "@";

  ws.addRow({
    name: "Construcții Alfa SRL",
    cui: "RO12345678",
    reg_com: "J12/345/2020",
    contact_person: "Ion Popescu",
    phone: "0722 123 456",
    email: "office@alfa.ro",
    address: "Str. Fabricii nr. 10",
    city: "Cluj-Napoca",
    county: "Cluj",
    notes: "Exemplu — șterge rândul înainte de import",
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="model-import-clienti.xlsx"',
      "cache-control": "no-store",
    },
  });
}
