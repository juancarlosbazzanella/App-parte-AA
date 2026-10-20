# Auditoría de seguridad — 23 de septiembre de 2026

Las rutas de migración se actualizaron el 15-10-2026 para coincidir con las versiones remotas; el SQL histórico conserva su contenido. Las correcciones posteriores de autenticación se documentan en `security-auth-2026-10-15.md`.

## Resultado

Se confirmaron **19 problemas**: **4 críticos**, **5 altos**, **8 medios** y **2 mejoras opcionales**. El análisis cubrió el código, migraciones, política RLS y Storage, configuración de Supabase, grafo de dependencias y la aplicación publicada en `partes.juancarlosbazzanella.es`.

La migración de gestor de paquetes solicitada se ha aplicado: pnpm 11.25.0 queda fijado por hash, hay lockfile único, instalación congelada y políticas de suministro. Las demás correcciones de este documento **no se han aplicado**: cambian el modelo de acceso y requieren validación con cuentas de oficina y técnico antes de desplegarlas.

## Críticos: corregir antes de seguir exponiendo el sitio

### 1. Cuentas operativas y contraseña públicas

- **Dónde:** `src/lib/climagest.ts:90-98`, `src/components/climagest-app.tsx:297,322-410`, `README.md:19-28` y `supabase/migrations/20260917094432_seed_climagest_demo.sql:1-135`.
- **Problema:** los cuatro correos, roles y la contraseña común `demo1234` se compilan en JavaScript público. La base remota confirma que las cuatro cuentas siguen activas y aceptan esa contraseña.
- **Riesgo:** cualquier visitante entra como oficina y modifica clientes, máquinas, partes y archivos privados.
- **Corrección:** retirar inmediatamente el sitio de acceso público o desactivar las cuentas; eliminar el selector y el seed de producción; crear usuarios individuales mediante invitación.

```sql
-- Medida de contención inmediata: ejecutar en el SQL Editor de Supabase.
update public.organization_members
set is_active = false
where user_id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004'
);
```

Después, desde un backend seguro con `service_role` (nunca desde el navegador), bloquear o borrar los usuarios y revocar sus sesiones. Elimina `DEMO_PASSWORD`, `DEMO_USERS` y `emailForUser`; el formulario debe comenzar vacío:

```tsx
function LoginScreen({ onLogin, storageError }: {
  onLogin: (email: string, password: string) => Promise<void>;
  storageError: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Sin selector de perfiles ni contraseña precargada.
}
```

### 2. Un usuario puede falsificar cierres de partes sin usar la RPC

- **Dónde:** `supabase/migrations/20260917094424_create_climagest_schema.sql:505-579,741-766,909-964,1037` y `20260917095605_optimize_climagest_policies_indexes.sql:20-40`.
- **Problema:** existe `UPDATE` e `INSERT` REST directos sobre `work_orders`. La policy de inserción no exige `status = 'open'` y el trigger permite la transición a cerrado si el técnico pone su propio ID. Así se puede insertar un parte ya cerrado o cerrar uno abierto sin pasar por `close_work_order`.
- **Riesgo:** falsificación de auditoría, fecha de cierre, firma y horas; no hay garantía de que el cierre haya seguido la operación transaccional prevista.
- **Corrección:** exigir que toda inserción sea abierta y que el único cambio `open → closed` venga marcado internamente por `close_work_order`.

```sql
-- Nueva migración: endurecer-cierres.sql
drop policy if exists work_orders_insert_authorized on public.work_orders;
create policy work_orders_insert_authorized
on public.work_orders for insert to authenticated
with check (
  status = 'open'
  and closed_by_user_id is null
  and closed_at is null
  and signature_storage_path is null
  and no_signature_reason is null
  and (
    ((select private.current_user_has_role(organization_id, 'office'))
      and source = 'office'
      and created_by_user_id = (select auth.uid())
      and (select private.member_has_role(organization_id, technician_user_id, 'technician')))
    or
    ((select private.current_user_has_role(organization_id, 'technician'))
      and source = 'urgent'
      and created_by_user_id = (select auth.uid())
      and technician_user_id = (select auth.uid())
      and (select private.current_user_can_view_machine(organization_id, machine_id)))
  )
);

-- Al principio de private.guard_work_order_update(), antes de las ramas de rol:
if old.status = 'open' and new.status = 'closed'
  and current_setting('climagest.operation', true) is distinct from 'close' then
  raise exception 'El cierre debe realizarse mediante close_work_order.';
end if;

-- Dentro de public.close_work_order(), justo antes de UPDATE public.work_orders:
perform set_config('climagest.operation', 'close', true);
```

### 3. Una urgencia desbloquea el historial completo de una máquina ajena

- **Dónde:** `supabase/migrations/20260917094424_create_climagest_schema.sql:355-375,378-402,714-725` y policy de urgencias en `20260917095605_optimize_climagest_policies_indexes.sql:20-40`.
- **Problema:** un técnico puede crear una urgencia para cualquier máquina. Esa única fila hace que `current_user_can_view_machine` devuelva `true`; a continuación puede leer todos los partes cerrados, fotos y firmas históricas de esa máquina.
- **Riesgo:** escalada horizontal de datos personales y documentación técnica mediante una sola inserción.
- **Corrección:** una urgencia no debe crear el vínculo que habilita historial; exige además que el técnico ya tuviera relación autorizada con la máquina.

```sql
create or replace function private.current_user_can_view_machine(
  p_organization_id uuid,
  p_machine_id uuid
) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_user_has_role(p_organization_id, 'office')
    or (
      private.current_user_is_member(p_organization_id)
      and exists (
        select 1 from public.work_orders wo
        where wo.organization_id = p_organization_id
          and wo.machine_id = p_machine_id
          and wo.technician_user_id = (select auth.uid())
          and wo.source = 'office'
      )
    );
$$;
```

### 4. HTTPS publicado con certificado autofirmado y de otro nombre

- **Dónde:** despliegue de Dokploy/Traefik, no en un archivo del repositorio. La comprobación del dominio publicado devolvió `CN=TRAEFIK DEFAULT CERT`, autofirmado y sin SAN para el dominio.
- **Problema:** el navegador recibe un certificado que no identifica `partes.juancarlosbazzanella.es`.
- **Riesgo:** usuarios acostumbrados a ignorar el aviso quedan expuestos a intermediarios que roben credenciales y tokens.
- **Corrección:** en Dokploy, deja el dominio con puerto interno `3000`, HTTPS activado y proveedor Let's Encrypt; confirma que el DNS A/AAAA apunta al servidor antes de emitir. No actives HSTS hasta que `https://partes.juancarlosbazzanella.es` valide sin advertencias.

## Altos

### 5. Cada técnico descarga toda la cartera de clientes y máquinas

- **Dónde:** `src/lib/climagest.ts:307-315,391-407`; policies `clients_select_member` y `machines_select_member` en la migración base: `682-700`.
- **Problema:** la UI oculta pantallas, pero la carga inicial solicita correo, teléfono, dirección y número de serie de toda la organización para cualquier miembro.
- **Riesgo:** extracción de PII y ubicaciones desde DevTools por cualquier técnico o cuenta comprometida.
- **Corrección:** RLS debe limitar clientes/máquinas de técnico a sus partes visibles y el cliente debe pedir solo esos IDs.

```sql
drop policy if exists clients_select_member on public.clients;
create policy clients_select_visible on public.clients for select to authenticated
using (
  (select private.current_user_has_role(organization_id, 'office'))
  or exists (
    select 1 from public.work_orders wo
    where wo.organization_id = clients.organization_id
      and wo.client_id = clients.id
      and (select private.current_user_can_view_work_order(wo.id))
  )
);

drop policy if exists machines_select_member on public.machines;
create policy machines_select_visible on public.machines for select to authenticated
using (
  (select private.current_user_has_role(organization_id, 'office'))
  or exists (
    select 1 from public.work_orders wo
    where wo.organization_id = machines.organization_id
      and wo.machine_id = machines.id
      and (select private.current_user_can_view_work_order(wo.id))
  )
);
```

Tras ello, en `load()` carga primero `jobsResult`, extrae `client_id` y `machine_id`, y aplica `.in("id", ids)` para técnicos. Nunca confíes en ese filtro TypeScript como control de acceso: la RLS anterior es la frontera real.

### 6. Fotos y firmas pueden sobrescribirse; la RPC acepta rutas inexistentes o reutilizadas

- **Dónde:** `private.current_user_can_edit_work_order`: `404-424`; Storage: `426-466,1076-1092`; fotos: `772-786`; cierre: `909-953`.
- **Problema:** oficina puede editar archivos de partes cerrados y la RPC de cierre guarda cualquier texto como ruta de firma, sin comprobar que exista, que pertenezca al parte o que tenga el prefijo correcto.
- **Riesgo:** borrar o sustituir evidencia de una intervención; enlazar una firma de otro parte o una ruta falsa.
- **Corrección:** ninguna escritura de archivo ni de metadatos de foto tras el cierre; validar la existencia y propiedad de la firma en la misma transacción.

```sql
create or replace function private.signature_belongs_to_work_order(
  p_organization_id uuid, p_work_order_id uuid, p_path text
) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_path like p_organization_id::text || '/' || p_work_order_id::text || '/signature/%'
    and exists (
      select 1 from storage.objects
      where bucket_id = 'work-order-files' and name = p_path
    );
$$;

-- En close_work_order(), después de comprobar firma/motivo:
-- Añade antes al bloque DECLARE: v_organization_id uuid;
select organization_id into v_organization_id
from public.work_orders where id = p_work_order_id;
if nullif(btrim(p_signature_storage_path), '') is not null
  and not private.signature_belongs_to_work_order(
    v_organization_id, p_work_order_id, p_signature_storage_path
  ) then
  raise exception 'La firma no pertenece al parte.';
end if;

drop policy if exists work_order_files_update on storage.objects;
drop policy if exists work_order_photos_update_editable on public.work_order_photos;
```

Para inserción/borrado sustituye `current_user_can_edit_work_order` por un helper que exija `work_orders.status = 'open'`; conserva la firma y las fotos de cierre como inmutables.

### 7. Privilegios por defecto remotos conceden acceso a objetos futuros

- **Dónde:** configuración efectiva remota de Supabase; la migración solo revoca objetos existentes en `20260917094424_create_climagest_schema.sql:1021-1042`.
- **Problema:** el proyecto remoto conserva `DEFAULT PRIVILEGES` que otorgan `ALL` sobre tablas y `EXECUTE` sobre funciones futuras a `anon`/`authenticated`.
- **Riesgo:** una tabla o RPC nueva puede publicarse accidentalmente antes de tener RLS, grants y revisión.
- **Corrección:** ejecutar como propietario del esquema en la base remota y desactivar la exposición automática de nuevas tablas en la configuración del proyecto.

```sql
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from anon, authenticated;
```

### 8. Faltan todos los headers HTTP de seguridad

- **Dónde:** `next.config.ts:3-5`; la respuesta pública no contiene CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ni protección de marcos.
- **Riesgo:** clickjacking, fuga de rutas por Referer, MIME sniffing y un impacto mayor si aparece una XSS.
- **Corrección:** aplica los headers en la aplicación y, para HSTS, también en Traefik tras corregir TLS.

```ts
// next.config.ts
import type { NextConfig } from "next";

const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: ${supabaseOrigin}; connect-src 'self' ${supabaseOrigin} wss://${new URL(supabaseOrigin).host}; script-src 'self'; style-src 'self' 'unsafe-inline'` },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; },
};
export default nextConfig;
```

### 9. El lockfile tiene 38 advisories: 22 altos, 12 medios y 4 bajos

- **Dónde:** `package.json` y el nuevo `pnpm-lock.yaml`.
- **Problema:** `pnpm audit --json` detecta, entre otros, `react-server-dom-webpack 19.2.6`, `vinext beta.5 → image-size`, `vite 8.0.13`, `wrangler/miniflare → undici/ws/sharp`, `browserslist` y `@babel/core` vulnerables.
- **Riesgo:** denegaciones de servicio y lecturas de archivos en herramientas de build/desarrollo; algunos paquetes (`Next`, `Wrangler`) llegan al entorno de producción.
- **Corrección:** actualiza deliberadamente el conjunto compatible, recompila y repite auditoría. Las versiones actuales consultadas son `react-server-dom-webpack 19.3.0`, `vinext 1.0.0-beta.11`, `vite 8.3.0`, `wrangler 4.136.3` y `@cloudflare/vite-plugin 1.57.3`.

```bash
pnpm update -D react-server-dom-webpack@19.3.0 vinext@1.0.0-beta.11 vite@8.3.0 wrangler@4.136.3 @cloudflare/vite-plugin@1.57.3
pnpm install --frozen-lockfile
pnpm security:audit
```

## Medios

### 10. Política de contraseña, alta y fuerza bruta débil

- **Dónde:** `supabase/config.toml:175,181-184,196-227`; el asesor remoto confirma que la protección contra contraseñas filtradas está desactivada.
- **Problema:** registro abierto, mínimo de seis caracteres, sin complejidad, sin CAPTCHA, 30 intentos de inicio de sesión por IP/5 min, confirmación de correo y reautenticación de cambio de clave desactivadas.
- **Riesgo:** alta no autorizada, password spraying y secuestro de cuentas tras retirar las claves demo.
- **Corrección:** replica estos valores en Authentication > Settings de Supabase (el TOML local no modifica por sí solo el proyecto alojado).

```toml
[auth]
enable_signup = false
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits_symbols"

[auth.rate_limit]
sign_in_sign_ups = 5
token_refresh = 60

[auth.captcha]
enabled = true
provider = "turnstile"

[auth.email]
enable_signup = false
enable_confirmations = true
secure_password_change = true
max_frequency = "60s"
```

### 11. Entradas sin límites ni validación autoritativa

- **Dónde:** `src/components/climagest-app.tsx:1203-1222`, `src/lib/climagest.ts:114-121,243-251,413-519`; tablas base: `40-162`.
- **Problema:** se valida principalmente “no vacío”; no hay longitudes máximas, correo robusto ni comprobación de números finitos. Los controles HTML se eluden llamando a Supabase directamente.
- **Riesgo:** datos corruptos, payloads grandes y denegación de servicio/almacenamiento.
- **Corrección:** valida con Zod antes de escribir y añade límites equivalentes con `CHECK` en PostgreSQL.

```ts
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const clientInputSchema = z.object({
  id: z.string().uuid(), name: requiredText(160),
  email: z.string().trim().email().max(254), phone: z.string().trim().max(32),
}).strict();

function optionalFiniteNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Las horas no son válidas.");
  return parsed;
}
```

```sql
alter table public.clients
  add constraint clients_name_length check (char_length(name) <= 160),
  add constraint clients_email_length check (char_length(email) <= 254),
  add constraint clients_phone_length check (phone is null or char_length(phone) <= 32);
alter table public.machines
  add constraint machines_brand_length check (char_length(brand) <= 80),
  add constraint machines_model_length check (char_length(model) <= 120),
  add constraint machines_address_length check (char_length(installation_address) <= 500);
```

### 12. Carga de imágenes confiando en MIME del cliente y permitiendo SVG

- **Dónde:** `src/components/climagest-app.tsx:1021-1030,1092`, `src/lib/climagest.ts:131-143,193-220`, bucket SQL: `1044-1060`.
- **Problema:** se acepta cualquier `image/*`, incluido SVG activo, sin límite previo de tamaño/cantidad ni comprobación de bytes.
- **Riesgo:** contenido activo, archivos disfrazados, agotamiento de memoria del navegador y cuota de Storage.
- **Corrección:** JPEG/PNG/WebP exclusivamente; 5 MiB y 12 archivos máximos; validar magic bytes y recodificar en una Edge Function si se quiere una frontera no eludible.

```ts
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Solo se admiten JPEG, PNG o WebP de hasta 5 MiB.");
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v);
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("El contenido no coincide con una imagen permitida.");
}
```

También sustituye `allowed_mime_types` por `array['image/jpeg','image/png','image/webp']` y elimina la rama SVG de `extensionForMime`.

### 13. Los mensajes internos del backend llegan al navegador

- **Dónde:** `src/lib/climagest.ts:123-125,218-220,536-540`; UI: `src/components/climagest-app.tsx:233-267,334-360`.
- **Problema:** `assertNoError` relanza `error.message` y la interfaz lo muestra.
- **Riesgo:** expone tablas, constraints, funciones y políticas, facilitando reconocimiento del backend.
- **Corrección:** conserva el detalle solo en telemetría segura con ID de correlación; muestra mensajes genéricos.

```ts
function assertNoError(error: { code?: string; message: string } | null, publicMessage: string) {
  if (!error) return;
  // registrar únicamente operación y error.code; nunca el payload o error.message
  throw new Error(publicMessage);
}

// En inicio de sesión, mismo mensaje para usuario inexistente y contraseña errónea.
if (error || !data.user) throw new Error("No se pudo iniciar sesión. Revisa tus credenciales.");
```

### 14. Tokens de sesión persistidos en `localStorage`

- **Dónde:** `src/lib/supabase.ts:13-22`.
- **Problema:** `persistSession: true` en un cliente sólo de navegador almacena refresh tokens accesibles a JavaScript.
- **Riesgo:** una XSS futura roba sesiones persistentes.
- **Corrección:** migra a `@supabase/ssr` con cookies `HttpOnly`, `Secure`, `SameSite=Lax` y renovación en middleware; hasta entonces aplica la CSP del punto 8 y reduce la duración de sesiones/refresh tokens en Supabase.

### 15. URLs firmadas de todos los archivos, válidas una hora

- **Dónde:** `src/lib/climagest.ts:146-157,330-345,383-385`.
- **Problema:** al cargar la aplicación se emiten bearer URLs de fotos y firmas para todos los registros visibles durante 3.600 segundos.
- **Riesgo:** una URL copiada conserva acceso tras logout o desactivación de cuenta hasta expirar.
- **Corrección:** genera la URL sólo al abrir el archivo y reduce el TTL.

```ts
const SIGNED_URL_TTL_SECONDS = 120;
const { data, error } = await supabase.storage
  .from("work-order-files")
  .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
```

### 16. Grants de actualización demasiado amplios para campos internos

- **Dónde:** `supabase/migrations/20260917094424_create_climagest_schema.sql:664-676,693-712,1035-1042`.
- **Problema:** los grants a nivel de tabla permiten actualizar campos de auditoría, contadores y referencias de entidades de oficina; además todas las funciones privadas son ejecutables por `authenticated`.
- **Riesgo:** corrupción de `created_by`, organización, contador de partes o metadatos si una policy/función futura se equivoca.
- **Corrección:** usa grants por columna y expón sólo RPC públicas necesarias. Para `work_orders`, primero aplica el guard del punto 2 y después convierte las RPC a `SECURITY DEFINER` con comprobaciones explícitas antes de revocar `UPDATE` directo.

```sql
revoke update on public.profiles, public.organizations, public.clients, public.machines from authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, timezone, work_order_prefix) on public.organizations to authenticated;
grant update (name, email, phone, archived_at) on public.clients to authenticated;
grant update (client_id, brand, model, serial_number, installation_address, archived_at)
  on public.machines to authenticated;
revoke execute on all functions in schema private from authenticated;
grant execute on function
  private.current_user_is_member(uuid),
  private.current_user_has_role(uuid, public.member_role),
  private.member_has_role(uuid, uuid, public.member_role),
  private.shares_organization_with(uuid),
  private.current_user_can_view_machine(uuid, uuid),
  private.current_user_can_view_work_order(uuid),
  private.current_user_can_edit_work_order(uuid),
  private.current_user_can_access_storage_path(text, boolean)
to authenticated;
```

### 17. Conexión directa a base permitida desde cualquier IP

- **Dónde:** `supabase/config.toml:72-84`.
- **Problema:** la plantilla permite `0.0.0.0/0` y `::/0` y no fuerza SSL.
- **Riesgo:** aumenta la superficie de ataques de contraseña y de red si esta política se replica al proyecto alojado.
- **Corrección:** activa restricciones de red y SSL en el panel de Supabase; permite sólo IPs VPN/administración necesarias.

```toml
[db.network_restrictions]
enabled = true
allowed_cidrs = ["IP_PUBLICA_DE_TU_VPN/32"]
allowed_cidrs_v6 = []

[db.ssl_enforcement]
enabled = true
```

## Mejoras opcionales

### 18. Código no desplegado con patrones inseguros

- **Dónde:** `src/components/ui/chart.tsx:97-115` usa `dangerouslySetInnerHTML`; `src/app/chatgpt-auth.ts` confía en cabeceras de identidad; `examples/d1/app/api/notes/route.ts` no tiene autenticación ni rate limit.
- **Problema/riesgo:** hoy no se importan ni despliegan, por lo que no son una vulnerabilidad activa. Si se reutilizan, podrían introducir XSS, suplantación de cabeceras o API pública sin control.
- **Corrección:** eliminar el código muerto o añadir pruebas y fronteras de confianza antes de moverlo a `src/app`.

### 19. Faltan pruebas automáticas negativas de RLS y Storage

- **Dónde:** no hay tests de autorización; las reglas residen en las migraciones.
- **Problema/riesgo:** una refactorización puede reabrir datos sin que CI lo detecte.
- **Corrección:** añade una suite de migración con perfiles `anon`, técnico ajeno, técnico asignado y oficina, comprobando SELECT/INSERT/UPDATE/DELETE para cada tabla y objeto Storage. Debe ejecutarse antes de desplegar cualquier migración.

## Áreas revisadas sin problema activo confirmado

- No hay SQL Injection en el código de aplicación: usa el query builder/RPC parametrizadas de Supabase; las funciones SQL no interpolan entrada como SQL dinámico.
- No hay XSS directo en los campos de texto actuales: React escapa la salida. Esto no mitiga el problema de SVG ni el componente inactivo del punto 18.
- No se encontró `service_role` ni otro secreto en archivos versionados; la clave `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es pública por diseño y `.env.local` está ignorado.
- No hay endpoint propio que abra CORS: las llamadas browser→Supabase usan una clave pública y RLS; CORS no sustituye a RLS. Revisa los orígenes permitidos en el panel de Supabase al activar dominios nuevos.
- No se detectaron logs de contraseñas, tokens o PII mediante `console.*` en el código de aplicación.

## pnpm aplicado y verificado

Se eliminó el lockfile/configuración de npm y el instalador npm heredado. Se añadió `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packageManager` con SHA-512 y `pnpm security:audit`. La primera instalación congelada bloqueó correctamente el script no autorizado de `sharp`; se revisó y autorizó de forma explícita. `corepack pnpm install --frozen-lockfile` terminó correctamente con pnpm 11.25.0.

La elección responde a las campañas recientes de dependencias maliciosas con scripts `postinstall`: [guía de Supabase](https://supabase.com/docs/guides/security/npm-security), [plan de seguridad de GitHub](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/) y [controles de pnpm](https://pnpm.io/supply-chain-security).
