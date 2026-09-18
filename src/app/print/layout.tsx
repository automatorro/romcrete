/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return <div className="bg-white">{children}</div>;
}
