import type { QuoteItem } from "@/lib/types";

/** Ce îi trebuie unei linii ca să poată fi calculată (merge și pe formulare, nu doar pe rânduri din DB). */
export type LineLike = Pick<
  QuoteItem,
  "quantity" | "unit_price" | "vat_rate" | "discount_pct"
>;

export type Totals = {
  /** Suma liniilor, după discountul de linie, fără TVA. */
  linesNet: number;
  /** Valoarea discountului aplicat pe toată oferta. */
  quoteDiscount: number;
  /** Bază de impozitare după toate discounturile. */
  net: number;
  /** TVA total. */
  vat: number;
  /** Total de plată. */
  gross: number;
};

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Valoarea unei linii fără TVA, după discountul de linie. */
export function lineNet(line: LineLike): number {
  return round2(
    num(line.quantity) * num(line.unit_price) * (1 - num(line.discount_pct) / 100),
  );
}

/** TVA-ul unei linii, calculat pe valoarea netă a liniei. */
export function lineVat(line: LineLike): number {
  return round2(lineNet(line) * (num(line.vat_rate) / 100));
}

/**
 * Totalurile ofertei. Discountul pe ofertă se aplică proporțional și asupra TVA-ului,
 * ca baza de impozitare și TVA-ul să rămână consistente.
 */
export function computeTotals(lines: LineLike[], quoteDiscountPct = 0): Totals {
  const factor = 1 - num(quoteDiscountPct) / 100;

  const linesNet = round2(lines.reduce((sum, line) => sum + lineNet(line), 0));
  const linesVat = round2(lines.reduce((sum, line) => sum + lineVat(line), 0));

  const net = round2(linesNet * factor);
  const vat = round2(linesVat * factor);

  return {
    linesNet,
    quoteDiscount: round2(linesNet - net),
    net,
    vat,
    gross: round2(net + vat),
  };
}

const moneyFormatter = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatMoney(value: unknown, currency = "RON"): string {
  return `${moneyFormatter.format(num(value))} ${currency}`;
}

export function formatNumber(value: unknown): string {
  return moneyFormatter.format(num(value));
}

export function formatQuantity(value: unknown): string {
  return quantityFormatter.format(num(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(date);
}
