# Arquitectura

## Visión general

ClimaGest es una aplicación web responsive construida con Next.js 16, React 19 y TypeScript. La interfaz se ejecuta localmente y consume Supabase para autenticación, PostgreSQL, Storage y Realtime. La autorización se aplica en la base además de limitar la interfaz.

## Módulos

- `src/app/`: entrada de Next.js, metadatos y estilos globales.
- `src/components/climagest-app.tsx`: navegación y flujos de oficina y técnicos.
- `src/components/signature-pad.tsx`: captura táctil de firmas.
- `src/components/ui/`: componentes visuales reutilizables de shadcn.
- `src/lib/climagest.ts`: modelo de dominio y repositorio que traduce entre la interfaz y Supabase.
- `src/lib/supabase.ts`: cliente tipado creado con URL y clave publicable.
- `src/lib/database.types.ts`: tipos generados desde el esquema PostgreSQL.
- `supabase/migrations/`: esquema, RLS, funciones, Storage y datos de demostración versionados.
- `src/db/`: andamiaje D1 anterior, inactivo y sin participación en el flujo actual.

## Flujo de datos

Tras autenticarse, la aplicación consulta la pertenencia activa del usuario y carga las filas visibles por RLS. El repositorio convierte esas filas al `DemoState` que consume la interfaz. Clientes y máquinas se escriben directamente bajo RLS; los partes usan funciones PostgreSQL para numeración, concurrencia, cierre y corrección. Fotografías y firmas se suben a un bucket privado y se leen mediante URLs firmadas. Realtime invalida y vuelve a cargar el estado cuando cambian tablas operativas.

## Acceso

Supabase Auth mantiene sesiones reales de correo y contraseña. `organization_members` conserva el rol y el estado activo; no se confía en metadatos editables del usuario. La oficina administra los datos de su empresa. Cada técnico modifica únicamente sus partes abiertos, crea urgencias asignadas a sí mismo y consulta historial cerrado solo de máquinas relacionadas con alguno de sus trabajos. Las políticas RLS y de Storage hacen cumplir estas reglas fuera de la interfaz.

## Evolución prevista

Los siguientes pasos previstos son envío real de copias, PDF, recuperación de contraseña, administración de miembros y pruebas automatizadas de interfaz. Las credenciales demo deberán sustituirse antes de cualquier uso con datos reales.
