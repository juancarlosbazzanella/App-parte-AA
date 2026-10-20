begin;

-- Follow the INSERT -> organization-counter lock order used when creating a part.
lock table public.work_orders, public.organizations in share row exclusive mode;

-- Keep historical references and never rewind a number that has already been used.
update public.organizations as organization
set work_order_prefix = 'PT',
    next_work_order_number = greatest(
      organization.next_work_order_number,
      coalesce((
        select max(work_order.sequence_number)
        from public.work_orders as work_order
        where work_order.organization_id = organization.id
      ), 0) + 1
    );

alter table public.organizations
  alter column work_order_prefix set default 'PT',
  add constraint organizations_fixed_work_order_prefix
    check (work_order_prefix = 'PT');

revoke update (work_order_prefix) on public.organizations from authenticated;

create or replace function private.set_work_order_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number bigint;
begin
  -- The row update serializes allocations within the same company and rolls
  -- back with a failed INSERT; office parts and urgent parts use this trigger.
  update public.organizations
  set next_work_order_number = next_work_order_number + 1
  where id = new.organization_id
  returning next_work_order_number - 1 into v_number;

  if not found then
    raise exception 'La empresa indicada no existe.';
  end if;

  new.sequence_number := v_number;
  -- lpad would truncate numbers longer than its requested width.
  new.reference := 'PT-' || lpad(v_number::text, greatest(4, length(v_number::text)), '0');
  return new;
end;
$$;

commit;
