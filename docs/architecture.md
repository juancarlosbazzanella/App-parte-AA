# Arquitectura

## Visión general

ClimaGest es una aplicación web responsive construida con Next.js 16, React 19 y TypeScript. La interfaz se sirve desde el despliegue público de Dokploy o el servidor de desarrollo local y consume Supabase para autenticación, PostgreSQL, Storage y Realtime. La autorización se aplica en la base además de limitar la interfaz.

## Módulos

- `src/app/`: entrada de Next.js, metadatos y estilos globales.
- `src/components/climagest-app.tsx`: navegación y flujos de administración, oficina y técnicos.
- `src/components/auth-screen.tsx`: acceso, recuperación y establecimiento de contraseña.
- `src/components/admin-screen.tsx`: miembros e invitaciones en **Usuarios**, disponible solo para administradores; sin formulario de datos de empresa.
- `src/components/signature-pad.tsx`: captura táctil de firmas.
- `src/components/ui/`: componentes visuales reutilizables de shadcn.
- `src/lib/climagest.ts`: modelo de dominio y repositorio que traduce entre la interfaz y Supabase.
- `src/lib/auth-policy.ts`: validación de contraseña compartida por el formulario y sus pruebas.
- `supabase/functions/climagest-invite/`: envío de invitaciones con credencial de servidor y autorización en PostgreSQL.
- `src/lib/supabase.ts`: cliente tipado creado con URL y clave publicable.
- `src/lib/database.types.ts`: tipos generados desde el esquema PostgreSQL.
- `supabase/migrations/`: esquema, RLS, funciones, Storage y datos de demostración versionados.
- `pnpm-lock.yaml` y `pnpm-workspace.yaml`: grafo reproducible y política de seguridad de la cadena de suministro.
- `vitest.config.ts` y `tests/`: pruebas aisladas del repositorio y flujos React, fixtures ficticios y suite SQL de autorización; véase `testing.md` y ADR 007.
- `src/db/`: andamiaje D1 anterior, inactivo y sin participación en el flujo actual.

## Flujo de datos

Tras autenticarse, la aplicación consulta la pertenencia activa del usuario y carga las filas visibles por RLS. El repositorio convierte esas filas al `AppState` que consume la interfaz. Clientes y máquinas se escriben directamente bajo RLS; los partes usan funciones PostgreSQL para numeración, concurrencia, cierre y corrección. Fotografías y firmas se suben a un bucket privado y se leen mediante URLs firmadas. Realtime invalida y vuelve a cargar el estado cuando cambian tablas operativas, miembros o empresa; también se comprueba al recuperar el foco y cada minuto. Las URLs de imágenes duran dos minutos y se renuevan mientras se muestran, sin pasar por una caché compartida.

La numeración de los nuevos partes es `PT-` más un contador consecutivo por empresa, común a planificación y urgencias. El trigger `private.set_work_order_reference` obtiene el número mediante un único UPDATE de la fila de empresa; su bloqueo serializa las asignaciones y un fallo de creación revierte también el contador. El formato mantiene cuatro cifras como mínimo sin truncar números mayores. La migración del 20 de octubre fija el prefijo, revoca su edición y eleva contadores atrasados al mayor `sequence_number` existente más uno, sin bajar contadores ni renumerar históricos. El cliente solo carga el nombre de empresa y utiliza la referencia devuelta por el servidor; ya no carga ni edita prefijo, zona horaria o siguiente número. Véase ADR 008.

## Cadena de suministro

El proyecto usa exclusivamente pnpm 11.25.0, fijado junto con su integridad SHA-512 en `package.json`. El lockfile es obligatorio y las instalaciones de CI son congeladas. La política central de pnpm retrasa siete días la adopción de versiones recién publicadas, bloquea fuentes transitivas exóticas y solo permite scripts de instalación de paquetes revisados explícitamente. La decisión y sus límites se documentan en el ADR 005.

El despliegue existente utiliza Dokploy y Railpack. `railpack.json` fija Node 22.23.3 y reemplaza la instalación automática de herramientas por Corepack incluido en Node 22 y pnpm fijado por el proyecto. El transporte ZIP omite enlaces simbólicos; `prebuild` recrea exclusivamente la guía `CLAUDE.md` si falta y después ejecuta la validación documental estricta. El procedimiento está en `deployment.md`.

## Acceso

Supabase Auth mantiene sesiones individuales por correo y contraseña. El registro público está desactivado y el acceso se concede por invitación. `organization_members` conserva `admin`, `office` o `technician` y el estado activo; no se confía en metadatos editables. Los ayudantes privados comprueban además `auth.sessions`, por lo que un token de una sesión cerrada deja de autorizar datos.

Administración gestiona usuarios, además de disponer de los permisos operativos de oficina. Oficina administra clientes, equipos, planificación y correcciones de su empresa. El técnico modifica sus partes abiertos, crea urgencias propias para máquinas ya autorizadas por oficina y consulta el historial cerrado de esas máquinas. RLS limita también la descarga de clientes y máquinas. El nombre y la zona horaria se conservan en el esquema por compatibilidad; no se editan desde la aplicación. El prefijo queda fijado a `PT` también mediante restricción de base de datos.

Los partes solo se escriben por RPC públicas invocadoras de operaciones privadas con permisos de definidor y comprobaciones explícitas. No existe INSERT/UPDATE directo para usuarios autenticados. Oficina/administración pueden cerrar un parte y quedan como autores reales del cierre. La firma pertenece al mismo parte; datos originales de cierre y archivos cerrados son inmutables. Las correcciones requieren motivo y producen auditoría.

Los cambios de miembros se serializan por empresa y quedan auditados. No se puede retirar al último administrador ni dejar partes abiertos asignados a un técnico desactivado o con otro rol. `member_invitations` conserva solicitudes y fallos; una Edge Function verifica JWT, usuario y administrador activo, envía con Auth y completa la pertenencia desde el servidor. La credencial de servicio solo está en Supabase. SMTP personalizado es necesario para la entrega real.

El cliente web usa sesiones persistentes, renovación y PKCE; consume explícitamente enlaces Auth/token_hash y elimina los parámetros sensibles de la URL. El establecimiento de contraseña termina con cierre global de sesiones y nuevo login. El aprovisionamiento inicial se realiza con herramientas privilegiadas; no hay una ruta pública para crear administradores. Véanse ADR 006 y `auth-setup.md`.

## Evolución prevista

SMTP está configurado y el administrador ha comprobado la recuperación por correo y el acceso posterior. El frontend actualizado se publicó el 16 de octubre de 2026 en el despliegue existente de Dokploy; se verificaron HTTPS, formularios públicos, adaptación móvil y rechazo de datos anónimos. Las pruebas automatizadas con Vitest cubren ahora el acceso, los contratos del repositorio y los principales flujos React; la suite SQL conserva la verificación real de permisos. Los siguientes pasos previstos son comprobar la invitación de un nuevo destinatario real, envío real de copias de partes, PDF y pruebas de navegador con integraciones locales. Las cuentas demo permanecen desactivadas. Los avisos pendientes de dependencias se mantienen en `security-auth-2026-10-15.md`.
