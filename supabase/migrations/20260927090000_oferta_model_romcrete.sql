-- Oferta după modelul Romcrete: fiecare produs își are fișa (prezentare, ce
-- conține, specificații, avantaje, recomandări, aplicații), agentul care face
-- oferta apare cu datele și semnătura lui, iar firma pune ștampila.
--
-- Textele se scriu o dată în catalog și intră singure în fiecare ofertă, unde
-- agentul le poate modifica doar pentru clientul acela.
--
-- Scriptul se poate rula de mai multe ori fără erori.

-- ------------------------------------------------ fișa produsului

-- Fiecare text are câte un rând pe idee: „Conține”, avantajele, recomandările
-- și aplicațiile se tipăresc ca liste, câte un punct pe rând. Specificațiile au
-- câte un rând „Parametru | Valoare” sau „Parametru | Valoare | Observații”;
-- goale, se iau din catalog și din pagina magazinului, ca până acum.
alter table public.catalog_items
  add column if not exists intro            text,
  add column if not exists package_contents text,
  add column if not exists specs_text       text,
  add column if not exists benefits         text,
  add column if not exists recommendations  text,
  add column if not exists applications     text;

alter table public.quote_items
  add column if not exists intro            text,
  add column if not exists package_contents text,
  add column if not exists specs_text       text,
  add column if not exists benefits         text,
  add column if not exists recommendations  text,
  add column if not exists applications     text;

-- ------------------------------------------------ agentul pe ofertă

-- Numele e deja în memberships.full_name; telefonul, emailul de pe ofertă și
-- semnătura sunt ale fiecărui agent.
alter table public.memberships
  add column if not exists phone          text,
  add column if not exists contact_email  text,
  add column if not exists signature_mime text check (signature_mime is null or signature_mime like 'image/%'),
  add column if not exists signature_b64  text;

-- Agentul își completează singur datele de pe ofertă; rolul și țintele rămân
-- ale conducerii, de aceea nu primește dreptul să-și modifice tot rândul.
create or replace function public.save_my_offer_profile(
  p_org uuid, p_full_name text, p_phone text, p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
    set full_name     = nullif(trim(p_full_name), ''),
        phone         = nullif(trim(p_phone), ''),
        contact_email = nullif(trim(p_email), '')
    where org_id = p_org and user_id = auth.uid();
  if not found then
    raise exception 'Nu faci parte din această organizație';
  end if;
end;
$$;

-- Semnătura: o poză mică (PNG cu fundal transparent sau JPG); null o șterge.
create or replace function public.save_my_signature(p_org uuid, p_mime text, p_data text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.memberships
    set signature_mime = p_mime, signature_b64 = p_data
    where org_id = p_org and user_id = auth.uid();
  if not found then
    raise exception 'Nu faci parte din această organizație';
  end if;
end;
$$;

-- ------------------------------------------------ firma pe ofertă

alter table public.organizations
  add column if not exists websites   text,
  add column if not exists stamp_mime text check (stamp_mime is null or stamp_mime like 'image/%'),
  add column if not exists stamp_b64  text;

comment on column public.organizations.websites is 'Site-urile firmei, tipărite în subsolul ofertei.';

-- ------------------------------------------------ textele din oferta model

-- Cele două produse din oferta model primesc textele de acolo, dacă sunt în
-- catalog și n-au încă texte. Restul produselor se completează din catalog.
update public.catalog_items set
  intro = 'Pompa Graco T-MAX 657 este o soluție profesională, concepută pentru pulverizarea gleturilor, masei de finisare, materialelor decorative și tencuielilor cu granulație redusă, atât la interior, cât și la exterior. Datorită performanței ridicate și construcției modulare, acest echipament este ideal pentru proiecte medii și mari, unde viteza și calitatea finisajului fac diferența.',
  package_contents = E'Cuvă de 90 L\n17Z054 T-Max Spray Lance\nDuze HDA 651 + 655\n246215 RAC X™ Guard\n289961 Furtun de material de 1 in. x 10 m\n289959 Furtun pentru whip-end 3/4 in. x 3 m\nCutie de instrumente încorporată\nRacletă',
  specs_text = E'Presiune maximă de lucru | 65 bar\nDebit maxim material | 7,2 l/min\nCapacitate rezervor (hopper) | 90 litri\nLungime maximă furtun material | până la 30 m\nMotor | 0,9 kW, 230 V / 50 Hz\nMărime maximă duză recomandată | 0,061″ (≈ „661”)\nGreutate | ~ 73-74 kg',
  benefits = E'Eficiență sporită – prin utilizarea acestei pompe productivitatea poate crește, reducând timpul de lucru comparativ cu aplicarea manuală.\nAplicare uniformă și finisaj de calitate – distribuie materialul într-un mod constant, minimizând denivelările sau acumulările.\nDesign modular și demontabil – componentele pot fi separate rapid, fără unelte, ceea ce facilitează transportul, curățenia și întreținerea.\nCompatibilitate cu materiale diverse – gleturi de finisare/umplere, materiale decorative ușoare, tencuieli fine etc. (în funcție de granulație).\nSistem de conectare rapidă – CamLock™ și alte îmbinări rapide permit extinderea furtunelor sau schimbarea componentelor din mers.\nUșurință în utilizare – curățare facilă, operare intuitivă, materiale de întreținere și acces ușor la piese.',
  recommendations = E'Pentru aplicarea de materiale cu granulație mai mare (materiale cu particule vizibile) se recomandă utilizarea unui compresor de aer suplimentar în modul air-assisted.\nRespectarea presiunii și orientarea cablurilor/furtunelor sunt cruciale pentru performanță optimă.\nCurățarea riguroasă după terminarea lucrului prelungește durata de viață a echipamentului.\nEste indicat să utilizați furtunuri de diametru corespunzător și să minimizați lungimea acestora pentru a evita pierderi de presiune.'
where sku = '17X983' and intro is null;

update public.catalog_items set
  intro = 'Pompa airless Graco 390 Classic PC este destinată profesioniștilor care caută o soluție fiabilă, eficientă și ușor de utilizat pentru lucrări de zugrăvire și vopsire. Reprezintă combinația ideală între performanță și portabilitate, fiind alegerea perfectă pentru lucrări rezidențiale și comerciale de dimensiuni mici și medii.',
  package_contents = E'FTX-E 4-Finger Airless Spray Gun\nRAC X 517 Spray Tip and Guard\n1/4 in. x 15 m BlueMax II Airless Hose',
  specs_text = E'Presiune maximă de lucru | 227 bar (≈ 3 300 psi) | Presiunea maximă recomandată pentru pulverizare airless\nDebit maxim | 1,8 l/min (≈ 0,47 gpm) | La debit maxim sistemul funcționează la presiunea optimă\nDimensiunea maximă a duzei recomandate | 0,021″ | Pentru o pulverizare optimă, la un singur pistol\nPutere motor | ~ 0,46 kW (0,625 HP) | Motor electric cu perii\nTensiune de alimentare / frecvență | 230 V / 50 Hz | Standard european\nGreutate | ~ 14 kg | Foarte portabilă pentru lucrări mobile\nLungime maximă furtun recomandat | 15 m | Pentru păstrarea calității jetului\nTip pompă | Piston Endurance™ | Robustă, durabilă pentru materiale diverse\nSistem de înlocuire pompă | ProConnect™ | Schimbare rapidă fără scule, reducând timpii de staționare\nControl presiune | SmartControl™ | Menține presiunea constantă, oferind un jet uniform',
  benefits = E'ProConnect™ – permite schimbarea rapidă a pompei, fără scule speciale, reducând timpii de întrerupere.\nSmartControl™ – menține presiunea constantă, pentru un jet uniform și un finisaj de calitate superioară.\nPompa Endurance™ – concepută pentru rezistență și fiabilitate maximă în condiții de utilizare intensă.\nDesign compact și robust – ușor de transportat, ideal pentru șantiere cu acces limitat.\nProductivitate ridicată și timp de execuție redus.\nConsum redus de material datorită pulverizării uniforme.\nIdeală pentru vopsele lavabile, grunduri și alte materiale pe bază de apă sau solvent.\nGata de utilizare imediat – include furtun, pistol și duză.',
  applications = E'Lucrări de renovare și zugrăvire interioară/exterioară.\nVopsirea locuințelor, birourilor, spațiilor comerciale.\nProiecte de dimensiuni mici și medii, unde mobilitatea și eficiența sunt esențiale.'
where sku = '17C348' and intro is null;
