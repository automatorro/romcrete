export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-medium text-concrete-900">{title}</p>
      <p className="max-w-md text-sm text-concrete-500">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
