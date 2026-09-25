import Link from "next/link";

/**
 * Antetul oricărei pagini: link înapoi, titlu, o frază de context și acțiunile
 * paginii în dreapta. Pe telefon acțiunile coboară sub titlu, pe toată lățimea.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  badge,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Ceva mic lângă titlu: starea ofertei, cadranul firmei. */
  badge?: React.ReactNode;
}) {
  return (
    <header className="mb-4 md:mb-6">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 inline-flex min-h-10 items-center px-1 text-sm font-medium text-brand-700 hover:underline"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl">
            <span className="min-w-0 break-words">{title}</span>
            {badge}
          </h1>
          {description ? <div className="mt-0.5 text-sm text-neutral-500">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
