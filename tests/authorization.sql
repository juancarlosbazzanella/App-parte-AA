-- Run with a database administrator, never with an end-user connection.
-- Fixtures, sessions, files and writes are all rolled back, including on failure.
begin;
create temporary table auth_test_ids(key text primary key, id uuid not null) on commit drop;
insert into auth_test_ids select key, gen_random_uuid() from unnest(array[
  'org','other_org','admin','office','tech_a','tech_b','outsider','backup',
  'session_admin','session_office','session_a','session_b','session_outsider','session_backup',
  'client_a','client_b','machine_a','machine_b','job_a','job_b','history_b','job_signature'
]) key;
grant select on auth_test_ids to authenticated, anon;
create function pg_temp.fixture(p_key text) returns uuid language sql as $$ select id from pg_temp.auth_test_ids where key=p_key; $$;
create function pg_temp.assert_denied(p_sql text, p_code text default '42501') returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate=p_code then return; end if;
    raise;
  end;
  raise exception 'Expected denial [%]: %',p_code,p_sql;
end;
$$;

insert into auth.users(id,email,raw_user_meta_data)
select id, id::text || '@example.test', jsonb_build_object('full_name','Authorization fixture')
from auth_test_ids where key in ('admin','office','tech_a','tech_b','outsider','backup');
insert into auth.sessions(id,user_id,created_at,updated_at)
select pg_temp.fixture(a),pg_temp.fixture(b),now(),now() from (values
  ('session_admin','admin'),('session_office','office'),('session_a','tech_a'),
  ('session_b','tech_b'),('session_outsider','outsider'),('session_backup','backup')
) v(a,b);
insert into public.organizations(id,name) values(pg_temp.fixture('org'),'Authorization fixture'),(pg_temp.fixture('other_org'),'Other tenant');
insert into public.organization_members(organization_id,user_id,role)
select pg_temp.fixture('org'),pg_temp.fixture(a),b::public.member_role from (values
  ('admin','admin'),('office','office'),('tech_a','technician'),('tech_b','technician')
) v(a,b);
insert into public.organization_members(organization_id,user_id,role) values(pg_temp.fixture('other_org'),pg_temp.fixture('outsider'),'admin');
insert into public.clients(id,organization_id,name,email,created_by_user_id)
select pg_temp.fixture(a),pg_temp.fixture('org'),a,'fixture@example.test',pg_temp.fixture('office') from (values('client_a'),('client_b')) v(a);
insert into public.machines(id,organization_id,client_id,brand,model,serial_number,installation_address,created_by_user_id)
select pg_temp.fixture(a),pg_temp.fixture('org'),pg_temp.fixture(b),'Fixture','Test',a,'Test address',pg_temp.fixture('office')
from (values('machine_a','client_a'),('machine_b','client_b')) v(a,b);
insert into public.work_orders(id,organization_id,sequence_number,reference,client_id,machine_id,technician_user_id,type,scheduled_date,source,created_by_user_id)
select pg_temp.fixture(a),pg_temp.fixture('org'),n,'TEST-'||n,pg_temp.fixture(b),pg_temp.fixture(c),pg_temp.fixture(d),'maintenance',current_date,'office',pg_temp.fixture('office')
from (values('job_a','client_a','machine_a','tech_a',1001),('job_b','client_b','machine_b','tech_b',1002),('history_b','client_a','machine_a','tech_b',1003),('job_signature','client_a','machine_a','tech_a',1004)) v(a,b,c,d,n);
update public.work_orders set status='closed',work_done='Historical work',closed_by_user_id=pg_temp.fixture('tech_b'),closed_at=now(),no_signature_reason='Fixture' where id=pg_temp.fixture('history_b');

insert into storage.objects(bucket_id,name,metadata) values('work-order-files',pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png','{"mimetype":"image/png"}');

-- A backup identity gets Storage SELECT only, without application membership.
insert into private.backup_storage_readers(user_id) values(pg_temp.fixture('backup'));
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('backup'),'role','authenticated','session_id',pg_temp.fixture('session_backup'))::text,true);
set local role authenticated;
do $$ declare affected bigint; begin
  assert private.is_backup_storage_reader(), 'Live allowlisted backup session';
  assert exists(select 1 from storage.objects where name=pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png'), 'Backup downloads all tenants';
  assert (select count(*) from public.clients)=0, 'Backup has no application clients';
  assert (select count(*) from public.work_orders)=0, 'Backup has no application parts';
  begin
    update storage.objects set metadata='{"forged":true}' where name=pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png';
    get diagnostics affected = row_count;
    assert affected=0, 'Backup cannot overwrite objects';
  exception when insufficient_privilege then null; end;
  begin
    delete from storage.objects where name=pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png';
    get diagnostics affected = row_count;
    assert affected=0, 'Backup cannot delete objects';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.assert_denied('insert into storage.objects(bucket_id,name,metadata) values(''work-order-files'',''unauthorized-backup-upload'',''{}'')');
select pg_temp.assert_denied('update private.backup_storage_readers set enabled=true');
reset role;
delete from auth.sessions where id=pg_temp.fixture('session_backup');
set local role authenticated;
do $$ begin
  assert not private.is_backup_storage_reader(), 'Revoked backup session loses access immediately';
  assert not exists(select 1 from storage.objects where name=pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png'), 'Backup cannot read after session revocation';
end $$;
reset role;

set local role anon;
select pg_temp.assert_denied('select * from public.clients');
select pg_temp.assert_denied('select * from public.work_orders');
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('tech_a'),'role','authenticated','session_id',pg_temp.fixture('session_a'))::text,true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.clients)=1, 'Technician client isolation';
  assert (select count(*) from public.machines)=1, 'Technician machine isolation';
  assert (select count(*) from public.work_orders)=3, 'Own work and authorized closed history';
end $$;
select pg_temp.assert_denied('update public.work_orders set work_done=''Forged'' where id='''||pg_temp.fixture('job_a')||'''');
select pg_temp.assert_denied('select public.list_organization_members('''||pg_temp.fixture('org')||''')');
select pg_temp.assert_denied('select public.update_organization_member('''||pg_temp.fixture('org')||''','''||pg_temp.fixture('tech_a')||''',''admin'',true)');
select pg_temp.assert_denied('select public.prepare_member_invitation('''||pg_temp.fixture('org')||''',''fixture-invite@example.test'',''Fixture'',''admin'')');
select pg_temp.assert_denied('select public.complete_member_invitation(gen_random_uuid(),gen_random_uuid())');
select pg_temp.assert_denied(format('select public.create_work_order(%L,%L,%L,%L,''maintenance'',current_date,null,null,null,null,null,null,''urgent'')',pg_temp.fixture('org'),pg_temp.fixture('client_b'),pg_temp.fixture('machine_b'),pg_temp.fixture('tech_a')));
select pg_temp.assert_denied(format('select public.update_open_work_order(%L,1,%L,%L,%L,''maintenance'',current_date,null,null,''Unauthorized'',null,null,null)',pg_temp.fixture('job_b'),pg_temp.fixture('client_b'),pg_temp.fixture('machine_b'),pg_temp.fixture('tech_b')));
select public.update_open_work_order(pg_temp.fixture('job_a'),1,pg_temp.fixture('client_a'),pg_temp.fixture('machine_a'),pg_temp.fixture('tech_a'),'maintenance',current_date,null,null,'Authorized work',1,null,null);
select pg_temp.assert_denied(format('select public.close_work_order(%L,2,''maintenance'',null,''Work'',1,null,null,null,null,null)',pg_temp.fixture('job_a')),'P0001');
select public.close_work_order(pg_temp.fixture('job_a'),2,'maintenance',null,'Authorized work',1,null,null,null,null,'Client unavailable');
do $$ begin
  assert (select status='closed' and version=3 and closed_by_user_id=auth.uid() from public.work_orders where id=pg_temp.fixture('job_a')), 'Audited closure';
  assert not private.current_user_can_access_storage_path(pg_temp.fixture('org')||'/'||pg_temp.fixture('job_a')||'/signature/test.png',true), 'Closed files immutable';
end $$;
select pg_temp.assert_denied(format('select public.correct_closed_work_order(%L,3,%L,%L,%L,''maintenance'',current_date,null,null,''Changed'',1,null,null,''Test reason'')',pg_temp.fixture('job_a'),pg_temp.fixture('client_a'),pg_temp.fixture('machine_a'),pg_temp.fixture('tech_a')));
-- Validate both signature ownership and a signed closure.
select pg_temp.assert_denied(format('select public.close_work_order(%L,1,''maintenance'',null,''Work'',1,null,null,''Test signer'',%L,null)',pg_temp.fixture('job_signature'),pg_temp.fixture('org')||'/'||pg_temp.fixture('job_a')||'/signature/test.png'),'P0001');
select public.close_work_order(pg_temp.fixture('job_signature'),1,'maintenance',null,'Signed fixture',1,null,null,'Test signer',pg_temp.fixture('org')||'/'||pg_temp.fixture('job_signature')||'/signature/test.png',null);
do $$ begin
  assert (select status='closed' and signature_storage_path is not null and no_signature_reason is null from public.work_orders where id=pg_temp.fixture('job_signature')), 'Signed closure';
end $$;
-- A legitimate urgent part does not create permission for any new machine.
select public.create_work_order(pg_temp.fixture('org'),pg_temp.fixture('client_a'),pg_temp.fixture('machine_a'),pg_temp.fixture('tech_a'),'breakdown',current_date,null,null,null,null,null,null,'urgent');
do $$ begin
  assert exists(select 1 from public.work_orders where organization_id=pg_temp.fixture('org') and source='urgent' and sequence_number=5 and reference='PT-0005'), 'Urgent part uses the fixed prefix and continues the company sequence';
end $$;
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('office'),'role','authenticated','session_id',pg_temp.fixture('session_office'))::text,true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.clients)=2, 'Office reads own tenant';
  assert (select count(*) from public.organizations)=1, 'Office tenant isolation';
end $$;
select public.create_work_order(pg_temp.fixture('org'),pg_temp.fixture('client_a'),pg_temp.fixture('machine_a'),pg_temp.fixture('tech_a'),'maintenance',current_date,null,null,null,null,null,null,'office');
do $$ begin
  assert exists(select 1 from public.work_orders where organization_id=pg_temp.fixture('org') and source='office' and sequence_number=6 and reference='PT-0006'), 'Office and technician share consecutive numbering';
end $$;
select pg_temp.assert_denied('select public.list_organization_members('''||pg_temp.fixture('org')||''')');
do $$ declare v_count integer; begin
  update public.organizations set name='Unauthorized' where id=pg_temp.fixture('org');
  get diagnostics v_count=row_count; assert v_count=0, 'Office cannot configure company';
end $$;
select public.close_work_order(pg_temp.fixture('job_b'),1,'maintenance',null,'Closed by office',1,null,null,null,null,'Client unavailable');
select public.correct_closed_work_order(pg_temp.fixture('job_a'),3,pg_temp.fixture('client_a'),pg_temp.fixture('machine_a'),pg_temp.fixture('tech_a'),'maintenance',current_date,null,null,'Corrected work',1,null,null,'Correct the description');
do $$ begin
  assert (select count(*) from public.work_order_corrections where work_order_id=pg_temp.fixture('job_a'))=1, 'Correction audit';
  assert (select closed_by_user_id=pg_temp.fixture('tech_a') and no_signature_reason='Client unavailable' from public.work_orders where id=pg_temp.fixture('job_a')), 'Original closure preserved';
end $$;
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('admin'),'role','authenticated','session_id',pg_temp.fixture('session_admin'))::text,true);
set local role authenticated;
do $$ begin assert (select count(*) from public.list_organization_members(pg_temp.fixture('org')))=4, 'Admin lists own members'; end $$;
select pg_temp.assert_denied('select public.list_organization_members('''||pg_temp.fixture('other_org')||''')');
select pg_temp.assert_denied('select public.update_organization_member('''||pg_temp.fixture('org')||''','''||pg_temp.fixture('admin')||''',''office'',true)','P0001');
select pg_temp.assert_denied('select public.update_organization_member('''||pg_temp.fixture('org')||''','''||pg_temp.fixture('tech_a')||''',''technician'',false)','P0001');
select public.update_organization_member(pg_temp.fixture('org'),pg_temp.fixture('office'),'office',false);
select public.prepare_member_invitation(pg_temp.fixture('org'),'new-auth-fixture@example.test','Fixture','technician');
do $$ declare v_count integer; begin
  update public.organizations set name='Configured' where id=pg_temp.fixture('org');
  get diagnostics v_count=row_count; assert v_count=1, 'Admin configures own company';
  assert (select count(*) from public.member_access_events)=1, 'Membership audit';
end $$;
reset role;

-- A valid JWT for a disabled member no longer reads company data.
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('office'),'role','authenticated','session_id',pg_temp.fixture('session_office'))::text,true);
set local role authenticated;
do $$ begin assert (select count(*) from public.clients)=0, 'Disabled membership rejects existing token'; end $$;
reset role;
-- A signed-out session also rejects an otherwise valid, unexpired JWT.
delete from auth.sessions where id=pg_temp.fixture('session_a');
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.fixture('tech_a'),'role','authenticated','session_id',pg_temp.fixture('session_a'))::text,true);
set local role authenticated;
do $$ begin assert (select count(*) from public.clients)=0, 'Revoked session rejects existing token'; assert (select count(*) from public.profiles)=0, 'Revoked session cannot read profiles'; end $$;
reset role;
rollback;
select 'Authorization checks passed; fixtures rolled back.' as result;
