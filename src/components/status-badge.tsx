import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/types";

/**
 * Starea ofertei, doar în paleta Romcrete. Culoarea nu poartă singură sensul:
 * acceptată e plină, trimisă e deschisă, iar respinsă și expirată au semn.
 */
const STYLES: Record<QuoteStatus, string> = {
  draft: "border-neutral-200 bg-neutral-100 text-neutral-700",
  sent: "border-brand-200 bg-brand-50 text-brand-700",
  accepted: "border-brand-600 bg-brand-600 text-white",
  rejected: "border-neutral-400 bg-white text-neutral-700",
  expired: "border-dashed border-neutral-400 bg-white text-neutral-500",
};

const MARKS: Partial<Record<QuoteStatus, string>> = {
  accepted: "✓ ",
  rejected: "✕ ",
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {MARKS[status] ?? ""}
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
