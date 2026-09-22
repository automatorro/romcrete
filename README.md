# Romcrete

Aplicație web de **ofertare și devize** pentru firme de betoane și construcții:
catalog de produse și servicii, oferte numerotate automat, calcul de TVA și
discounturi, export PDF pentru client.

Stack: **Next.js 16** (App Router, Server Actions) · **TypeScript** ·
**Tailwind CSS v4** · **Supabase** (Postgres + Auth, cu Row Level Security).

## Ce face, concret

- **Cont și firmă** — înregistrare pe email/parolă, apoi configurarea datelor firmei
  (CUI, adresă, IBAN, cotă TVA implicită, condiții comerciale).
- **Clienți** — listă cu căutare după nume, CUI sau oraș; datele se preiau automat pe ofertă.
- **Catalog** — produse și servicii cu unitate de măsură, preț și cotă TVA proprie.
  O firmă nouă începe cu catalogul gol și își importă propriile produse.
- **Oferte** — număr generat atomic în baza de date (`OF-2026-0001`, serie per firmă și an),
  linii din catalog sau linii libere, discount pe linie și pe ofertă, stări
  (ciornă / trimisă / acceptată / respinsă / expirată), duplicare.
- **PDF** — pagină de tipărire format A4 cu antetul firmei, datele clientului, tabelul
  de linii, totalurile și zona de semnături. Se salvează ca PDF din dialogul de tipărire
  al browserului.

## Punere în funcțiune

### 1. Proiect Supabase

Creează un proiect pe [supabase.com](https://supabase.com), apoi rulează în **SQL Editor**,
în ordine:

Fișierele din `supabase/migrations/`, în ordinea numelui.

Fișierele respectă convenția de nume a Supabase CLI (`<timestamp>_nume.sql`), deci le aplică
și `supabase db push` sau integrarea GitHub, în aceeași ordine.

Alternativ, cu [Supabase CLI](https://supabase.com/docs/guides/cli) — `supabase/config.toml`
conține deja referința proiectului:

```bash
supabase link
supabase db push
```

În **Authentication → URL Configuration**, setează `Site URL` la adresa aplicației și
adaugă în template-ul de confirmare linkul:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Pentru dezvoltare poți dezactiva confirmarea pe email din **Authentication → Providers → Email**.

### 2. Variabile de mediu

```bash
cp .env.example .env.local
```

Completează `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
din **Project Settings → API**.

### 3. Rulare

```bash
npm install
npm run dev
```

Aplicația pornește pe <http://localhost:3000>. Creezi cont, completezi datele firmei,
adaugi un client și emiți prima ofertă.

## Structura proiectului

```
src/
├─ app/
│  ├─ (auth)/            autentificare: login, înregistrare, acțiuni de sesiune
│  ├─ (app)/             zona privată: oferte, clienți, catalog, setări
│  ├─ auth/confirm/      ținta linkului de confirmare pe email
│  ├─ onboarding/        configurarea firmei la primul login
│  ├─ print/oferta/[id]/ documentul A4 gata de tipărit / salvat ca PDF
│  └─ page.tsx           pagina publică de intrare
├─ components/           bucăți de interfață reutilizate
├─ lib/
│  ├─ auth.ts            stratul de acces: cine e utilizatorul, din ce firmă face parte
│  ├─ supabase/          clienții Supabase pentru server și browser
│  ├─ totals.ts          calculul valorilor, TVA-ului și formatarea în format românesc
│  ├─ types.ts           tipurile rândurilor din baza de date
│  └─ validation.ts      schemele zod folosite de Server Actions
└─ proxy.ts              reîmprospătarea sesiunii și protecția rutelor
```

## Model de date

| Tabel | Rol |
| --- | --- |
| `organizations` | firma: date de facturare, cotă TVA implicită, condiții comerciale |
| `memberships` | legătura utilizator ↔ firmă, cu rol (`owner`, `admin`, `agent`) |
| `clients` | clienții firmei |
| `catalog_items` | produse și servicii cu preț, UM și cotă TVA |
| `quotes` | oferta: număr, client, stare, date, discount pe total |
| `quote_items` | liniile ofertei, cu prețul înghețat la momentul adăugării |
| `quote_counters` | contorul de numerotare, per firmă și an |
| `quote_totals` | view cu totalurile calculate, folosit în listă |
| `visits` | vizita de teren: răspunsurile agentului, pasul următor, modelele discutate |
| `client_contacts` | oamenii întâlniți la firmă: patron, șef de echipă, meșter |
| `client_state` | view: starea firmei derivată din toate vizitele ei, cu prioritatea A/B/C |
| `question_sections` / `question_groups` / `question_options` | catalogul de întrebări din vizită, ca date |
| `invitations` | invitarea unui coleg în organizația existentă |

Toate tabelele au **RLS activ**. Accesul are două niveluri, verificate de
`public.is_member(uuid)` și `public.is_org_admin(uuid)`:

- **agent** — vede doar firmele de care răspunde (`clients.owner_agent_id`), vizitele lui și
  ofertele firmelor lui; citește tot catalogul, dar nu îl modifică
- **owner / admin** — vede și modifică tot ce ține de organizație

Un coleg nou intră în organizație printr-o invitație (`accept_invitation`), nu creând una nouă. Excepția e organizația proaspăt creată —
până la adăugarea primului membru ea rămâne vizibilă prin `created_by`, altfel onboarding-ul
s-ar bloca imediat după inserare.

## Verificarea schemei

Schema are un set de verificări care rulează pe o bază PostgreSQL locală, peste un stub minimal
al schemei `auth` din Supabase:

```bash
npm run db:test
```

Baza `romcrete_test` este recreată de la zero la fiecare rulare. Se verifică numerotarea
ofertelor, totalurile cu discount, protecția clienților care au oferte emise și izolarea
completă a datelor între două firme diferite.

## Calculul valorilor

Regulile sunt într-un singur loc, `src/lib/totals.ts`, și sunt folosite identic în interfață
și în documentul tipărit:

- valoare linie = `cantitate × preț unitar × (1 − discount linie)`
- discountul pe ofertă se aplică proporțional și asupra TVA-ului, ca baza de impozitare
  și TVA-ul să rămână consistente
- rotunjire la 2 zecimale la fiecare pas, formatare în `ro-RO`

## Deploy

Proiectul merge direct pe [Vercel](https://vercel.com): importă repository-ul, adaugă cele
două variabile de mediu și actualizează `Site URL` în Supabase cu domeniul de producție.

## Comenzi

```bash
npm run dev     # dezvoltare
npm run build   # build de producție
npm run start   # rulează build-ul
npm run lint    # ESLint
npm run db:test # verificările pe schema de bază de date
```
