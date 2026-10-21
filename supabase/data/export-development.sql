-- READ ONLY. Produces sanitized JSON directly in the source database.
-- Never exports auth credentials, tokens, contact data, free text, or media.
with salt as materialized (select gen_random_uuid()::text as value)
select jsonb_build_object(
  'format', 1,
  'users', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || u.id::text)::uuid,
    'email', 'usuario-' || u.n || '@dev.climagest.invalid',
    'full_name', 'Usuario de prueba ' || u.n,
    'disabled', u.banned_until > now()
  )), '[]') from (select id, banned_until, row_number() over(order by id) n from auth.users) u),
  'organizations', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || o.id::text)::uuid,
    'name', 'ClimaGest Desarrollo', 'timezone', 'Europe/Madrid',
    'work_order_prefix', 'PT', 'next_work_order_number', o.next_work_order_number
  )), '[]') from public.organizations o),
  'organization_members', (select coalesce(jsonb_agg(jsonb_build_object(
    'organization_id', md5(s.value || m.organization_id::text)::uuid,
    'user_id', md5(s.value || m.user_id::text)::uuid,
    'role', m.role, 'is_active', m.is_active
  )), '[]') from public.organization_members m),
  'clients', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || c.id::text)::uuid,
    'organization_id', md5(s.value || c.organization_id::text)::uuid,
    'name', 'Cliente de prueba ' || c.n, 'email', 'cliente-' || c.n || '@example.invalid',
    'phone', null, 'created_by_user_id', md5(s.value || c.created_by_user_id::text)::uuid,
    'archived_at', case when c.archived_at is not null then now() end
  )), '[]') from (select *, row_number() over(order by id) n from public.clients) c),
  'machines', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || m.id::text)::uuid,
    'organization_id', md5(s.value || m.organization_id::text)::uuid,
    'client_id', md5(s.value || m.client_id::text)::uuid,
    'brand', 'Marca de prueba', 'model', 'Modelo de prueba ' || m.n,
    'serial_number', 'DEV-' || m.n, 'installation_address', 'Dirección ficticia ' || m.n,
    'created_by_user_id', md5(s.value || m.created_by_user_id::text)::uuid,
    'archived_at', case when m.archived_at is not null then now() end
  )), '[]') from (select *, row_number() over(order by id) n from public.machines) m),
  'work_orders', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || w.id::text)::uuid,
    'organization_id', md5(s.value || w.organization_id::text)::uuid,
    'client_id', md5(s.value || w.client_id::text)::uuid,
    'machine_id', md5(s.value || w.machine_id::text)::uuid,
    'technician_user_id', md5(s.value || w.technician_user_id::text)::uuid,
    'created_by_user_id', md5(s.value || w.created_by_user_id::text)::uuid,
    'closed_by_user_id', case when w.closed_by_user_id is not null then md5(s.value || w.closed_by_user_id::text)::uuid end,
    'sequence_number', w.sequence_number, 'reference', 'PT-' || lpad(w.sequence_number::text, greatest(4,length(w.sequence_number::text)), '0'),
    'type', w.type, 'status', w.status, 'source', w.source,
    'scheduled_date', current_date + (w.n::integer % 15) - 7,
    'scheduled_time', '09:00:00', 'request', 'Solicitud ficticia para pruebas',
    'work_done', case when w.status='closed' then 'Trabajo ficticio completado' end,
    'hours', case when w.status='closed' then 1 end,
    'materials', null, 'observations', null,
    'closed_at', case when w.status='closed' then now() end,
    'signer_name', null, 'signature_storage_path', null,
    'no_signature_reason', case when w.status='closed' then 'Copia de desarrollo: firma y datos personales omitidos' end,
    'version', w.version
  )), '[]') from (select *, row_number() over(order by id) n from public.work_orders) w),
  'work_order_corrections', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', md5(s.value || c.id::text)::uuid,
    'organization_id', md5(s.value || c.organization_id::text)::uuid,
    'work_order_id', md5(s.value || c.work_order_id::text)::uuid,
    'corrected_by_user_id', md5(s.value || c.corrected_by_user_id::text)::uuid,
    'summary', 'Corrección ficticia para pruebas',
    'changed_fields', array['observations'], 'version_before', c.version_before, 'version_after', c.version_after
  )), '[]') from public.work_order_corrections c)
) as snapshot from salt s;
