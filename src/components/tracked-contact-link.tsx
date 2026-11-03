"use client";

import { useState } from "react";

import { recordContactAction } from "@/app/teren/actions";

type Channel = "telefon" | "email";

export function TrackedContactLink({
  clientId,
  channel,
  href,
  className,
  children,
}: {
  clientId: string;
  channel: Channel;
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const follow = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await recordContactAction(clientId, channel);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = href;
    } catch (e) {
      setError(e instanceof Error ? `Contactarea nu s-a putut salva: ${e.message}` : "Contactarea nu s-a putut salva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <span>
      <a href={href} onClick={follow} aria-disabled={saving} className={className}>
        {children}
      </a>
      {error ? <span role="alert" className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
