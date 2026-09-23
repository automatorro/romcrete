-- Domeniile în care lucrează clienții Romcrete.
--
-- Întrebările din vizită erau scrise ca și cum toți clienții ar fi constructori:
-- „tipul lucrării” mergea de la casă nouă la șape, „sculele” de la găleată la
-- mașina de tencuit, iar amortizarea se calcula numai în metri pătrați. Romcrete
-- vinde însă din 2008 în toate domeniile — vopsire industrială, ignifugare,
-- izolații, marcaje rutiere, lemn și mobilier, ateliere auto, injectări —, iar
-- catalogul are pompe pentru fiecare dintre ele.
--
-- Diferența nu e cosmetică: un om care face marcaje rutiere nu vinde metri
-- pătrați, ci metri liniari, iar un atelier auto vinde mașini. Calculul de
-- amortizare, care e argumentul central al vânzării, dădea cifre fără sens
-- pentru ei.
--
-- Soluția: domeniul devine o proprietate a firmei, aleasă acolo unde se alegea
-- „ce este”. El hotărăște ce întrebări apar, în ce unitate de măsură se
-- socotește randamentul și ce categorii de pompe se sugerează. Coloana vertebrală
-- a vânzării — relația, interesul, cine decide, când, cum plătește, obiecțiile,
-- etapa — rămâne comună tuturor: aia nu ține de meserie.

-- ------------------------------------------------------------- domeniile

create table public.domains (
  id                  text primary key,
  label               text not null,
  short_label         text not null,
  -- Unitatea în care se măsoară producția zilnică și prețul manoperei.
  unit                text not null,
  unit_label          text not null,
  -- „30 mp/zi” vs „1.250 ml/zi”: cum se scrie unitatea lângă cifră.
  unit_short          text not null,
  -- De câte ori se lucrează mai mult mecanizat decât manual, în acest domeniu.
  -- La marcaje diferența e uriașă, la atelierul auto e modestă.
  productivity_factor numeric(4,2) not null default 2.5,
  -- Categoriile din catalog potrivite domeniului. Gol = toate.
  pump_categories     text[] not null default '{}',
  -- Filtru suplimentar pe tehnologie, când aceeași categorie servește domenii
  -- diferite: „Pompe de zugravit” acoperă și zugrăveala, și finisajul fin HVLP.
  tech_types          text[],
  position            integer not null
);

comment on table public.domains is
  'Domeniile de activitate ale clienților. Hotărăsc întrebările, unitatea de măsură și pompele sugerate.';

alter table public.domains enable row level security;

create policy "domenii: citire" on public.domains
  for select to authenticated using (true);

create policy "domenii: conducerea corectează ipotezele" on public.domains
  for update to authenticated
  using (public.is_any_org_admin())
  with check (public.is_any_org_admin());

insert into public.domains
  (id, label, short_label, unit, unit_label, unit_short, productivity_factor,
   pump_categories, tech_types, position)
values
  ('constructii', 'Construcții și finisaje', 'Construcții',
   'mp', 'metri pătrați', 'mp', 2.5,
   '{"Pompe de zugravit","Pompe de glet","Pompe pardoseli","Pompe ToughTek (rotor-stator)","Pompe pentru uz casnic-diy"}',
   null, 1),

  ('industrial', 'Vopsire industrială și anticorozivă', 'Industrial',
   'mp', 'metri pătrați', 'mp', 3.0,
   '{"Pompe anticoroziv"}', null, 2),

  ('ignifugare', 'Ignifugare și protecție la foc', 'Ignifugare',
   'mp', 'metri pătrați', 'mp', 3.0,
   '{"Pompe ignifugare"}', null, 3),

  ('izolatii', 'Izolații: spumă poliuretanică și poliuree', 'Izolații',
   'mp', 'metri pătrați', 'mp', 4.0,
   '{"Pompe spumă poliuretanică"}', null, 4),

  ('marcaje', 'Marcaje rutiere și semnalizare', 'Marcaje',
   'ml', 'metri liniari', 'ml', 5.0,
   '{"Pompe marcaje rutiere"}', null, 5),

  ('lemn', 'Lemn, mobilier și finisaje fine', 'Lemn / mobilier',
   'reper', 'repere', 'repere', 3.0,
   '{"Pompe de zugravit"}', '{"HVLP","Air-Assisted"}', 6),

  ('auto', 'Ateliere auto și vopsitorii auto', 'Auto',
   'masina', 'mașini', 'mașini', 2.0,
   '{"Pompe de zugravit"}', '{"HVLP","Air-Assisted"}', 7),

  ('injectari', 'Injectări rășini și consolidări', 'Injectări',
   'ml', 'metri de fisură', 'm', 3.0,
   '{"Pompe injectare rășini"}', null, 8);

-- --------------------------------------- ipotezele firmei, pe domeniu

-- Randamentul din `domains` e o medie de piață. Fiecare firmă și-l poate corecta
-- pe fiecare domeniu, din Setări, fără migrație — la fel ca pragurile de manoperă.
create table public.org_domain_params (
  org_id              uuid not null references public.organizations (id) on delete cascade,
  domain_id           text not null references public.domains (id) on delete cascade,
  productivity_factor numeric(4,2),
  -- Un domeniu nefolosit poate fi scos din listele agenților.
  active              boolean not null default true,
  primary key (org_id, domain_id)
);

alter table public.org_domain_params enable row level security;

create policy "parametri domenii: membrii citesc" on public.org_domain_params
  for select to authenticated using (public.is_member(org_id));

create policy "parametri domenii: conducerea scrie" on public.org_domain_params
  for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- ------------------------------------------------- domeniul unei firme

alter table public.clients
  add column domain text references public.domains (id);

-- Tot ce s-a introdus până acum a fost introdus cu întrebări de construcții.
update public.clients set domain = 'constructii' where domain is null;

alter table public.clients
  alter column domain set default 'constructii';

comment on column public.clients.domain is
  'Domeniul în care lucrează firma. Hotărăște întrebările din vizită și unitatea de calcul.';

create index clients_domain_idx on public.clients (org_id, domain);

-- ------------------------------ întrebările devin sensibile la domeniu

-- Null = întrebarea sau opțiunea apare în toate domeniile. Așa, coloana
-- vertebrală a vânzării rămâne neatinsă și nu trebuie repetată de opt ori.
alter table public.question_groups
  add column domains         text[],
  -- „Cât ia pe mp” la marcaje se cheamă „Cât ia pe metru liniar”.
  add column label_by_domain jsonb not null default '{}'::jsonb;

alter table public.question_options
  add column domains text[];

comment on column public.question_options.domains is
  'Domeniile în care apare opțiunea. Null = în toate.';

-- Etichetele care depind de unitatea de măsură.
update public.question_groups
set label_by_domain = jsonb_build_object(
  'marcaje',   'Metri liniari pe zi (dintr-o lucrare recentă)',
  'lemn',      'Repere pe zi (dintr-o lucrare recentă)',
  'auto',      'Mașini pe zi (dintr-o săptămână obișnuită)',
  'injectari', 'Metri de fisură pe zi (dintr-o lucrare recentă)'
)
where id = 'supr';

update public.question_groups
set label_by_domain = jsonb_build_object(
  'marcaje',   'Cât ia pe metru liniar',
  'lemn',      'Cât ia pe reper',
  'auto',      'Cât ia pe mașină',
  'injectari', 'Cât ia pe metru de fisură'
)
where id = 'manopera';

update public.question_groups
set label_by_domain = jsonb_build_object(
  'auto',      'În ce fază e lucrarea (pe o mașină)',
  'injectari', 'În ce fază e intervenția'
)
where id = 'faza';

-- Opțiunile existente au fost scrise pentru construcții și acolo rămân.
update public.question_options set domains = '{constructii}'
where group_id in ('tip', 'faza')
   or (group_id = 'scule'    and id in ('galeata', 'betoniera', 'masina', 'sapa'))
   or (group_id = 'supr'     and id in ('m30', 'm60', 'm100', 'm100p'))
   or (group_id = 'manopera' and id in ('sub15', 'lei1525', 'lei2540', 'peste40'));

-- Materialele existente se împart pe domeniile în care chiar apar.
update public.question_options set domains = '{constructii}'
  where group_id = 'materiale' and id in ('tencuiala', 'glet', 'vopsea', 'sapa', 'termo');
update public.question_options set domains = '{constructii,izolatii}'
  where group_id = 'materiale' and id = 'hidro';
update public.question_options set domains = '{constructii,lemn,auto}'
  where group_id = 'materiale' and id = 'email';
update public.question_options set domains = '{industrial,ignifugare}'
  where group_id = 'materiale' and id = 'indus';
update public.question_options set domains = '{marcaje}'
  where group_id = 'materiale' and id = 'marcaje';
update public.question_options set domains = '{constructii,industrial,ignifugare,lemn,auto}'
  where group_id = 'materiale' and id = 'amorsa';

-- „Pe mp” are sens numai unde se vinde suprafață.
update public.question_options set domains = '{constructii,industrial,ignifugare,izolatii}'
  where group_id = 'pretMod' and id = 'mp';

-- Etajul e o problemă de șantier, nu de atelier.
update public.question_options set domains = '{constructii,industrial,izolatii,ignifugare}'
  where group_id = 'santier' and id = 'etaj';

-- ------------------------------------------------ vocabularul fiecărui domeniu

insert into public.question_options (group_id, id, label, position, value, domains) values
  -- Tipul lucrării ------------------------------------------------------------
  ('tip', 'i_hale',      'Hale și structuri metalice',        11, null, '{industrial}'),
  ('tip', 'i_rezerv',    'Rezervoare / silozuri',             12, null, '{industrial}'),
  ('tip', 'i_conducte',  'Conducte / estacade',               13, null, '{industrial}'),
  ('tip', 'i_utilaje',   'Utilaje și echipamente',            14, null, '{industrial}'),
  ('tip', 'i_revopsire', 'Reabilitare / revopsire',           15, null, '{industrial}'),
  ('tip', 'i_naval',     'Naval / offshore',                  16, null, '{industrial}'),

  ('tip', 'g_hale',      'Structuri metalice de hală',        21, null, '{ignifugare}'),
  ('tip', 'g_parcari',   'Parcări subterane',                 22, null, '{ignifugare}'),
  ('tip', 'g_comercial', 'Centre comerciale',                 23, null, '{ignifugare}'),
  ('tip', 'g_birouri',   'Clădiri de birouri',                24, null, '{ignifugare}'),
  ('tip', 'g_receptie',  'Lucrări cu recepție ISU',           25, null, '{ignifugare}'),

  ('tip', 'z_acoperis',  'Acoperișuri (hidroizolație)',       31, null, '{izolatii}'),
  ('tip', 'z_mansarda',  'Mansarde / pereți (izolație termică)', 32, null, '{izolatii}'),
  ('tip', 'z_fundatii',  'Fundații / subsoluri',              33, null, '{izolatii}'),
  ('tip', 'z_bazine',    'Bazine și platforme',               34, null, '{izolatii}'),
  ('tip', 'z_frigo',     'Camere frigorifice / depozite',     35, null, '{izolatii}'),

  ('tip', 'r_drumuri',   'Drumuri publice',                   41, null, '{marcaje}'),
  ('tip', 'r_autostr',   'Autostrăzi / drumuri expres',       42, null, '{marcaje}'),
  ('tip', 'r_parcari',   'Parcări',                           43, null, '{marcaje}'),
  ('tip', 'r_hale',      'Marcaje în hale și depozite',       44, null, '{marcaje}'),
  ('tip', 'r_sport',     'Terenuri de sport',                 45, null, '{marcaje}'),
  ('tip', 'r_aero',      'Aeroporturi',                       46, null, '{marcaje}'),

  ('tip', 'w_mobilier',  'Mobilier la comandă',               51, null, '{lemn}'),
  ('tip', 'w_usi',       'Uși și ferestre',                   52, null, '{lemn}'),
  ('tip', 'w_scari',     'Scări și balustrade',               53, null, '{lemn}'),
  ('tip', 'w_tamplarie', 'Tâmplărie exterioară',              54, null, '{lemn}'),
  ('tip', 'w_lambriu',   'Placaje și lambriuri',              55, null, '{lemn}'),
  ('tip', 'w_restaur',   'Restaurări / retușuri',             56, null, '{lemn}'),

  ('tip', 'a_caroserie', 'Piese de caroserie',                61, null, '{auto}'),
  ('tip', 'a_spot',      'Reparații mici (spot repair)',      62, null, '{auto}'),
  ('tip', 'a_integral',  'Vopsire integrală',                 63, null, '{auto}'),
  ('tip', 'a_camioane',  'Camioane / utilaje',                64, null, '{auto}'),
  ('tip', 'a_flote',     'Dube și flote',                     65, null, '{auto}'),
  ('tip', 'a_jante',     'Jante și accesorii',                66, null, '{auto}'),

  ('tip', 'j_fisuri',    'Fisuri în beton',                   71, null, '{injectari}'),
  ('tip', 'j_infiltr',   'Opriri de infiltrații',             72, null, '{injectari}'),
  ('tip', 'j_consolid',  'Consolidări structurale',           73, null, '{injectari}'),
  ('tip', 'j_ancore',    'Ancorări chimice',                  74, null, '{injectari}'),
  ('tip', 'j_rosturi',   'Etanșări de rosturi',               75, null, '{injectari}'),

  -- Faza lucrării -------------------------------------------------------------
  ('faza', 'i_pregatire', 'Pregătire suprafață / sablare',    11, null, '{industrial}'),
  ('faza', 'i_grund',     'Grund',                            12, null, '{industrial}'),
  ('faza', 'i_intermed',  'Strat intermediar',                13, null, '{industrial}'),
  ('faza', 'i_final',     'Strat final',                      14, null, '{industrial}'),
  ('faza', 'i_receptie',  'Retuș și recepție',                15, null, '{industrial}'),

  ('faza', 'g_pregatire', 'Pregătire suprafață',              21, null, '{ignifugare}'),
  ('faza', 'g_grund',     'Grund',                            22, null, '{ignifugare}'),
  ('faza', 'g_intumesc',  'Strat intumescent',                23, null, '{ignifugare}'),
  ('faza', 'g_finisaj',   'Finisaj de acoperire',             24, null, '{ignifugare}'),
  ('faza', 'g_masurat',   'Măsurători și recepție',           25, null, '{ignifugare}'),

  ('faza', 'z_suport',    'Pregătire suport',                 31, null, '{izolatii}'),
  ('faza', 'z_aplicare',  'Aplicare spumă / poliuree',        32, null, '{izolatii}'),
  ('faza', 'z_protectie', 'Protecție UV / finisaj',           33, null, '{izolatii}'),
  ('faza', 'z_receptie',  'Recepție',                         34, null, '{izolatii}'),

  ('faza', 'r_frezare',   'Frezare / ștergere marcaj vechi',  41, null, '{marcaje}'),
  ('faza', 'r_premarcaj', 'Premarcaj',                        42, null, '{marcaje}'),
  ('faza', 'r_aplicare',  'Aplicare',                         43, null, '{marcaje}'),
  ('faza', 'r_receptie',  'Recepție / garanție',              44, null, '{marcaje}'),

  ('faza', 'w_slefuire',  'Șlefuire',                         51, null, '{lemn}'),
  ('faza', 'w_grund',     'Grund',                            52, null, '{lemn}'),
  ('faza', 'w_vopsire',   'Vopsire / lăcuire',                53, null, '{lemn}'),
  ('faza', 'w_final',     'Finisaj final',                    54, null, '{lemn}'),

  ('faza', 'a_pregatire', 'Pregătire / șlefuire',             61, null, '{auto}'),
  ('faza', 'a_chit',      'Chituire',                         62, null, '{auto}'),
  ('faza', 'a_grund',     'Grund',                            63, null, '{auto}'),
  ('faza', 'a_baza',      'Bază de culoare',                  64, null, '{auto}'),
  ('faza', 'a_lac',       'Lac',                              65, null, '{auto}'),

  ('faza', 'j_identif',   'Identificarea fisurilor',          71, null, '{injectari}'),
  ('faza', 'j_pachere',   'Montaj pachere',                   72, null, '{injectari}'),
  ('faza', 'j_injectare', 'Injectare',                        73, null, '{injectari}'),
  ('faza', 'j_etansare',  'Etanșare și recepție',             74, null, '{injectari}'),

  -- Materiale -----------------------------------------------------------------
  -- Fiecare material nou are pereche în regulile din cod, altfel n-ar sugera
  -- nicio categorie de pompe și bifa n-ar folosi la nimic.
  ('materiale', 'epoxid',     'Epoxidice / poliuretanice bicomponente', 11, null,
   '{constructii,industrial,izolatii,injectari}'),
  ('materiale', 'ignifug',    'Vopsea intumescentă / ignifugă',         12, null, '{ignifugare}'),
  ('materiale', 'vopseaauto', 'Vopsea auto / lacuri fine',              13, null, '{auto,lemn}'),
  ('materiale', 'rasini',     'Rășini de injectare',                    14, null, '{injectari}'),

  -- Sculele de acum -----------------------------------------------------------
  ('scule', 'i_pensula',  'Pensulă și trafalet',               11, null, '{industrial,ignifugare,lemn}'),
  ('scule', 'i_cupa',     'Pistol cu cupă / compresor',        12, null, '{industrial,ignifugare,lemn,auto}'),
  ('scule', 'i_sablare',  'Sablare + pistol',                  13, null, '{industrial}'),
  ('scule', 'i_subcontr', 'Subcontractează aplicarea',         14, null,
   '{industrial,ignifugare,izolatii,marcaje,injectari}'),

  ('scule', 'z_role',     'Manual, cu role / gletiere',        21, null, '{izolatii}'),
  ('scule', 'z_lowp',     'Mașină de spumă joasă presiune',    22, null, '{izolatii}'),
  ('scule', 'z_highp',    'Mașină de spumă înaltă presiune',   23, null, '{izolatii}'),

  ('scule', 'r_sablon',   'Manual, cu șablon',                 31, null, '{marcaje}'),
  ('scule', 'r_impins',   'Mașină manuală cu împingere',       32, null, '{marcaje}'),
  ('scule', 'r_autoprop', 'Mașină autopropulsată',             33, null, '{marcaje}'),
  ('scule', 'r_camion',   'Camion de marcaje',                 34, null, '{marcaje}'),

  ('scule', 'w_hvlp',     'Pistol HVLP',                       41, null, '{lemn,auto}'),
  ('scule', 'w_cabina',   'Cabină de vopsire',                 42, null, '{lemn,auto}'),
  ('scule', 'a_trimite',  'Nu vopsește — trimite afară',       43, null, '{auto}'),

  ('scule', 'j_manuala',  'Pompă manuală de injectare',        51, null, '{injectari}'),
  ('scule', 'j_pneum',    'Pompă pneumatică',                  52, null, '{injectari}'),
  ('scule', 'j_electr',   'Pompă electrică',                   53, null, '{injectari}'),

  -- Producția pe zi -----------------------------------------------------------
  -- Intervalele diferă de la domeniu la domeniu pentru că ordinul de mărime
  -- diferă: 60 mp de glet pe zi și 2.000 ml de marcaj pe zi sunt amândouă
  -- „o zi bună”. Valorile sunt mijlocul intervalului și se corectează din aplicație.
  ('supr', 'ind50',    'Sub 50 mp',            11,  35, '{industrial}'),
  ('supr', 'ind150',   '50–150 mp',            12, 100, '{industrial}'),
  ('supr', 'ind300',   '150–300 mp',           13, 220, '{industrial}'),
  ('supr', 'ind300p',  'Peste 300 mp',         14, 400, '{industrial}'),

  ('supr', 'ign30',    'Sub 30 mp',            21,  20, '{ignifugare}'),
  ('supr', 'ign80',    '30–80 mp',             22,  55, '{ignifugare}'),
  ('supr', 'ign150',   '80–150 mp',            23, 115, '{ignifugare}'),
  ('supr', 'ign150p',  'Peste 150 mp',         24, 200, '{ignifugare}'),

  ('supr', 'izo100',   'Sub 100 mp',           31,  70, '{izolatii}'),
  ('supr', 'izo300',   '100–300 mp',           32, 200, '{izolatii}'),
  ('supr', 'izo600',   '300–600 mp',           33, 450, '{izolatii}'),
  ('supr', 'izo600p',  'Peste 600 mp',         34, 800, '{izolatii}'),

  ('supr', 'mrc500',   'Sub 500 ml',           41, 350, '{marcaje}'),
  ('supr', 'mrc2000',  '500–2.000 ml',         42, 1250, '{marcaje}'),
  ('supr', 'mrc5000',  '2.000–5.000 ml',       43, 3500, '{marcaje}'),
  ('supr', 'mrc5000p', 'Peste 5.000 ml',       44, 7000, '{marcaje}'),

  ('supr', 'lem10',    'Sub 10 repere',        51,   6, '{lemn}'),
  ('supr', 'lem30',    '10–30 repere',         52,  20, '{lemn}'),
  ('supr', 'lem60',    '30–60 repere',         53,  45, '{lemn}'),
  ('supr', 'lem60p',   'Peste 60 repere',      54,  80, '{lemn}'),

  ('supr', 'auto2',    'Sub 2 mașini',         61,   1, '{auto}'),
  ('supr', 'auto5',    '2–5 mașini',           62,   3, '{auto}'),
  ('supr', 'auto10',   '5–10 mașini',          63,   7, '{auto}'),
  ('supr', 'auto10p',  'Peste 10 mașini',      64,  14, '{auto}'),

  ('supr', 'inj20',    'Sub 20 m de fisură',   71,  12, '{injectari}'),
  ('supr', 'inj50',    '20–50 m',              72,  35, '{injectari}'),
  ('supr', 'inj100',   '50–100 m',             73,  75, '{injectari}'),
  ('supr', 'inj100p',  'Peste 100 m',          74, 150, '{injectari}'),

  -- Prețul manoperei ----------------------------------------------------------
  ('manopera', 'i2540',     '25–40 lei/mp',          11,   32, '{industrial}'),
  ('manopera', 'i4070',     '40–70 lei/mp',          12,   55, '{industrial}'),
  ('manopera', 'i70120',    '70–120 lei/mp',         13,   95, '{industrial}'),
  ('manopera', 'i120p',     'Peste 120 lei/mp',      14,  150, '{industrial}'),

  ('manopera', 'g60',       'Sub 60 lei/mp',         21,   45, '{ignifugare}'),
  ('manopera', 'g60120',    '60–120 lei/mp',         22,   90, '{ignifugare}'),
  ('manopera', 'g120200',   '120–200 lei/mp',        23,  160, '{ignifugare}'),
  ('manopera', 'g200p',     'Peste 200 lei/mp',      24,  250, '{ignifugare}'),

  ('manopera', 'z30',       'Sub 30 lei/mp',         31,   25, '{izolatii}'),
  ('manopera', 'z3060',     '30–60 lei/mp',          32,   45, '{izolatii}'),
  ('manopera', 'z60100',    '60–100 lei/mp',         33,   80, '{izolatii}'),
  ('manopera', 'z100p',     'Peste 100 lei/mp',      34,  130, '{izolatii}'),

  ('manopera', 'r3',        'Sub 3 lei/ml',          41,  2.5, '{marcaje}'),
  ('manopera', 'r36',       '3–6 lei/ml',            42,  4.5, '{marcaje}'),
  ('manopera', 'r610',      '6–10 lei/ml',           43,    8, '{marcaje}'),
  ('manopera', 'r10p',      'Peste 10 lei/ml',       44,   14, '{marcaje}'),

  ('manopera', 'w50',       'Sub 50 lei/reper',      51,   35, '{lemn}'),
  ('manopera', 'w50150',    '50–150 lei/reper',      52,  100, '{lemn}'),
  ('manopera', 'w150400',   '150–400 lei/reper',     53,  275, '{lemn}'),
  ('manopera', 'w400p',     'Peste 400 lei/reper',   54,  600, '{lemn}'),

  ('manopera', 'a800',      'Sub 800 lei/mașină',    61,  600, '{auto}'),
  ('manopera', 'a2000',     '800–2.000 lei/mașină',  62, 1400, '{auto}'),
  ('manopera', 'a5000',     '2.000–5.000 lei/mașină',63, 3500, '{auto}'),
  ('manopera', 'a5000p',    'Peste 5.000 lei/mașină',64, 8000, '{auto}'),

  ('manopera', 'j50',       'Sub 50 lei/m',          71,   40, '{injectari}'),
  ('manopera', 'j50150',    '50–150 lei/m',          72,  100, '{injectari}'),
  ('manopera', 'j150300',   '150–300 lei/m',         73,  220, '{injectari}'),
  ('manopera', 'j300p',     'Peste 300 lei/m',       74,  450, '{injectari}'),

  -- Cum dă prețul -------------------------------------------------------------
  ('pretMod', 'ml',  'Pe metru liniar',   11, null, '{marcaje,injectari}'),
  ('pretMod', 'buc', 'Pe reper / mașină', 12, null, '{lemn,auto}'),

  -- Condiții de lucru ---------------------------------------------------------
  ('santier', 'trafic',  'Lucrează în trafic / noaptea',  11, null, '{marcaje}'),
  ('santier', 'cabina',  'Are cabină / atelier propriu',  12, null, '{lemn,auto}'),
  ('santier', 'aer',     'Are compresor de aer',          13, null, '{industrial,lemn,auto,ignifugare}');

-- ------------------------------------------- domeniul în starea firmei

drop view public.client_state;

create view public.client_state
with (security_invoker = on)
as
select
  c.id                as client_id,
  c.org_id,
  c.owner_agent_id,
  c.name,
  c.trade_type,
  c.domain,
  c.city,
  c.phone,
  a.answers,
  a.answers ->> 'etapa'   as stage,
  a.answers ->> 'interes' as interest,
  public.client_priority(a.answers)    as priority,
  public.client_feasibility(a.answers) as feasibility,
  public.client_focus(a.answers)       as focus,
  v.visit_count,
  v.last_visit,
  case when ns.next_step_done_at is null then ns.step      end as next_step,
  case when ns.next_step_done_at is null then ns.step_date end as next_step_date,
  case when ns.next_step_done_at is null then ns.visit_id  end as next_step_visit_id,
  (ns.next_step_done_at is null and ns.step_date is not null and ns.step_date < current_date) as next_step_late,
  e.pending_escalations,
  w.is_warm,
  case
    when v.last_visit is null then null
    else v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
  end as recontact_due,
  (
    (ns.visit_id is null or ns.next_step_done_at is not null)
    and v.last_visit is not null
    and v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
        <= current_date
  ) as needs_recontact
from public.clients c
join public.organizations o on o.id = c.org_id
cross join lateral (select public.merge_visit_answers(c.id) as answers) a
cross join lateral (
  select (a.answers ->> 'interes' in ('oferta', 'gata')
          or public.client_focus(a.answers) = 'urmareste') as is_warm
) w
left join lateral (
  select count(*) as visit_count, max(visit_date) as last_visit
  from public.visits v where v.client_id = c.id
) v on true
left join lateral (
  select v.id as visit_id, v.answers ->> 'urmator' as step,
         v.next_step_date as step_date, v.next_step_done_at
  from public.visits v
  where v.client_id = c.id
    and (v.answers ? 'urmator' or v.next_step_date is not null)
  order by v.visit_date desc, v.created_at desc
  limit 1
) ns on true
left join lateral (
  select count(*) as pending_escalations
  from public.visits v
  where v.client_id = c.id
    and jsonb_typeof(v.answers -> 'esc') = 'array'
    and jsonb_array_length(v.answers -> 'esc') > 0
    and v.escalation_done_at is null
) e on true;
