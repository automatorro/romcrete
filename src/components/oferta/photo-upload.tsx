"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadProductPhoto } from "@/app/(app)/oferte/actions";

/** Latura cea mai mare a pozei în PDF: destul pentru 48 mm tipăriți, fără kilograme de date. */
const MAX_SIDE = 1400;

/** Micșorează poza în telefon și o întoarce ca JPEG în base64. */
async function shrink(file: File): Promise<{ mime: string; b64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // Fundal alb: pozele PNG transparente nu ies negre în JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (b64.length <= 1_300_000) return { mime: "image/jpeg", b64 };
  }
  throw new Error("prea mare");
}

/**
 * Butonul „Pune poza”: din telefon deschide camera sau galeria, pe calculator
 * alegerea unui fișier. Poza se micșorează, se salvează și pagina se reîncarcă.
 */
export function PhotoUpload({
  target,
  id,
  quoteId,
  label = "Pune poza",
}: {
  target: "catalog" | "linie";
  id: string;
  quoteId?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const photo = await shrink(file);
      const res = await uploadProductPhoto({ target, id, quoteId, ...photo });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("Poza nu s-a putut citi. Încearcă o poză JPG sau PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="btn btn-primary min-h-11"
      >
        {busy ? "Se încarcă poza…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
