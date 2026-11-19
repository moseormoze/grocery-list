begin;
insert into public.households(id) values ('11111111-1111-1111-1111-111111111111'),('11111111-1111-1111-1111-111111111112');
insert into public.users(id,email,household_id) values
('22222222-2222-2222-2222-222222222221','a@invalid.test','11111111-1111-1111-1111-111111111111'),
('22222222-2222-2222-2222-222222222222','b@invalid.test','11111111-1111-1111-1111-111111111111'),
('22222222-2222-2222-2222-222222222223','c@invalid.test','11111111-1111-1111-1111-111111111112');
insert into public.lists(id,household_id,name,type) values
('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','test','supermarket');
create function pg_temp.reject_import_test_row() returns trigger language plpgsql as $$
begin
  if new.name='rollback' then raise exception 'test write failure' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger reject_import_test_row before insert on public.items for each row execute function pg_temp.reject_import_test_row();
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222221',true);
do $$
declare
  l uuid := '33333333-3333-3333-3333-333333333333';
  op uuid := gen_random_uuid();
  rows jsonb := '[{"name":"חלב","qty":"2","sectionId":"milk","mode":"manual"},{"name":"לחם","sectionId":"baking","mode":"auto"}]';
  first_result jsonb;
  response jsonb;
begin
  begin
    perform public.import_grocery_items(l,op,rows || '[{"name":"rollback","mode":"auto","sectionId":"other"}]');
    raise exception 'write should fail';
  exception when check_violation then null; end;
  assert not exists(select from public.items);
  assert not exists(select from public.household_item_categorizations);
  first_result := public.import_grocery_items(l,op,rows);
  assert first_result->>'status'='saved';
  assert first_result#>>'{items,0,entry_source}'='text' and first_result#>>'{items,1,name}'='לחם';
  assert (first_result#>>'{items,1,order_index}')::int=(first_result#>>'{items,0,order_index}')::int+1;
  assert public.import_grocery_items(l,op,rows)=first_result;
  begin
    perform public.import_grocery_items(l,op,rows - 1);
    raise exception 'payload reuse should fail';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
  assert (select count(*) from public.items where entry_source='text')=2;
  assert exists(select from public.household_item_categorizations where normalized_name='חלב' and manual_section_id='milk');
  response := public.import_grocery_items(l,gen_random_uuid(),rows);
  assert response->>'status'='conflict' and jsonb_array_length(response->'conflicts')=2;
  response := public.import_grocery_items(l,gen_random_uuid(),'[{"name":" חלב ","mode":"auto","sectionId":"dry","duplicateFor":"חלב"}]');
  assert response#>>'{items,0,section_id}'='milk';
  assert (select count(*) from public.items)=3;
  update public.items set ticked=true where name='לחם';
  response := public.import_grocery_items(l,gen_random_uuid(),jsonb_build_array(rows->1));
  assert response->>'status'='saved';
  response := public.import_grocery_items(l,gen_random_uuid(),'[{"name":"מים","mode":"auto","sectionId":"drinks"},{"name":" מים ","mode":"auto","sectionId":"drinks"}]');
  assert response->>'status'='conflict' and response#>>'{conflicts,0,index}'='1';
  begin
    perform 1 from public.grocery_import_receipts;
    raise exception 'direct receipt read allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222223',true);
  begin
    perform public.import_grocery_items(l,op,rows);
    raise exception 'foreign list allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
