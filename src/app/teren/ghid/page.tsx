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
    "„Când dai un preț pe mp, cum te gândești?” Nu spui „rentabilitate”. Vrei doar să afli dacă socotește pe mp, pe zi, din ochi sau deloc. Dacă îți dă și cifra, bifează intervalul — din ea iese calculul de amortizare.",
  ],
  [
    "7. Dacă are de lucru",
    "„Ai avut de refuzat ceva luna trecută?” Sună a laudă, nu a anchetă, și e cea mai importantă informație din toată vizita. Dacă refuză lucrări, mecanizarea se transformă direct în bani. Dacă nu refuză, viteza nu-l ajută cu nimic — și atunci vinzi altceva: efortul, calitatea constantă, oamenii pe care nu-i găsește.",
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
    "„Aveți curent tras pe șantierele voastre?” — dacă lucrează fără curent, îi trebuie generator înainte de pompă, altfel vinzi ceva ce nu poate porni. Iar la final, dacă discuția a mers bine: „dacă v-ați hotărî, ați lua din banii firmei sau în rate?”. Nu întrebi dacă are bani. Întrebi cum ar face.",
  ],
];

const CUM_FUNCTIONEAZA: [string, string][] = [
  [
    "Ce e de făcut cu firma",
    "Aplicația măsoară două lucruri diferite. Apetitul — cât vrea — și fezabilitatea — cât poate: dacă are cu ce plăti, dacă are curent pe șantier, dacă are cerere pentru capacitatea în plus. Din ele iese o singură etichetă. „Urmărește acum” = vrea și poate; acolo se închid vânzările. „Deblochează” = vrea, dar ceva îl oprește; acolo te duci cu leasingul sau cu generatorul, nu cu încă o vizită de convingere. „Educă” = poate, dar nu vede rostul; acolo arăți calculul. „Lasă” = niciuna, revii peste câteva luni.",
  ],
  [
    "Calculul de amortizare",
    "Când ai bifat suprafața pe zi și cât ia pe mp, apare în vizită un calcul: câți mp ar face mecanizat, cât înseamnă în plus pe zi și pe lună, și în câte luni se plătește pompa aleasă. E gândit ca să i-l arăți pe telefon. Dacă a spus că nu refuză lucrări, calculul apare cu avertisment — presupune o cerere pe care încă n-o are, iar dacă i-l arăți oricum, își va da seama singur și pierzi încrederea.",
  ],
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
