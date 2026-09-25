/**
 * Ce se vede imediat după un click, cât serverul pregătește pagina: agentul
 * știe că apăsarea a mers și nu mai apasă o dată.
 */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Se încarcă…</span>
      <div className="h-8 w-2/3 max-w-sm animate-pulse rounded-lg bg-neutral-200" />
      <div className="h-4 w-1/2 max-w-xs animate-pulse rounded bg-neutral-200" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}
