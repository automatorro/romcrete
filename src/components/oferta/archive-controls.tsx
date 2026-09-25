import { archiveQuote, deleteQuote, restoreQuote } from "@/app/(app)/oferte/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/totals";

/**
 * Arhivarea ofertei. Activă: un singur buton, „Arhivează”. Arhivată: se poate
 * restaura, iar conducerea o poate șterge definitiv.
 */
export function ArchiveControls({
  quoteId,
  number,
  archivedAt,
  canDelete,
  zona,
}: {
  quoteId: string;
  number: string;
  archivedAt: string | null;
  canDelete: boolean;
  zona: "teren" | "birou";
}) {
  const hidden = (
    <>
      <input type="hidden" name="quote_id" value={quoteId} />
      <input type="hidden" name="zona" value={zona} />
    </>
  );

  if (!archivedAt) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-500">
          Arhivarea scoate oferta din liste și din rapoarte. O găsești la „Arhivă” și o poți restaura.
        </p>
        <form action={archiveQuote}>
          {hidden}
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Se arhivează…"
            confirm={`Arhivezi oferta ${number}?`}
            confirmLabel="Da, arhivează"
          >
            Arhivează oferta
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="notice space-y-3">
      <p>
        <b>Oferta e în arhivă</b> din {formatDate(archivedAt)}. Nu apare în liste și nu se numără în rapoarte.
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={restoreQuote}>
          {hidden}
          <SubmitButton className="btn btn-ok" pendingLabel="Se restaurează…">
            Restaurează oferta
          </SubmitButton>
        </form>
        {canDelete ? (
          <form action={deleteQuote}>
            {hidden}
            <SubmitButton
              className="btn btn-danger"
              pendingLabel="Se șterge…"
              confirm={`Ștergi definitiv oferta ${number}? Liniile ei se pierd, numărul nu se refolosește.`}
              confirmLabel="Da, șterge definitiv"
            >
              Șterge definitiv
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
