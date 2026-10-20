insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'oficina@climagest.demo',
    extensions.crypt('demo1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Oficina"}'::jsonb,
    now(), now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'alvaro@climagest.demo',
    extensions.crypt('demo1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Álvaro"}'::jsonb,
    now(), now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'lucia@climagest.demo',
    extensions.crypt('demo1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Lucía"}'::jsonb,
    now(), now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'marcos@climagest.demo',
    extensions.crypt('demo1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Marcos"}'::jsonb,
    now(), now(), false, false
  );

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '21000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '{"sub":"20000000-0000-4000-8000-000000000001","email":"oficina@climagest.demo","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '{"sub":"20000000-0000-4000-8000-000000000002","email":"alvaro@climagest.demo","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    '{"sub":"20000000-0000-4000-8000-000000000003","email":"lucia@climagest.demo","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '21000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    '{"sub":"20000000-0000-4000-8000-000000000004","email":"marcos@climagest.demo","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  );

insert into public.organizations (
  id,
  name,
  timezone,
  work_order_prefix,
  next_work_order_number
)
values (
  '10000000-0000-4000-8000-000000000001',
  'ClimaGest Demo',
  'Europe/Madrid',
  'PT',
  1017
);

insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'office'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'technician'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'technician'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'technician');

insert into public.clients (
  id,
  organization_id,
  name,
  email,
  phone,
  created_by_user_id
)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Restaurante El Olivo', 'gerencia@elolivo.demo', '910 245 618', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Clínica Santa Marta', 'administracion@santamarta.demo', '916 324 110', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Oficinas Norte', 'mantenimiento@oficinasnorte.demo', '915 887 201', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Comunidad El Mirador', 'presidencia@elmirador.demo', '620 348 512', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Carmen Ruiz', 'carmen.ruiz@example.com', '687 553 942', '20000000-0000-4000-8000-000000000001');

insert into public.machines (
  id,
  organization_id,
  client_id,
  brand,
  model,
  serial_number,
  installation_address,
  created_by_user_id
)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Daikin', 'Sky Air', 'DK-SKY-008214', 'C/ Mayor, 18 · Madrid · Salón', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Mitsubishi Electric', 'Mr. Slim', 'ME-44720-C', 'C/ Mayor, 18 · Madrid · Cocina', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Mitsubishi Electric', 'MSZ-AP35VGK', 'ME-AP-193882', 'Av. de Europa, 41 · Getafe · Consulta 3', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'Fujitsu', 'ASY 35 UI-KP', 'FJ-35-77419', 'P.º de la Castellana, 122 · Madrid · Planta 4', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'Daikin', 'VRV IV', 'DK-VRV-44091', 'P.º de la Castellana, 122 · Madrid · Planta 6', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'Panasonic', 'KIT-Z35-XKE', 'PN-Z35-7721', 'C/ del Lago, 7 · Leganés · Portería', '20000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'LG', 'DualCool 12', 'LG-DC-09218', 'C/ Olmo, 23 · Alcorcón · Salón', '20000000-0000-4000-8000-000000000001');

insert into public.work_orders (
  id,
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
  created_by_user_id,
  closed_by_user_id,
  closed_at,
  signer_name,
  signature_storage_path,
  no_signature_reason,
  version,
  created_at,
  updated_at
)
values
  ('50000000-0000-4000-8000-000000001012', '10000000-0000-4000-8000-000000000001', 1012, 'PT-1012', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'breakdown', current_date, '09:30', 'El equipo enfría poco y hace ruido al arrancar.', null, null, null, null, 'open', 'office', '20000000-0000-4000-8000-000000000001', null, null, null, null, null, 1, now() - interval '1 day', now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000001013', '10000000-0000-4000-8000-000000000001', 1013, 'PT-1013', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'maintenance', current_date, '12:00', 'Mantenimiento trimestral acordado.', null, null, null, null, 'open', 'office', '20000000-0000-4000-8000-000000000001', null, null, null, null, null, 1, now() - interval '2 days', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000001014', '10000000-0000-4000-8000-000000000001', 1014, 'PT-1014', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'inspection', current_date, null, 'Revisar rendimiento antes de la campaña de otoño.', null, null, null, null, 'open', 'office', '20000000-0000-4000-8000-000000000001', null, null, null, null, null, 1, now() - interval '3 days', now() - interval '3 days'),
  ('50000000-0000-4000-8000-000000001015', '10000000-0000-4000-8000-000000000001', 1015, 'PT-1015', '30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'installation', current_date, '08:00', 'Instalación del nuevo equipo en portería.', null, null, null, null, 'open', 'office', '20000000-0000-4000-8000-000000000001', null, null, null, null, null, 1, now() - interval '5 days', now() - interval '5 days'),
  ('50000000-0000-4000-8000-000000001016', '10000000-0000-4000-8000-000000000001', 1016, 'PT-1016', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 'maintenance', current_date + 1, '10:30', 'Limpieza de filtros y comprobación general.', null, null, null, null, 'open', 'office', '20000000-0000-4000-8000-000000000001', null, null, null, null, null, 1, now() - interval '2 days', now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000001008', '10000000-0000-4000-8000-000000000001', 1008, 'PT-1008', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'maintenance', current_date - 94, '11:00', 'Mantenimiento de temporada.', 'Limpieza completa de filtros, batería interior y desagüe. Comprobación de presiones y temperatura de impulsión.', 1.50, 'Limpiador de baterías y pastilla de desagüe', 'Equipo funcionando correctamente.', 'closed', 'office', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', now() - interval '94 days', 'Mario García', '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000001008/signature/61000000-0000-4000-8000-000000001008.svg', null, 1, now() - interval '100 days', now() - interval '94 days'),
  ('50000000-0000-4000-8000-000000001004', '10000000-0000-4000-8000-000000000001', 1004, 'PT-1004', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'breakdown', current_date - 241, null, null, 'Sustitución del condensador de arranque y prueba del equipo durante 25 minutos.', 2.00, 'Condensador 35 µF', 'Se recomienda revisar de nuevo antes del verano.', 'closed', 'urgent', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', now() - interval '241 days', null, null, 'El responsable del local no se encontraba presente al finalizar.', 1, now() - interval '241 days', now() - interval '241 days'),
  ('50000000-0000-4000-8000-000000000998', '10000000-0000-4000-8000-000000000001', 998, 'PT-0998', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'inspection', current_date - 370, null, null, 'Revisión de conexiones, presión y temperatura. No se detectan fugas.', 1.00, null, null, 'closed', 'office', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', now() - interval '370 days', 'Elena Pastor', '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000998/signature/61000000-0000-4000-8000-000000000998.svg', null, 2, now() - interval '375 days', now() - interval '369 days'),
  ('50000000-0000-4000-8000-000000000982', '10000000-0000-4000-8000-000000000001', 982, 'PT-0982', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'installation', current_date - 722, null, null, 'Instalación, conexión y puesta en marcha del equipo. Explicación básica de uso al responsable de planta.', 4.50, '4 m de tubería, canaleta, soportes y desagüe', 'Acceso a la unidad exterior desde la terraza técnica.', 'closed', 'office', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', now() - interval '722 days', 'Rafael León', '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000982/signature/61000000-0000-4000-8000-000000000982.svg', null, 1, now() - interval '730 days', now() - interval '722 days'),
  ('50000000-0000-4000-8000-000000000970', '10000000-0000-4000-8000-000000000001', 970, 'PT-0970', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'breakdown', current_date - 810, null, null, 'Desatasco de desagüe y limpieza de bandeja de condensados.', 1.25, 'Tubo de desagüe, 1 m', null, 'closed', 'office', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', now() - interval '810 days', 'Mario García', '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000970/signature/61000000-0000-4000-8000-000000000970.svg', null, 1, now() - interval '810 days', now() - interval '810 days'),
  ('50000000-0000-4000-8000-000000000961', '10000000-0000-4000-8000-000000000001', 961, 'PT-0961', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', 'installation', current_date - 900, null, null, 'Instalación y puesta en marcha del equipo del salón.', 3.50, 'Tubería frigorífica, canaleta y soportes', null, 'closed', 'office', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', now() - interval '900 days', 'Carmen Ruiz', '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000961/signature/61000000-0000-4000-8000-000000000961.svg', null, 1, now() - interval '905 days', now() - interval '900 days');

insert into public.work_order_photos (
  id,
  organization_id,
  work_order_id,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  sort_order,
  uploaded_by_user_id
)
values (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000001008',
  '10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000001008/photos/60000000-0000-4000-8000-000000000001.svg',
  'unidad-interior-despues.svg',
  'image/svg+xml',
  1024,
  0,
  '20000000-0000-4000-8000-000000000001'
);

insert into public.work_order_corrections (
  id,
  organization_id,
  work_order_id,
  corrected_by_user_id,
  summary,
  changed_fields,
  version_before,
  version_after,
  created_at
)
values (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000998',
  '20000000-0000-4000-8000-000000000001',
  'Se corrigieron las horas indicadas en el parte.',
  array['hours'],
  1,
  2,
  now() - interval '369 days'
);
