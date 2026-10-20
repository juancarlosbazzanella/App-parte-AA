create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.member_role as enum ('office', 'technician');
create type public.work_order_type as enum ('installation', 'maintenance', 'breakdown', 'inspection');
create type public.work_order_status as enum ('open', 'closed');
create type public.work_order_source as enum ('office', 'urgent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  timezone text not null default 'Europe/Madrid',
  work_order_prefix text not null default 'PT'
    check (work_order_prefix ~ '^[A-Z0-9]{1,8}$'),
  next_work_order_number bigint not null default 1
    check (next_work_order_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.member_role not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  email text not null check (length(btrim(email)) > 0),
  phone text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, created_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  brand text not null check (length(btrim(brand)) > 0),
  model text not null check (length(btrim(model)) > 0),
  serial_number text not null check (length(btrim(serial_number)) > 0),
  installation_address text not null check (length(btrim(installation_address)) > 0),
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, id),
  unique (organization_id, id, client_id),
  foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, created_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict
);

create unique index machines_active_serial_number_idx
  on public.machines (organization_id, lower(serial_number))
  where archived_at is null;

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sequence_number bigint not null,
  reference text not null,
  client_id uuid not null,
  machine_id uuid not null,
  technician_user_id uuid not null,
  type public.work_order_type not null,
  scheduled_date date not null,
  scheduled_time time,
  request text,
  work_done text,
  hours numeric(6, 2),
  materials text,
  observations text,
  status public.work_order_status not null default 'open',
  source public.work_order_source not null,
  created_by_user_id uuid not null,
  closed_by_user_id uuid,
  closed_at timestamptz,
  signer_name text,
  signature_storage_path text,
  no_signature_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, sequence_number),
  unique (organization_id, reference),
  foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, machine_id, client_id)
    references public.machines(organization_id, id, client_id) on delete restrict,
  foreign key (organization_id, technician_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict,
  foreign key (organization_id, created_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict,
  foreign key (organization_id, closed_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict,
  check (hours is null or (
    hours >= 0
    and hours * 4 = trunc(hours * 4)
  )),
  check (
    (status = 'open'
      and closed_by_user_id is null
      and closed_at is null
      and signer_name is null
      and signature_storage_path is null
      and no_signature_reason is null)
    or
    (status = 'closed'
      and closed_by_user_id is not null
      and closed_at is not null
      and work_done is not null
      and length(btrim(work_done)) > 0
      and (
        (signature_storage_path is not null and no_signature_reason is null)
        or
        (signature_storage_path is null
          and no_signature_reason is not null
          and length(btrim(no_signature_reason)) > 0)
      )
      and (signer_name is null or signature_storage_path is not null))
  )
);

create table public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  work_order_id uuid not null,
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  original_filename text not null check (length(btrim(original_filename)) > 0),
  mime_type text not null check (mime_type like 'image/%'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sort_order smallint not null default 0 check (sort_order >= 0),
  uploaded_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, work_order_id)
    references public.work_orders(organization_id, id) on delete cascade,
  foreign key (organization_id, uploaded_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict
);

create table public.work_order_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  work_order_id uuid not null,
  corrected_by_user_id uuid not null,
  summary text not null check (length(btrim(summary)) > 0),
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  version_before integer not null check (version_before > 0),
  version_after integer not null check (version_after > version_before),
  created_at timestamptz not null default now(),
  foreign key (organization_id, work_order_id)
    references public.work_orders(organization_id, id) on delete cascade,
  foreign key (organization_id, corrected_by_user_id)
    references public.organization_members(organization_id, user_id) on delete restrict
);

create index organization_members_user_id_idx
  on public.organization_members (user_id, organization_id)
  where is_active;
create index clients_organization_active_name_idx
  on public.clients (organization_id, lower(name))
  where archived_at is null;
create index clients_name_search_idx
  on public.clients using gin (name extensions.gin_trgm_ops);
create index machines_organization_client_idx
  on public.machines (organization_id, client_id)
  where archived_at is null;
create index machines_search_idx
  on public.machines using gin (
    (brand || ' ' || model || ' ' || serial_number || ' ' || installation_address)
    extensions.gin_trgm_ops
  );
create index work_orders_organization_status_schedule_idx
  on public.work_orders (organization_id, status, scheduled_date, scheduled_time);
create index work_orders_technician_status_schedule_idx
  on public.work_orders (
    organization_id,
    technician_user_id,
    status,
    scheduled_date,
    scheduled_time
  );
create index work_orders_machine_history_idx
  on public.work_orders (
    organization_id,
    machine_id,
    scheduled_date desc,
    scheduled_time desc
  );
create index work_orders_client_idx
  on public.work_orders (organization_id, client_id);
create index work_order_photos_order_idx
  on public.work_order_photos (work_order_id, sort_order);
create index work_order_photos_uploader_idx
  on public.work_order_photos (organization_id, uploaded_by_user_id);
create index work_order_corrections_order_idx
  on public.work_order_corrections (work_order_id, created_at);
create index work_order_corrections_user_idx
  on public.work_order_corrections (organization_id, corrected_by_user_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();
create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();
create trigger clients_set_updated_at
before update on public.clients
for each row execute function private.set_updated_at();
create trigger machines_set_updated_at
before update on public.machines
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.current_user_is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = (select auth.uid())
        and member.is_active
    );
$$;

create or replace function private.current_user_has_role(
  p_organization_id uuid,
  p_role public.member_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = (select auth.uid())
        and member.role = p_role
        and member.is_active
    );
$$;

create or replace function private.member_has_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.member_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = p_user_id
      and member.role = p_role
      and member.is_active
  );
$$;

create or replace function private.shares_organization_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members current_member
      join public.organization_members other_member
        on other_member.organization_id = current_member.organization_id
      where current_member.user_id = (select auth.uid())
        and current_member.is_active
        and other_member.user_id = p_user_id
        and other_member.is_active
    );
$$;

create or replace function private.current_user_can_view_machine(
  p_organization_id uuid,
  p_machine_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_has_role(p_organization_id, 'office')
    or (
      private.current_user_is_member(p_organization_id)
      and exists (
        select 1
        from public.work_orders work_order
        where work_order.organization_id = p_organization_id
          and work_order.machine_id = p_machine_id
          and work_order.technician_user_id = (select auth.uid())
      )
    );
$$;

create or replace function private.current_user_can_view_work_order(p_work_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_work_order_id
      and private.current_user_is_member(work_order.organization_id)
      and (
        private.current_user_has_role(work_order.organization_id, 'office')
        or work_order.technician_user_id = (select auth.uid())
        or (
          work_order.status = 'closed'
          and private.current_user_can_view_machine(
            work_order.organization_id,
            work_order.machine_id
          )
        )
      )
  );
$$;

create or replace function private.current_user_can_edit_work_order(p_work_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_work_order_id
      and (
        private.current_user_has_role(work_order.organization_id, 'office')
        or (
          work_order.status = 'open'
          and work_order.technician_user_id = (select auth.uid())
          and private.current_user_has_role(work_order.organization_id, 'technician')
        )
      )
  );
$$;

create or replace function private.current_user_can_access_storage_path(
  p_name text,
  p_write boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_work_order_id uuid;
  v_kind text;
begin
  begin
    v_organization_id := split_part(p_name, '/', 1)::uuid;
    v_work_order_id := split_part(p_name, '/', 2)::uuid;
    v_kind := split_part(p_name, '/', 3);
  exception when invalid_text_representation then
    return false;
  end;

  if v_kind not in ('photos', 'signature') then
    return false;
  end if;

  if not exists (
    select 1
    from public.work_orders work_order
    where work_order.id = v_work_order_id
      and work_order.organization_id = v_organization_id
  ) then
    return false;
  end if;

  if p_write then
    return private.current_user_can_edit_work_order(v_work_order_id);
  end if;
  return private.current_user_can_view_work_order(v_work_order_id);
end;
$$;

create or replace function private.set_work_order_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number bigint;
  v_prefix text;
begin
  if (select auth.uid()) is null
    and new.sequence_number is not null
    and new.reference is not null then
    return new;
  end if;

  update public.organizations
  set next_work_order_number = next_work_order_number + 1
  where id = new.organization_id
  returning next_work_order_number - 1, work_order_prefix
  into v_number, v_prefix;

  if not found then
    raise exception 'La empresa indicada no existe.';
  end if;

  new.sequence_number := v_number;
  new.reference := v_prefix || '-' || lpad(v_number::text, 4, '0');
  return new;
end;
$$;

create trigger work_orders_set_reference
before insert on public.work_orders
for each row execute function private.set_work_order_reference();

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
    if new.status is distinct from old.status then
      raise exception 'La oficina no puede cerrar un parte en nombre del técnico.';
    end if;
  else
    raise exception 'No tienes permiso para modificar este parte.';
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger work_orders_guard_update
before update on public.work_orders
for each row execute function private.guard_work_order_update();

create or replace function private.record_work_order_correction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary text;
  v_changed_fields text[];
begin
  if old.status <> 'closed' then
    return new;
  end if;

  v_summary := nullif(
    btrim(current_setting('climagest.correction_summary', true)),
    ''
  );
  if v_summary is null
    or not private.current_user_has_role(old.organization_id, 'office') then
    raise exception 'La corrección no dispone de una auditoría válida.';
  end if;

  v_changed_fields := array_remove(array[
    case when new.client_id is distinct from old.client_id then 'client_id' end,
    case when new.machine_id is distinct from old.machine_id then 'machine_id' end,
    case when new.technician_user_id is distinct from old.technician_user_id then 'technician_user_id' end,
    case when new.type is distinct from old.type then 'type' end,
    case when new.scheduled_date is distinct from old.scheduled_date then 'scheduled_date' end,
    case when new.scheduled_time is distinct from old.scheduled_time then 'scheduled_time' end,
    case when new.request is distinct from old.request then 'request' end,
    case when new.work_done is distinct from old.work_done then 'work_done' end,
    case when new.hours is distinct from old.hours then 'hours' end,
    case when new.materials is distinct from old.materials then 'materials' end,
    case when new.observations is distinct from old.observations then 'observations' end
  ], null);

  if cardinality(v_changed_fields) = 0 then
    v_changed_fields := array['reviewed'];
  end if;

  insert into public.work_order_corrections (
    organization_id,
    work_order_id,
    corrected_by_user_id,
    summary,
    changed_fields,
    version_before,
    version_after
  ) values (
    new.organization_id,
    new.id,
    (select auth.uid()),
    v_summary,
    v_changed_fields,
    old.version,
    new.version
  );

  return new;
end;
$$;

create trigger work_orders_record_correction
after update on public.work_orders
for each row execute function private.record_work_order_correction();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.machines enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_photos enable row level security;
alter table public.work_order_corrections enable row level security;

create policy profiles_select_shared_organization
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_organization_with(id))
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member
on public.organizations for select to authenticated
using ((select private.current_user_is_member(id)));

create policy organizations_update_office
on public.organizations for update to authenticated
using ((select private.current_user_has_role(id, 'office')))
with check ((select private.current_user_has_role(id, 'office')));

create policy organization_members_select_member
on public.organization_members for select to authenticated
using ((select private.current_user_is_member(organization_id)));

create policy clients_select_member
on public.clients for select to authenticated
using ((select private.current_user_is_member(organization_id)));

create policy clients_insert_office
on public.clients for insert to authenticated
with check (
  (select private.current_user_has_role(organization_id, 'office'))
  and created_by_user_id = (select auth.uid())
);

create policy clients_update_office
on public.clients for update to authenticated
using ((select private.current_user_has_role(organization_id, 'office')))
with check ((select private.current_user_has_role(organization_id, 'office')));

create policy machines_select_member
on public.machines for select to authenticated
using ((select private.current_user_is_member(organization_id)));

create policy machines_insert_office
on public.machines for insert to authenticated
with check (
  (select private.current_user_has_role(organization_id, 'office'))
  and created_by_user_id = (select auth.uid())
);

create policy machines_update_office
on public.machines for update to authenticated
using ((select private.current_user_has_role(organization_id, 'office')))
with check ((select private.current_user_has_role(organization_id, 'office')));

create policy work_orders_select_visible
on public.work_orders for select to authenticated
using (
  (select private.current_user_is_member(organization_id))
  and (
    (select private.current_user_has_role(organization_id, 'office'))
    or technician_user_id = (select auth.uid())
    or (
      status = 'closed'
      and (select private.current_user_can_view_machine(organization_id, machine_id))
    )
  )
);

create policy work_orders_insert_office
on public.work_orders for insert to authenticated
with check (
  (select private.current_user_has_role(organization_id, 'office'))
  and source = 'office'
  and created_by_user_id = (select auth.uid())
  and (select private.member_has_role(
    organization_id,
    technician_user_id,
    'technician'
  ))
);

create policy work_orders_insert_urgent
on public.work_orders for insert to authenticated
with check (
  (select private.current_user_has_role(organization_id, 'technician'))
  and source = 'urgent'
  and created_by_user_id = (select auth.uid())
  and technician_user_id = (select auth.uid())
);

create policy work_orders_update_office_or_assigned_technician
on public.work_orders for update to authenticated
using (
  (select private.current_user_has_role(organization_id, 'office'))
  or (
    status = 'open'
    and technician_user_id = (select auth.uid())
    and (select private.current_user_has_role(organization_id, 'technician'))
  )
)
with check (
  (select private.current_user_has_role(organization_id, 'office'))
  or (
    technician_user_id = (select auth.uid())
    and (select private.current_user_has_role(organization_id, 'technician'))
  )
);

create policy work_order_photos_select_visible
on public.work_order_photos for select to authenticated
using ((select private.current_user_can_view_work_order(work_order_id)));

create policy work_order_photos_insert_editable
on public.work_order_photos for insert to authenticated
with check (
  (select private.current_user_can_edit_work_order(work_order_id))
  and uploaded_by_user_id = (select auth.uid())
);

create policy work_order_photos_update_editable
on public.work_order_photos for update to authenticated
using ((select private.current_user_can_edit_work_order(work_order_id)))
with check ((select private.current_user_can_edit_work_order(work_order_id)));

create policy work_order_photos_delete_editable
on public.work_order_photos for delete to authenticated
using ((select private.current_user_can_edit_work_order(work_order_id)));

create policy work_order_corrections_select_visible
on public.work_order_corrections for select to authenticated
using ((select private.current_user_can_view_work_order(work_order_id)));

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
returns public.work_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión.';
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
returns public.work_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
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
returns public.work_orders
language plpgsql
security invoker
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
    and technician_user_id = (select auth.uid())
    and version = p_expected_version
  returning * into v_work_order;

  if not found then
    raise exception 'El parte cambió en otro dispositivo, no está abierto o no te pertenece.';
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
returns public.work_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work_order public.work_orders;
begin
  if nullif(btrim(p_summary), '') is null then
    raise exception 'La corrección necesita un resumen.';
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

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant select on public.profiles,
  public.organizations,
  public.organization_members,
  public.clients,
  public.machines,
  public.work_orders,
  public.work_order_photos,
  public.work_order_corrections
to authenticated;
grant update on public.profiles, public.organizations to authenticated;
grant insert, update on public.clients, public.machines to authenticated;
grant insert, update on public.work_orders to authenticated;
grant insert, update, delete on public.work_order_photos to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema private to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'work-order-files',
  'work-order-files',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy work_order_files_select
on storage.objects for select to authenticated
using (
  bucket_id = 'work-order-files'
  and (select private.current_user_can_access_storage_path(name, false))
);

create policy work_order_files_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-order-files'
  and (select private.current_user_can_access_storage_path(name, true))
);

create policy work_order_files_update
on storage.objects for update to authenticated
using (
  bucket_id = 'work-order-files'
  and (select private.current_user_can_access_storage_path(name, true))
)
with check (
  bucket_id = 'work-order-files'
  and (select private.current_user_can_access_storage_path(name, true))
);

create policy work_order_files_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-order-files'
  and (select private.current_user_can_access_storage_path(name, true))
);

alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.machines;
alter publication supabase_realtime add table public.work_orders;
alter publication supabase_realtime add table public.work_order_photos;
alter publication supabase_realtime add table public.work_order_corrections;
