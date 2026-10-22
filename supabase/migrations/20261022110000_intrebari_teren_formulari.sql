update public.question_sections
set title = 'Ce îl oprește și ce l-ar convinge'
where id = 'D';

update public.question_sections
set title = 'Context, sprijin din echipă și etapă'
where id = 'F';

update public.question_groups
set label = case id
  when 'relatie' then 'Cum a decurs relația cu firma?'
  when 'mod' then 'Cum execută lucrările acum?'
  when 'interes' then 'Cât de interesat este de mecanizare?'
  when 'tip' then 'Ce tipuri de lucrări execută?'
  when 'faza' then 'În ce etapă a lucrării se află?'
  when 'materiale' then 'Cu ce materiale lucrează?'
  when 'scule' then 'Ce echipamente folosește acum?'
  when 'echipa' then 'Câți oameni are în echipă?'
  when 'volum' then 'Câte lucrări similare execută într-o lună obișnuită?'
  when 'supr' then 'Cât produce într-o zi obișnuită (dintr-o lucrare recentă)?'
  when 'dece' then 'Ce îl împiedică să folosească un utilaj?'
  when 'obiectii' then 'Ce îl face să ezite?'
  when 'pretMod' then 'Cum facturează lucrarea?'
  when 'calcul' then 'Cum estimează dacă merită investiția?'
  when 'atragere' then 'Ce beneficiu l-ar convinge să folosească un utilaj?'
  when 'decide' then 'Ce rol are în decizia de cumpărare?'
  when 'cand' then 'Când ar lua în calcul să cumpere?'
  when 'plata' then 'Cum ar finanța achiziția?'
  when 'manopera' then 'Cât facturează pentru aplicare, fără materiale (lei/mp)?'
  when 'oameni' then 'Cât de ușor găsește oameni pentru lucrări?'
  when 'utilaj' then 'Ce utilaj folosește acum și de când?'
  when 'refuzat' then 'A refuzat vreo lucrare în ultimele 3 luni, indiferent de motiv?'
  when 'santier' then 'Ce condiții de lucru întâlnește în general?'
  when 'prezenti' then 'Ce roluri au fost prezente?'
  when 'esc' then 'Ce trebuie clarificat de echipa tehnică sau comercială?'
  when 'etapa' then 'În ce etapă este oportunitatea?'
end
where id in (
  'relatie', 'mod', 'interes', 'tip', 'faza', 'materiale', 'scule', 'echipa', 'volum', 'supr', 'dece',
  'obiectii', 'pretMod', 'calcul', 'atragere', 'decide', 'cand', 'plata', 'manopera',
  'oameni', 'utilaj', 'refuzat', 'santier', 'prezenti', 'esc', 'etapa'
);

update public.question_groups
set label_by_domain = jsonb_build_object(
  'marcaje', 'Cât facturează pentru aplicare, fără materiale (lei/ml)',
  'lemn', 'Cât facturează pentru aplicare, fără materiale (lei/reper)',
  'auto', 'Cât facturează pentru aplicare, fără materiale (lei/mașină)',
  'injectari', 'Cât facturează pentru aplicare, fără materiale (lei/m de fisură)'
)
where id = 'manopera';

update public.question_groups
set allows_note = true
where id = 'decide';

update public.question_options as option
set label = wording.label
from (values
  ('prezenti', 'patron', 'Patron / proprietar'),
  ('urmator', 'owner', 'Îl pun în legătură cu responsabilul (online)'),
  ('decide', 'singur', 'Este decidentul'),
  ('decide', 'influ', 'Influențează decizia'),
  ('decide', 'nu', 'Nu participă la decizie'),
  ('decide', 'nustiu', 'Nu am aflat'),
  ('calcul', 'niciodata', 'Nu a calculat niciodată'),
  ('calcul', 'ochi', 'Estimativ, fără cifre'),
  ('calcul', 'hartie', 'A făcut un calcul pe hârtie'),
  ('calcul', 'cifre', 'Cu un calcul concret'),
  ('esc', 'compat', 'Compatibilitatea materialului cu pompa'),
  ('esc', 'model', 'Alegerea modelului potrivit'),
  ('esc', 'pret', 'Prețul sau oferta'),
  ('esc', 'service', 'Service-ul sau disponibilitatea pieselor'),
  ('obiectii', 'scump', 'Prețul este prea mare'),
  ('obiectii', 'complicat', 'Utilajul pare prea complicat de folosit'),
  ('obiectii', 'service', 'Îl preocupă service-ul și disponibilitatea pieselor'),
  ('obiectii', 'sedescurca', 'Preferă să continue cu metoda actuală'),
  ('obiectii', 'aredeja', 'Folosește deja un utilaj de la alt furnizor'),
  ('obiectii', 'faralucrari', 'Nu are suficiente lucrări'),
  ('obiectii', 'incredere', 'Nu are încredere în distribuitor'),
  ('obiectii', 'maiieftin', 'A găsit un utilaj similar mai ieftin'),
  ('obiectii', 'nudecide', 'Nu este persoana care decide cumpărarea'),
  ('obiectii', 'finantare', 'Nu poate finanța achiziția acum'),
  ('atragere', 'nimic', 'Niciun beneficiu nu îl convinge acum'),
  ('dece', 'pret', 'Investiția inițială este prea mare'),
  ('dece', 'volum', 'Are prea puține lucrări'),
  ('dece', 'mici', 'Lucrările sunt prea mici pentru a justifica folosirea utilajului'),
  ('dece', 'ieftina', 'Găsește oameni disponibili la cost redus'),
  ('dece', 'nustie', 'Nu cunoaște utilajele sau nu are încredere în ele'),
  ('dece', 'exp', 'A avut o experiență neplăcută cu un utilaj'),
  ('dece', 'curatare', 'Curățarea utilajului îi consumă prea mult timp'),
  ('dece', 'clientul', 'Beneficiarul lucrării nu plătește în plus pentru mecanizare'),
  ('dece', 'service', 'Îl preocupă service-ul și disponibilitatea pieselor'),
  ('dece', 'neinc', 'Nu a folosit niciodată un utilaj')
) as wording(group_id, id, label)
where option.group_id = wording.group_id
  and option.id = wording.id;