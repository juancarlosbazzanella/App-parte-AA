create index clients_created_by_user_idx
  on public.clients (organization_id, created_by_user_id);
create index machines_created_by_user_idx
  on public.machines (organization_id, created_by_user_id);
create index work_orders_machine_client_fk_idx
  on public.work_orders (organization_id, machine_id, client_id);
create index work_orders_created_by_user_idx
  on public.work_orders (organization_id, created_by_user_id);
create index work_orders_closed_by_user_idx
  on public.work_orders (organization_id, closed_by_user_id)
  where closed_by_user_id is not null;
create index work_order_photos_order_fk_idx
  on public.work_order_photos (organization_id, work_order_id);
create index work_order_corrections_order_fk_idx
  on public.work_order_corrections (organization_id, work_order_id);

drop policy work_orders_insert_office on public.work_orders;
drop policy work_orders_insert_urgent on public.work_orders;

create policy work_orders_insert_authorized
on public.work_orders for insert to authenticated
with check (
  (
    (select private.current_user_has_role(organization_id, 'office'))
    and source = 'office'
    and created_by_user_id = (select auth.uid())
    and (select private.member_has_role(
      organization_id,
      technician_user_id,
      'technician'
    ))
  )
  or
  (
    (select private.current_user_has_role(organization_id, 'technician'))
    and source = 'urgent'
    and created_by_user_id = (select auth.uid())
    and technician_user_id = (select auth.uid())
  )
);
