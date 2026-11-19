-- Run only against an isolated Supabase test database as its database owner.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Assertion failed: %', label; end if;
end;
$$;
insert into public.households(id) values ('71000000-0000-0000-0000-000000000001'), ('71000000-0000-0000-0000-000000000002');
insert into public.users(id,email,household_id) values
('72000000-0000-0000-0000-000000000001','test-a@invalid.test','71000000-0000-0000-0000-000000000001'),
('72000000-0000-0000-0000-000000000002','test-b@invalid.test','71000000-0000-0000-0000-000000000001'),
('72000000-0000-0000-0000-000000000003','test-c@invalid.test','71000000-0000-0000-0000-000000000002');
insert into public.lists(id,name,type,household_id) values
('73000000-0000-0000-0000-000000000001','test','supermarket','71000000-0000-0000-0000-000000000001'),
('73000000-0000-0000-0000-000000000002','test second list','supermarket','71000000-0000-0000-0000-000000000001'),
('73000000-0000-0000-0000-000000000003','test foreign','supermarket','71000000-0000-0000-0000-000000000002'),
('73000000-0000-0000-0000-000000000004','test pharmacy','pharmacy','71000000-0000-0000-0000-000000000001');
create function pg_temp.reject_test_item() returns trigger language plpgsql as $$
begin
  if new.name = 'rollback-case' then raise exception 'intentional write failure'; end if;
  return new;
end;
$$;
create trigger reject_test_item before insert on public.items for each row execute function pg_temp.reject_test_item();
set local role authenticated;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000001',true);
do $$
declare
  l uuid := '73000000-0000-0000-0000-000000000001';
  result jsonb;
  item_id uuid;
begin
  perform pg_temp.assert_true(public.normalize_grocery_name(U&'\00a0סקיר\00a0') = 'סקיר','nonbreaking spaces normalize');
  perform pg_temp.assert_true(public.normalize_grocery_name(E'חלב\t \nשקדים') = 'חלב שקדים','internal whitespace collapses');
  result := public.save_supermarket_item(l,' סקיר ',null,'manual','milk');
  item_id := (result->'item'->>'id')::uuid;
  perform pg_temp.assert_true(result->>'source' = 'manual','manual source');
  perform pg_temp.assert_true(result->'item'->>'name' = ' סקיר ','original display name retained');
  delete from public.items where id = item_id;
  perform set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000002',true);
  result := public.save_supermarket_item('73000000-0000-0000-0000-000000000002', E'\tסקיר\n',null,'auto',null,null,'dry','v1');
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'milk','partner and second list remember after deletion');
  perform pg_temp.assert_true(result->>'source' = 'remembered','remembered source beats AI');
  result := public.save_supermarket_item(l,'סקיר וניל',null,'auto',null,null,'dry','v1');
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'dry','no partial name match');
  result := public.save_supermarket_item(l,'סקיר',null,'manual','other');
  result := public.save_supermarket_item(l,'סקיר',null,'auto',null,null,'milk','v1');
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'other' and result->>'source' = 'remembered','explicit other wins');
  result := public.save_supermarket_item(l,'סקיר',null,'manual','sauces');
  result := public.save_supermarket_item(l,'סקיר',null,'auto',null,null,'milk','v1');
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'sauces','latest manual preference wins');
  result := public.save_supermarket_item(l,'new-name',null,'auto');
  perform pg_temp.assert_true(result->>'source' = 'fallback','no category falls back');
  perform pg_temp.assert_true(not exists(select from public.household_item_categorizations where normalized_name='new-name'),'fallback not learned');
  result := public.save_supermarket_item(l,'cache-test',null,'auto',null,null,'milk','v1');
  item_id := (result->'item'->>'id')::uuid;
  result := public.save_supermarket_item(l,'cache-test',null,'auto',null,null,null,'v1');
  perform pg_temp.assert_true(result->>'source' = 'cache','cached AI reuse');
  result := public.save_supermarket_item(l,'cache-test',null,'auto',null,null,'dry','v2');
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'dry','cache version changes');
  result := public.save_supermarket_item(l,'renamed','2','preserve',null,item_id);
  perform pg_temp.assert_true(result->'item'->>'section_id' = 'milk','preserve category when name changes');
  perform pg_temp.assert_true(not exists(select from public.household_item_categorizations where normalized_name='renamed'),'preserve not learned');
  begin
    perform public.save_supermarket_item(l,'rollback-case',null,'manual','milk');
    raise exception 'expected trigger failure';
  exception when raise_exception then
    if sqlerrm <> 'intentional write failure' then raise; end if;
  end;
  perform pg_temp.assert_true(not exists(select from public.household_item_categorizations where normalized_name='rollback-case'),'preference rolls back with item');
  begin
    perform public.save_supermarket_item(l,'bad',null,'manual','admin');
    raise exception 'accepted invalid category';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_supermarket_item(l,'bad',null,null);
    raise exception 'accepted null mode';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_supermarket_item('73000000-0000-0000-0000-000000000004','bad',null,'manual','milk');
    raise exception 'accepted non supermarket';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_supermarket_item('73000000-0000-0000-0000-000000000002','wrong-list',null,'preserve',null,item_id);
    raise exception 'cross-list edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_supermarket_item(l,'gone',null,'preserve',null,'74000000-0000-0000-0000-000000000099');
    raise exception 'recreated deleted item';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.household_item_categorizations(household_id,normalized_name,manual_section_id) values ('71000000-0000-0000-0000-000000000001','direct','milk');
    raise exception 'direct write allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000003',true);
  perform pg_temp.assert_true(not exists(select from public.household_item_categorizations),'foreign household RLS');
  begin
    perform public.get_supermarket_categorization(l,'סקיר');
    raise exception 'foreign lookup allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_supermarket_item(l,'סקיר',null,'manual','dry');
    raise exception 'foreign write allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.save_supermarket_item(l,'סקיר',null,'auto');
    raise exception 'unauthenticated save allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
