import { z } from "zod";

/** Text opțional: string gol din formular devine null în baza de date. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

/** Număr din formular; string gol înseamnă valoarea implicită, nu 0 accidental. */
const numberField = (fallback: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? fallback : value),
    z.coerce.number().finite(),
  );

const percent = (fallback = 0) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? fallback : value),
    z.coerce.number().min(0, "Procentul nu poate fi negativ").max(100, "Procentul nu poate depăși 100"),
  );

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Numele firmei este obligatoriu"),
  cui: optionalText,
  reg_com: optionalText,
  address: optionalText,
  city: optionalText,
  county: optionalText,
  email: optionalText,
  phone: optionalText,
  iban: optionalText,
  bank: optionalText,
  vat_rate: percent(21),
  quote_terms: optionalText,
  productivity_factor: numberField(2.5).pipe(
    z.number().gt(1, "Randamentul trebuie să fie mai mare decât 1").max(10, "Valoare nerealistă"),
  ),
  working_days_per_month: numberField(21).pipe(
    z.number().int("Număr întreg de zile").min(1).max(31),
  ),
  // Lista se scrie ca text, câte un domeniu pe linie sau separate prin virgulă.
  join_domains: z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(/[\s,;]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    )
    // Lipsa câmpului înseamnă listă goală: nimeni nu se mai poate înscrie singur.
    .default([]),
});

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Numele clientului este obligatoriu"),
  cui: optionalText,
  reg_com: optionalText,
  contact_person: optionalText,
  email: optionalText,
  phone: optionalText,
  address: optionalText,
  city: optionalText,
  county: optionalText,
  notes: optionalText,
});

export const catalogItemSchema = z.object({
  sku: optionalText,
  name: z.string().trim().min(2, "Denumirea produsului este obligatorie"),
  description: optionalText,
  category: optionalText,
  unit: z.string().trim().min(1, "Unitatea de măsură este obligatorie"),
  unit_price: numberField(0).pipe(z.number().min(0, "Prețul nu poate fi negativ")),
  vat_rate: percent(21),
  is_active: z.preprocess((value) => value === "on" || value === true || value === "true", z.boolean()),
});

export const quoteSchema = z.object({
  client_id: z.uuid("Alege un client din listă"),
  title: optionalText,
  issue_date: z.string().trim().min(1, "Data emiterii este obligatorie"),
  valid_until: optionalDate,
  site_address: optionalText,
  discount_pct: percent(0),
  notes: optionalText,
  terms: optionalText,
});

export const quoteStatusSchema = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);

export const quoteItemSchema = z.object({
  name: z.string().trim().min(1, "Denumirea liniei este obligatorie"),
  description: optionalText,
  unit: z.string().trim().min(1, "Unitatea de măsură este obligatorie"),
  quantity: numberField(1).pipe(z.number().gt(0, "Cantitatea trebuie să fie mai mare decât zero")),
  unit_price: numberField(0).pipe(z.number().min(0, "Prețul nu poate fi negativ")),
  vat_rate: percent(21),
  discount_pct: percent(0),
});

export const credentialsSchema = z.object({
  email: z.email("Adresa de email nu este validă"),
  password: z.string().min(8, "Parola trebuie să aibă cel puțin 8 caractere"),
});

/** Rezultatul standard al unui Server Action folosit cu `useActionState`. */
export type ActionState = { error?: string; success?: string } | null;

/** Transformă erorile zod într-un singur mesaj citibil, în ordinea câmpurilor din formular. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datele trimise nu sunt valide";
}

/** Rezultatul parsării: fie datele validate, fie un mesaj de eroare. */
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parsează un FormData cu o schemă zod și întoarce fie datele, fie un mesaj de eroare. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): ParseResult<z.output<T>> {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([key]) => !key.startsWith("$ACTION_")),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return { ok: true, data: parsed.data };
}
