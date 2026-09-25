"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { ImageResult } from "@/components/cont/actions";

/** Latura cea mai mare: destul pentru o semnătură sau o ștampilă tipărită, fără date în plus. */
const MAX_SIDE = 700;

/**
 * Micșorează imaginea în browser. PNG-ul rămâne PNG, ca fundalul transparent
 * al semnăturii să nu acopere ștampila; restul devine JPEG.
 */
async function shrink(file: File): Promise<{ mime: string; b64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const png = file.type === "image/png";
  if (!png) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = png ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
  return { mime: png ? "image/png" : "image/jpeg", b64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

/** Alege o imagine (semnătură, ștampilă), o arată și o salvează; o poate și scoate. */
export function ImagePicker({
  current,
  save,
  label,
  removeLabel,
  hint,
}: {
  current: string | null;
  save: (photo: { mime: string; b64: string } | null) => Promise<ImageResult>;
  label: string;
  removeLabel: string;
  hint: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (photo: { mime: string; b64: string } | null) => {
    setBusy(true);
    setError("");
    try {
      const res = await save(photo);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("Imaginea nu s-a putut salva. Încearcă din nou.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await run(await shrink(file));
    } catch {
      setError("Imaginea nu s-a putut citi. Încearcă un fișier JPG sau PNG.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-2">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-neutral-500">Nu e pusă încă</span>
        )}
      </div>
      <p className="text-xs text-neutral-500">{hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
        aria-label={label}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-primary min-h-11">
          {busy ? "Se salvează…" : current ? `Schimbă ${label.toLowerCase()}` : `Pune ${label.toLowerCase()}`}
        </button>
        {current ? (
          <button type="button" onClick={() => run(null)} disabled={busy} className="btn btn-danger-ghost min-h-11">
            {removeLabel}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
