update public.question_sections
set title = 'Ce îl oprește și ce l-ar convinge'
where id = 'D';

update public.question_groups
set label = case id
  when 'dece' then 'Ce îl oprește să mecanizeze?'
  when 'atragere' then 'Ce l-ar convinge să folosească un utilaj?'
end
where id in ('dece', 'atragere');

update public.question_options as option
set label = wording.label
from (values
  ('pret', 'Investiția inițială este prea mare'),
  ('volum', 'Are prea puține lucrări'),
  ('mici', 'Lucrările sunt mici și dese'),
  ('ieftina', 'Are la dispoziție o echipă mai ieftină'),
  ('nustie', 'Nu cunoaște utilajele sau nu are încredere în ele'),
  ('exp', 'A avut o experiență neplăcută cu un utilaj'),
  ('curatare', 'Curățarea utilajului îi consumă prea mult timp'),
  ('clientul', 'Clientul nu acceptă un preț mai mare'),
  ('service', 'Îl preocupă service-ul și disponibilitatea pieselor'),
  ('neinc', 'Nu a folosit niciodată un utilaj')
) as wording(id, label)
where option.group_id = 'dece'
  and option.id = wording.id;