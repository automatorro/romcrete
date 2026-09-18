/**
 * Citirea variabilelor de mediu într-un singur loc, cu mesaje clare când lipsesc.
 * Referințele la `process.env.NEXT_PUBLIC_*` trebuie scrise literal ca Next să le poată inlina.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variabila de mediu ${name} lipsește. Copiază .env.example în .env.local și completează datele proiectului Supabase.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", url);
}

export function supabaseKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
}

/** True dacă aplicația are configurarea minimă pentru a vorbi cu Supabase. */
export const supabaseConfigured = Boolean(url && publishableKey);
