import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Ghid" };

const CONVERSATIE: [string, string][] = [
  [
    "1. Reconectare",
    "„Nu ne-am mai văzut de o vreme, am trecut să te văd. Ce mai faci, cum merg lucrările?” Apoi: „Lucrez acum la Romcrete Echipamente, cu pompe și utilaje pentru aplicat materiale. Nu vin cu ofertă, sunt curios cum lucrați acum.”",
  ],
  [
    "2. O lucrare concretă și recentă",
    "„Ce ai avut pe mână luna asta? Cât a fost, în cât timp ai terminat-o?” Întrebi despre o lucrare, nu despre medii. Cât face pe zi alegi tu din trepte — în metri pătrați, metri liniari, repere sau mașini, după domeniul firmei —, iar materialele apar de la sine.",
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
    "„Când dai un preț, cum te gândești?” Nu spui „rentabilitate”. Vrei doar să afli dacă socotește pe mp, pe zi, din ochi sau deloc. Dacă îți dă și cifra, bifează intervalul — din ea iese calculul de amortizare.",
  ],
  [
    "7. Dacă are de lucru",
    "„Ai avut lucrări pe care nu le-ai putut accepta fiindcă nu aveai destui oameni sau capacitate?” Asta arată dacă viteza în plus se poate transforma în venit. Dacă nu a pierdut lucrări din acest motiv, discută și despre efort, calitate constantă sau dificultatea de a găsi oameni.",
  ],
  [
    "8. Oamenii",
    "„Găsești oameni ușor acum?” Aproape toți răspund că nu. E argumentul de mecanizare care funcționează și la cei care n-au mai multe lucrări: aceeași echipă, mai mult lucru.",
  ],
  [
    "9. Ce are acum",
    "„Ai încercat vreo mașină până acum? Ce-ai avut, de când o ai?” Un utilaj mai vechi de cinci ani înseamnă o înlocuire care vine, nu o obiecție. Acolo nu vinzi o schimbare de metodă, vinzi un schimb.",
  ],
  [
    "10. Șantierul și banii, la final",
    "„Pentru lucrarea asta, ce variantă de alimentare s-ar potrivi?” Notează dacă merge pe rețea, generator sau un utilaj cu motor pe benzină. E un detaliu pentru alegerea modelului, nu o condiție de vânzare. Iar la final, dacă discuția a mers bine: „dacă v-ați hotărî, ați lua din banii firmei sau în rate?”. Nu întrebi dacă are bani. Întrebi cum ar face.",
  ],
];

const CUM_FUNCTIONEAZA: [string, string][] = [
  [
    "Ecranul „Azi” și țintele",
    "Primul tab e ziua ta, nu baza de date. Sus vezi cât ai făcut față de țintă — vizitele de azi și ofertele lunii. Sub el, pașii scadenți, cu buton de sunat și de bifat direct. Apoi firmele de reluat: cele la care n-ai mai trecut de mult și n-ai niciun pas programat. O firmă caldă revine după o săptămână, una rece după o lună. Jos, firmele grupate pe localități, ca să-ți poți face ziua pe zone, nu firmă cu firmă.",
  ],
  [
    "Domeniul firmei",
    "La firmă nouă alegi domeniul: construcții și finisaje, vopsire industrială, ignifugare, izolații, marcaje rutiere, lemn și mobilier, ateliere auto sau injectări. Nu e o etichetă de raport — de el atârnă tot restul: ce tipuri de lucrare și ce scule ți se arată în vizită, în ce unitate se socotește cât face pe zi și cât ia pe ea, și ce pompe din catalog îi ies în față. Restul întrebărilor — relația, interesul, cine decide, când, cum ar plăti, ce are împotrivă — sunt aceleași peste tot: alea țin de vânzare, nu de meserie.",
  ],
  [
    "Ce e de făcut cu firma",
    "Aplicația măsoară două lucruri diferite. Apetitul — cât vrea — și fezabilitatea — dacă poate plăti și dacă a pierdut lucrări din lipsă de oameni sau capacitate. Sursa de alimentare este context tehnic pentru alegerea modelului, nu un criteriu care îl exclude. Din apetit și fezabilitate iese o singură etichetă. „Urmărește acum” = vrea și poate; acolo se închid vânzările. „Deblochează” = vrea, dar ceva îl oprește; clarifică finanțarea, nu repeta încă o vizită de convingere. „Educă” = poate, dar nu vede rostul; arată calculul. „Lasă” = niciuna, revino peste câteva luni.",
  ],
  [
    "Calculul de amortizare",
    "Când ai bifat cât produce pe zi și tariful de aplicare fără materiale, apare calculul: cât ar produce mecanizat, cât înseamnă în plus pe zi și pe lună și în câte luni se plătește pompa aleasă. Randamentul diferă după domeniu și aplicația îl ia din fișa firmei. Dacă nu a pierdut lucrări din lipsă de oameni sau capacitate, calculul apare cu avertisment: presupune o cerere pe care încă nu a confirmat-o.",
  ],
  [
    "Prioritatea A / B / C",
    "Se adună puncte din patru criterii: interes (0–4), rolul în decizia de cumpărare (0–2), câte lucrări are pe lună (0–2) și când ar cumpăra (0–2). Beneficiile care îl atrag ajută la alegerea argumentului, nu îi măresc prioritatea. A înseamnă 8 puncte sau mai mult, B între 5 și 7, C sub 5. Dacă ai completat mai puțin de trei criterii, prioritatea rămâne „?”.",
  ],
  [
    "„De aflat”",
    "Sub fiecare firmă scrie ce nu s-a aflat încă: cum lucrează, cu ce materiale, cât produce pe zi, ce echipamente are, ce îl împiedică să mecanizeze, cât e de interesat și ce rol are în decizie. Sunt informațiile de bază pentru calificarea firmei.",
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
      <PageHeader
        back={{ href: "/teren/mai-mult", label: "Mai mult" }}
        title="Ghid" description="Cum se face o vizită bună și ce înseamnă fiecare întrebare." />

      <p className="hint my-3">
        Ecranul de vizită e făcut pentru zgomot și grabă: doar atingeri și totul se salvează
        singur. Obligatoriu e doar pasul următor, cu data lui, ca să poți încheia vizita. Prima
        secțiune se completează în 20 de secunde. Restul poți să-l completezi în mașină.
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
        Bifează la „Ce roluri au fost prezente?” pe toți, dar întrebările de bani și de decizie le pui
        doar dacă patronul e singur cu tine. În fața echipei nimeni nu recunoaște că nu el decide.
      </p>
    </div>
  );
}
