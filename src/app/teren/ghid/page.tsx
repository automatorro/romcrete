export const metadata = { title: "Ghid" };

const CONVERSATIE: [string, string][] = [
  [
    "1. Reconectare",
    "„Nu ne-am mai văzut de o vreme, am trecut să te văd. Ce mai faci, cum merg lucrările?” Apoi: „Lucrez acum la Romcrete Echipamente, cu pompe și utilaje pentru aplicat materiale. Nu vin cu ofertă, sunt curios cum lucrați acum.”",
  ],
  [
    "2. O lucrare concretă și recentă",
    "„Ce ai avut pe mână luna asta? Cât a fost, în cât timp ai terminat-o?” Întrebi despre o lucrare, nu despre medii. Suprafața pe zi o alegi tu din trepte, iar materialele apar de la sine.",
  ],
  ["3. Oameni și ritm", "„Câți sunteți pe șantier? Găsești oameni ușor acum?”"],
  [
    "4. Sculele",
    "„Cu ce lucrezi de obicei? Ai apucat să încerci vreo mașină?” Dacă lucrează manual: „așa a fost mereu sau ai încercat și altceva?”. Nu întrebi „de ce nu mecanizezi”, sună a acuzație.",
  ],
  [
    "5. Ce îl deranjează",
    "„Unde pierzi cel mai mult timp sau nervi pe o lucrare?” Răspunsul lui alege povestea — adică ce l-ar atrage.",
  ],
  [
    "6. Banii, doar dacă relația e bună",
    "„Când dai un preț pe mp, cum te gândești?” Nu spui „rentabilitate”. Vrei doar să afli dacă socotește pe mp, pe zi, din ochi sau deloc.",
  ],
];

const CUM_FUNCTIONEAZA: [string, string][] = [
  [
    "Prioritatea A / B / C",
    "Se adună puncte din cinci criterii: interes (0–4), cine decide (0–2), câte lucrări are pe lună (0–2), când ar cumpăra (0–2) și ce l-ar atrage (0–2, după câte motive reale a dat). A înseamnă 8 puncte sau mai mult, B între 5 și 7, C sub 5. Dacă ai completat mai puțin de trei criterii, prioritatea rămâne „?” — aplicația nu inventează un scor din date lipsă.",
  ],
  [
    "„De aflat”",
    "Sub fiecare firmă scrie ce nu s-a aflat încă: cum lucrează, cu ce materiale, câți mp pe zi, ce scule are, de ce lucrează manual, cât e de interesat și cine decide. Sunt întrebările fără de care nu poți califica un meseriaș.",
  ],
  [
    "Starea firmei",
    "Nu o scrii tu separat: se adună singură din toate vizitele. La întrebările cu un singur răspuns rămâne ce ai bifat ultima dată, la cele cu mai multe răspunsuri se adună tot ce ai aflat de-a lungul timpului.",
  ],
  [
    "Pasul următor",
    "Dacă pui o dată, firma apare în capul listei când se apropie termenul și se face roșie când a trecut. Butonul „✓ făcut” o scoate din listă.",
  ],
];

export default function GhidPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Ghid</h1>

      <p className="hint my-3">
        Ecranul de vizită e făcut pentru zgomot și grabă: doar atingeri, nimic obligatoriu, totul
        se salvează singur. Prima secțiune se completează în 20 de secunde. Restul poți să-l
        completezi în mașină.
      </p>

      <h2 className="mt-5 mb-1 text-base font-semibold">Conversația, nu interogatoriul</h2>
      {CONVERSATIE.map(([titlu, text]) => (
        <details key={titlu} className="sec">
          <summary>{titlu}</summary>
          <div className="pb-3.5 text-sm text-neutral-700">{text}</div>
        </details>
      ))}

      <h2 className="mt-5 mb-1 text-base font-semibold">Cum citești aplicația</h2>
      {CUM_FUNCTIONEAZA.map(([titlu, text]) => (
        <details key={titlu} className="sec">
          <summary>{titlu}</summary>
          <div className="pb-3.5 text-sm text-neutral-700">{text}</div>
        </details>
      ))}

      <h2 className="mt-5 mb-1 text-base font-semibold">Când sunt mai mulți oameni de față</h2>
      <p className="card p-3.5 text-sm text-neutral-700">
        Bifează la „Cine a fost prezent” pe toți, dar întrebările de bani și de decizie le pui
        doar dacă patronul e singur cu tine. În fața echipei nimeni nu recunoaște că nu el decide.
      </p>
    </div>
  );
}
