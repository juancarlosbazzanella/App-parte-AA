-- Business roles are read from active database memberships, never user metadata.
create or replace function private.current_user_has_role(p_organization_id uuid, p_role public.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = (select auth.uid())
      and m.is_active and (m.role = p_role or (p_role = 'office' and m.role = 'admin'))
  );
$$;

create or replace function private.current_user_can_view_machine(p_organization_id uuid, p_machine_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_has_role(p_organization_id, 'office') or (
    private.current_user_has_role(p_organization_id, 'technician') and exists (
      select 1 from public.work_orders w where w.organization_id = p_organization_id
        and w.machine_id = p_machine_id and w.technician_user_id = (select auth.uid())
        and w.source = 'office'
    )
  );
$$;

create or replace function private.current_user_can_edit_work_order(p_work_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.work_orders w where w.id = p_work_order_id and w.status = 'open'
    and (private.current_user_has_role(w.organization_id, 'office') or (
      w.technician_user_id = (select auth.uid()) and private.current_user_has_role(w.organization_id, 'technician')
    )));
$$;

drop policy organizations_update_office on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
using ((select private.current_user_has_role(id, 'admin')))
with check ((select private.current_user_has_role(id, 'admin')));

drop policy clients_select_member on public.clients;
create policy clients_select_visible on public.clients for select to authenticated using (
  (select private.current_user_has_role(organization_id, 'office')) or exists (
    select 1 from public.machines m where m.client_id = clients.id and m.organization_id = clients.organization_id
      and (select private.current_user_can_view_machine(m.organization_id, m.id))
  )
);
drop policy machines_select_member on public.machines;
create policy machines_select_visible on public.machines for select to authenticated
using ((select private.current_user_can_view_machine(organization_id, id)));

revoke update on public.organizations, public.profiles, public.clients, public.machines from authenticated;
grant update (name, timezone, work_order_prefix) on public.organizations to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, email, phone, archived_at) on public.clients to authenticated;
grant update (client_id, brand, model, serial_number, installation_address, archived_at) on public.machines to authenticated;

-- All writes to work orders go through checked, transactional operations.
revoke insert, update, delete on public.work_orders from authenticated;
drop policy work_orders_insert_authorized on public.work_orders;
drop policy work_orders_update_office_or_assigned_technician on public.work_orders;

-- Private signatures and photographs cannot be replaced after closure.
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'work-order-files';

create table public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  role public.member_role not null,
  invited_by uuid not null references auth.users(id),
  user_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index member_invitations_invited_by_idx on public.member_invitations(invited_by);
create index member_invitations_user_id_idx on public.member_invitations(user_id);
alter table public.member_invitations enable row level security;
revoke all on public.member_invitations from anon, authenticated;
grant select on public.member_invitations to authenticated;
grant all on public.member_invitations to service_role;
create policy member_invitations_select_admin on public.member_invitations for select to authenticated
using ((select private.current_user_has_role(organization_id, 'admin')));

create table public.member_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  old_role public.member_role,
  new_role public.member_role not null,
  old_active boolean,
  new_active boolean not null,
  created_at timestamptz not null default now()
);
create index member_access_events_org_idx on public.member_access_events(organization_id, created_at);
create index member_access_events_actor_idx on public.member_access_events(actor_id);
create index member_access_events_user_idx on public.member_access_events(user_id);
alter table public.member_access_events enable row level security;
revoke all on public.member_access_events from anon, authenticated;
grant select on public.member_access_events to authenticated;
create policy member_access_events_select_admin on public.member_access_events for select to authenticated
using ((select private.current_user_has_role(organization_id, 'admin')));

create function private.list_organization_members(p_organization_id uuid)
returns table(user_id uuid, full_name text, email text, role public.member_role, is_active boolean, invitation_pending boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.current_user_has_role(p_organization_id, 'admin') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;
  return query select m.user_id, p.full_name, u.email::text, m.role, m.is_active,
    (u.invited_at is not null and u.last_sign_in_at is null)
  from public.organization_members m join public.profiles p on p.id=m.user_id
    join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id order by p.full_name;
end;
$$;
create function public.list_organization_members(p_organization_id uuid)
returns table(user_id uuid, full_name text, email text, role public.member_role, is_active boolean, invitation_pending boolean)
language sql security invoker set search_path = '' as $$ select * from private.list_organization_members(p_organization_id); $$;

create function private.update_organization_member(p_organization_id uuid, p_user_id uuid, p_role public.member_role, p_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.organization_members;
begin
  -- Serialize changes, including simultaneous attempts to remove the last admin.
  perform 1 from public.organizations where id=p_organization_id for update;
  if not private.current_user_has_role(p_organization_id, 'admin') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;
  if p_role is null or p_is_active is null then raise exception 'Indica un rol y un estado válidos.'; end if;
  select * into strict v_old from public.organization_members where organization_id=p_organization_id and user_id=p_user_id for update;
  if v_old.role='admin' and v_old.is_active and (p_role<>'admin' or not p_is_active)
    and not exists (select 1 from public.organization_members where organization_id=p_organization_id
      and user_id<>p_user_id and role='admin' and is_active) then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  if v_old.role='technician' and (p_role<>'technician' or not p_is_active) and exists (
    select 1 from public.work_orders where organization_id=p_organization_id and technician_user_id=p_user_id and status='open'
  ) then raise exception 'Reasigna primero los partes abiertos de este técnico.'; end if;
  update public.organization_members set role=p_role, is_active=p_is_active where organization_id=p_organization_id and user_id=p_user_id;
  insert into public.member_access_events(organization_id, actor_id, user_id, old_role, new_role, old_active, new_active)
  values(p_organization_id, auth.uid(), p_user_id, v_old.role, p_role, v_old.is_active, p_is_active);
end;
$$;
create function public.update_organization_member(p_organization_id uuid, p_user_id uuid, p_role public.member_role, p_is_active boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.update_organization_member(p_organization_id, p_user_id, p_role, p_is_active);
$$;

create function private.prepare_member_invitation(p_organization_id uuid, p_email text, p_full_name text, p_role public.member_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := lower(btrim(p_email));
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  if not private.current_user_has_role(p_organization_id, 'admin') then
    raise exception 'No tienes permiso para invitar usuarios.' using errcode='42501';
  end if;
  if p_role is null or nullif(btrim(p_full_name),'') is null then raise exception 'Completa los datos de la invitación.'; end if;
  if exists (select 1 from auth.users u join public.organization_members m on m.user_id=u.id
    where lower(u.email)=v_email and m.organization_id=p_organization_id) then
    raise exception 'Esta cuenta ya pertenece a la empresa. Gestiona su acceso en Usuarios.';
  end if;
  if exists (select 1 from public.member_invitations where organization_id=p_organization_id and email=v_email
    and updated_at > now()-interval '60 seconds') then raise exception 'Espera un minuto antes de volver a invitar este correo.'; end if;
  if (select count(*) from public.member_invitations where invited_by=auth.uid() and created_at > now()-interval '1 hour') >= 20 then
    raise exception 'Se ha alcanzado el límite de invitaciones. Inténtalo más tarde.';
  end if;
  insert into public.member_invitations(organization_id,email,full_name,role,invited_by)
  values(p_organization_id,v_email,btrim(p_full_name),p_role,auth.uid())
  on conflict(organization_id,email) do update set full_name=excluded.full_name,role=excluded.role,
    invited_by=excluded.invited_by,status='pending',updated_at=now() returning id into v_id;
  return v_id;
end;
$$;
create function public.prepare_member_invitation(p_organization_id uuid, p_email text, p_full_name text, p_role public.member_role)
returns uuid language sql security invoker set search_path='' as $$
  select private.prepare_member_invitation(p_organization_id,p_email,p_full_name,p_role);
$$;

-- Called only by the Edge Function with its server-side service credential.
create function private.complete_member_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_inv public.member_invitations;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Acceso denegado.' using errcode='42501'; end if;
  select * into strict v_inv from public.member_invitations where id=p_invitation_id for update;
  perform 1 from public.organizations where id=v_inv.organization_id for update;
  if not private.member_has_role(v_inv.organization_id,v_inv.invited_by,'admin') then raise exception 'La invitación ya no está autorizada.'; end if;
  if not exists(select 1 from auth.users where id=p_user_id and lower(email)=v_inv.email and invited_at is not null) then
    raise exception 'La cuenta no coincide con la invitación.';
  end if;
  insert into public.organization_members(organization_id,user_id,role,is_active)
  values(v_inv.organization_id,p_user_id,v_inv.role,true);
  update public.profiles set full_name=v_inv.full_name where id=p_user_id;
  update public.member_invitations set user_id=p_user_id,status='sent',updated_at=now() where id=p_invitation_id;
  insert into public.member_access_events(organization_id,actor_id,user_id,new_role,new_active)
  values(v_inv.organization_id,v_inv.invited_by,p_user_id,v_inv.role,true);
end;
$$;
create function public.complete_member_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path='' as $$ select private.complete_member_invitation(p_invitation_id,p_user_id); $$;

-- Deactivate shared demo logins, preserving their records and attribution.
update public.organization_members m set is_active=false
from auth.users u where u.id=m.user_id and lower(u.email) like '%@climagest.demo';

-- Realtime also invalidates UI permissions after member/configuration changes.
alter publication supabase_realtime add table public.organization_members, public.organizations;


create or replace function private.guard_work_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_office boolean;
  v_is_technician boolean;
  v_summary text;
begin
  if v_user_id is null then
    new.updated_at := coalesce(new.updated_at, now());
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.sequence_number is distinct from old.sequence_number
    or new.reference is distinct from old.reference
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'No se pueden modificar los identificadores ni la autoría del parte.';
  end if;

  v_is_office := private.current_user_has_role(old.organization_id, 'office');
  v_is_technician := private.current_user_has_role(old.organization_id, 'technician');

  if old.status = 'closed' then
    v_summary := nullif(
      btrim(current_setting('climagest.correction_summary', true)),
      ''
    );
    if not v_is_office or v_summary is null then
      raise exception 'Los partes cerrados solo se corrigen mediante la operación de corrección.';
    end if;
    if new.status is distinct from old.status
      or new.closed_by_user_id is distinct from old.closed_by_user_id
      or new.closed_at is distinct from old.closed_at
      or new.signer_name is distinct from old.signer_name
      or new.signature_storage_path is distinct from old.signature_storage_path
      or new.no_signature_reason is distinct from old.no_signature_reason then
      raise exception 'Los datos originales de cierre y firma son inmutables.';
    end if;
  elsif v_is_technician then
    if old.technician_user_id is distinct from v_user_id
      or new.technician_user_id is distinct from v_user_id
      or new.organization_id is distinct from old.organization_id
      or new.client_id is distinct from old.client_id
      or new.machine_id is distinct from old.machine_id
      or new.scheduled_date is distinct from old.scheduled_date
      or new.scheduled_time is distinct from old.scheduled_time
      or new.source is distinct from old.source then
      raise exception 'El técnico no puede cambiar la planificación ni la asignación.';
    end if;
    if new.status = 'closed' and new.closed_by_user_id is distinct from v_user_id then
      raise exception 'El cierre debe quedar atribuido al técnico autenticado.';
    end if;
  elsif v_is_office then
    null;
  else
    raise exception 'No tienes permiso para modificar este parte.';
  end if;

  if old.status = 'open' and new.status = 'closed' then
    if current_setting('climagest.operation', true) is distinct from 'close'
      or new.closed_by_user_id is distinct from v_user_id then
      raise exception 'El cierre debe realizarse mediante la operación autorizada.';
    end if;
  end if;
  if new.technician_user_id is distinct from old.technician_user_id and not
    private.member_has_role(old.organization_id, new.technician_user_id, 'technician') then
    raise exception 'Selecciona un técnico activo de la empresa.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.create_work_order(
  p_organization_id uuid,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_source public.work_order_source
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if not (private.current_user_has_role(p_organization_id, 'office') and p_source='office')
    and not (private.current_user_has_role(p_organization_id, 'technician') and p_source='urgent'
      and p_technician_user_id=auth.uid() and private.current_user_can_view_machine(p_organization_id,p_machine_id)) then
    raise exception 'No tienes permiso para crear este parte.' using errcode='42501';
  end if;
  if not private.member_has_role(p_organization_id,p_technician_user_id,'technician') then
    raise exception 'Selecciona un técnico activo de la empresa.';
  end if;
  if not exists(select 1 from public.machines m join public.clients c on c.id=m.client_id
    and c.organization_id=m.organization_id where m.id=p_machine_id and m.client_id=p_client_id
    and m.organization_id=p_organization_id and m.archived_at is null and c.archived_at is null) then
    raise exception 'La máquina o el cliente no están disponibles.';
  end if;

  insert into public.work_orders (
    organization_id,
    sequence_number,
    reference,
    client_id,
    machine_id,
    technician_user_id,
    type,
    scheduled_date,
    scheduled_time,
    request,
    work_done,
    hours,
    materials,
    observations,
    status,
    source,
    created_by_user_id
  ) values (
    p_organization_id,
    0,
    'PENDING',
    p_client_id,
    p_machine_id,
    p_technician_user_id,
    p_type,
    p_scheduled_date,
    p_scheduled_time,
    nullif(btrim(p_request), ''),
    nullif(btrim(p_work_done), ''),
    p_hours,
    nullif(btrim(p_materials), ''),
    nullif(btrim(p_observations), ''),
    'open',
    p_source,
    (select auth.uid())
  )
  returning * into v_work_order;

  return v_work_order;
end;
$$;

create or replace function public.create_work_order(
  p_organization_id uuid,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_source public.work_order_source
)
returns public.work_orders language sql security invoker set search_path = '' as $$
  select private.create_work_order(p_organization_id, p_client_id, p_machine_id, p_technician_user_id, p_type, p_scheduled_date, p_scheduled_time, p_request, p_work_done, p_hours, p_materials, p_observations, p_source);
$$;

create or replace function private.update_open_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  select * into v_work_order from public.work_orders where id=p_work_order_id for update;
  if not found or not private.current_user_can_edit_work_order(p_work_order_id) then
    raise exception 'No tienes permiso para modificar este parte.' using errcode='42501';
  end if;

  update public.work_orders
  set client_id = p_client_id,
      machine_id = p_machine_id,
      technician_user_id = p_technician_user_id,
      type = p_type,
      scheduled_date = p_scheduled_date,
      scheduled_time = p_scheduled_time,
      request = nullif(btrim(p_request), ''),
      work_done = nullif(btrim(p_work_done), ''),
      hours = p_hours,
      materials = nullif(btrim(p_materials), ''),
      observations = nullif(btrim(p_observations), '')
  where id = p_work_order_id
    and status = 'open'
    and version = p_expected_version
  returning * into v_work_order;

  if not found then
    raise exception 'El parte cambió en otro dispositivo o ya no está abierto.';
  end if;
  return v_work_order;
end;
$$;

create or replace function public.update_open_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text
)
returns public.work_orders language sql security invoker set search_path = '' as $$
  select private.update_open_work_order(p_work_order_id, p_expected_version, p_client_id, p_machine_id, p_technician_user_id, p_type, p_scheduled_date, p_scheduled_time, p_request, p_work_done, p_hours, p_materials, p_observations);
$$;

create or replace function private.close_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_type public.work_order_type,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_signer_name text,
  p_signature_storage_path text,
  p_no_signature_reason text
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  if nullif(btrim(p_work_done), '') is null then
    raise exception 'Debes indicar el trabajo realizado.';
  end if;
  if (nullif(btrim(p_signature_storage_path), '') is null)
    = (nullif(btrim(p_no_signature_reason), '') is null) then
    raise exception 'Indica una firma o un motivo de cierre sin firma.';
  end if;

  select * into v_work_order from public.work_orders where id=p_work_order_id for update;
  if not found or not private.current_user_can_edit_work_order(p_work_order_id) then
    raise exception 'No tienes permiso para modificar este parte.' using errcode='42501';
  end if;
  if nullif(btrim(p_signature_storage_path),'') is not null and not exists (
    select 1 from storage.objects o where o.bucket_id='work-order-files'
      and o.name=p_signature_storage_path
      and o.name like v_work_order.organization_id::text || '/' || v_work_order.id::text || '/signature/%'
  ) then raise exception 'La firma no corresponde a este parte.'; end if;
  perform set_config('climagest.operation','close',true);

  update public.work_orders
  set type = p_type,
      request = nullif(btrim(p_request), ''),
      work_done = nullif(btrim(p_work_done), ''),
      hours = p_hours,
      materials = nullif(btrim(p_materials), ''),
      observations = nullif(btrim(p_observations), ''),
      status = 'closed',
      closed_by_user_id = (select auth.uid()),
      closed_at = now(),
      signer_name = case
        when nullif(btrim(p_signature_storage_path), '') is null then null
        else nullif(btrim(p_signer_name), '')
      end,
      signature_storage_path = nullif(btrim(p_signature_storage_path), ''),
      no_signature_reason = nullif(btrim(p_no_signature_reason), '')
  where id = p_work_order_id
    and status = 'open'
    and version = p_expected_version
  returning * into v_work_order;

  if not found then
    raise exception 'El parte cambió en otro dispositivo, no está abierto o no te pertenece.';
  end if;
  return v_work_order;
end;
$$;

create or replace function public.close_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_type public.work_order_type,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_signer_name text,
  p_signature_storage_path text,
  p_no_signature_reason text
)
returns public.work_orders language sql security invoker set search_path = '' as $$
  select private.close_work_order(p_work_order_id, p_expected_version, p_type, p_request, p_work_done, p_hours, p_materials, p_observations, p_signer_name, p_signature_storage_path, p_no_signature_reason);
$$;

create or replace function private.correct_closed_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_summary text
)
returns public.work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  if nullif(btrim(p_summary), '') is null then
    raise exception 'La corrección necesita un resumen.';
  end if;

  select * into v_work_order from public.work_orders where id=p_work_order_id for update;
  if not found or not private.current_user_has_role(v_work_order.organization_id,'office') then
    raise exception 'No tienes permiso para corregir este parte.' using errcode='42501';
  end if;

  perform set_config('climagest.correction_summary', btrim(p_summary), true);

  update public.work_orders
  set client_id = p_client_id,
      machine_id = p_machine_id,
      technician_user_id = p_technician_user_id,
      type = p_type,
      scheduled_date = p_scheduled_date,
      scheduled_time = p_scheduled_time,
      request = nullif(btrim(p_request), ''),
      work_done = nullif(btrim(p_work_done), ''),
      hours = p_hours,
      materials = nullif(btrim(p_materials), ''),
      observations = nullif(btrim(p_observations), '')
  where id = p_work_order_id
    and status = 'closed'
    and version = p_expected_version
  returning * into v_work_order;

  if not found then
    raise exception 'El parte cambió en otro dispositivo o ya no puede corregirse.';
  end if;
  return v_work_order;
end;
$$;

create or replace function public.correct_closed_work_order(
  p_work_order_id uuid,
  p_expected_version integer,
  p_client_id uuid,
  p_machine_id uuid,
  p_technician_user_id uuid,
  p_type public.work_order_type,
  p_scheduled_date date,
  p_scheduled_time time,
  p_request text,
  p_work_done text,
  p_hours numeric,
  p_materials text,
  p_observations text,
  p_summary text
)
returns public.work_orders language sql security invoker set search_path = '' as $$
  select private.correct_closed_work_order(p_work_order_id, p_expected_version, p_client_id, p_machine_id, p_technician_user_id, p_type, p_scheduled_date, p_scheduled_time, p_request, p_work_done, p_hours, p_materials, p_observations, p_summary);
$$;

-- Remove the historical blanket function grants and expose only reviewed entry points.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;


grant execute on function public.create_work_order(uuid, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text, public.work_order_source) to authenticated;

grant execute on function public.update_open_work_order(uuid, integer, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text) to authenticated;

grant execute on function public.close_work_order(uuid, integer, public.work_order_type, text, text, numeric, text, text, text, text, text) to authenticated;

grant execute on function public.correct_closed_work_order(uuid, integer, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text, text) to authenticated;

grant execute on function public.list_organization_members(uuid) to authenticated;

grant execute on function public.update_organization_member(uuid, uuid, public.member_role, boolean) to authenticated;

grant execute on function public.prepare_member_invitation(uuid, text, text, public.member_role) to authenticated;

grant execute on function private.create_work_order(uuid, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text, public.work_order_source) to authenticated;

grant execute on function private.update_open_work_order(uuid, integer, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text) to authenticated;

grant execute on function private.close_work_order(uuid, integer, public.work_order_type, text, text, numeric, text, text, text, text, text) to authenticated;

grant execute on function private.correct_closed_work_order(uuid, integer, uuid, uuid, uuid, public.work_order_type, date, time, text, text, numeric, text, text, text) to authenticated;

grant execute on function private.list_organization_members(uuid) to authenticated;

grant execute on function private.update_organization_member(uuid, uuid, public.member_role, boolean) to authenticated;

grant execute on function private.prepare_member_invitation(uuid, text, text, public.member_role) to authenticated;

grant execute on function private.current_user_is_member(uuid) to authenticated;

grant execute on function private.current_user_has_role(uuid, public.member_role) to authenticated;

grant execute on function private.member_has_role(uuid, uuid, public.member_role) to authenticated;

grant execute on function private.shares_organization_with(uuid) to authenticated;

grant execute on function private.current_user_can_view_machine(uuid, uuid) to authenticated;

grant execute on function private.current_user_can_view_work_order(uuid) to authenticated;

grant execute on function private.current_user_can_edit_work_order(uuid) to authenticated;

grant execute on function private.current_user_can_access_storage_path(text, boolean) to authenticated;

grant execute on function public.complete_member_invitation(uuid,uuid), private.complete_member_invitation(uuid,uuid) to service_role;
