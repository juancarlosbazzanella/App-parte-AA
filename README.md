# ClimaGest

Aplicación responsive para gestionar partes de trabajo de una pequeña empresa de climatización, conectada a Supabase.

Disponible en [ClimaGest](https://partes.juancarlosbazzanella.es/), con acceso individual por invitación. Frontend actualizado publicado el 20 de octubre de 2026 en el alojamiento existente de Dokploy, con **Usuarios** sin configuración de empresa y numeración nueva fija `PT-`.

## Probarlo en el ordenador

Requiere Node.js 22 o posterior y Corepack. El proyecto fija pnpm 11.25.0 con su hash SHA-512.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Después abre `http://localhost:5173` en el navegador.

La copia de trabajo ya puede usar un `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca se debe incluir una clave secreta o `service_role` en variables `NEXT_PUBLIC_*`.

## Acceso y roles

Cada persona utiliza su correo y su contraseña. El administrador invita al equipo desde **Usuarios**. Hay tres roles por empresa: administrador (usuarios, además de oficina), oficina (clientes, máquinas, planificación y correcciones) y técnico (sus partes e historial autorizado). El registro público está desactivado y las cuentas demo antiguas ya no permiten acceder.

Las contraseñas requieren al menos 15 caracteres con mayúsculas, minúsculas, números y símbolos. **He olvidado mi contraseña** solicita un enlace personal. Resend SMTP está configurado y la recuperación por correo y el acceso posterior se han comprobado con el administrador: [guía de puesta en marcha](docs/auth-setup.md).

## Datos y archivos

Clientes, máquinas, partes y auditoría se guardan en PostgreSQL mediante Supabase. Fotografías y firmas se almacenan en el bucket privado `work-order-files`; la aplicación obtiene URLs firmadas temporales. Supabase Auth mantiene las sesiones y PostgreSQL aplica los permisos mediante RLS. La opción **Sincronizar datos** vuelve a consultar el servidor sin borrar información.

Las migraciones y los datos iniciales están en `supabase/migrations/`. Para crear una migración nueva se usa `pnpm db:generate -- <nombre>`.

Los nuevos partes usan siempre el prefijo `PT-` y una numeración consecutiva por empresa, compartida entre oficina y urgencias: `PT-0001`, `PT-0002`, etc. PostgreSQL asigna el siguiente número al crear el parte; los partes anteriores conservan sus referencias. La migración `20261020105413_fixed_work_order_numbering.sql` fija esta regla y continúa desde el contador existente o el mayor número histórico, sin retroceder. El panel de usuarios ya no incluye configuración de empresa ni de prefijos.

## Seguridad de dependencias

pnpm es el único gestor admitido. No uses `npm`, `npx` ni Yarn y no generes otro lockfile. `pnpm-workspace.yaml` impide dependencias transitivas con fuentes exóticas, exige revisar los scripts de instalación y bloquea por defecto versiones publicadas hace menos de siete días. Comprueba los avisos conocidos con `pnpm security:audit`.

## Documentación del proyecto

- [Arquitectura](docs/architecture.md)
- [Estado actual y registro de cambios](docs/current-state.md)
- [Auditoría de seguridad del 23-09-2026](docs/security-audit-2026-09-23.md)
- [Decisiones técnicas](docs/decisions/)
- [Acceso y configuración del correo](docs/auth-setup.md)
- [Publicación y recuperación del despliegue](docs/deployment.md)
- [Verificación de seguridad del acceso](docs/security-auth-2026-10-15.md)
- [Pruebas manuales](tests/manual-smoke.md)
- [Pruebas automatizadas y cobertura](docs/testing.md)

El código de la aplicación está en `src/`. Todo cambio debe actualizar `docs/current-state.md` y, cuando corresponda, la arquitectura o una decisión técnica. `AGENTS.md` y `CLAUDE.md` muestran la misma guía mediante un enlace simbólico; `pnpm docs:check` comprueba esta estructura.

## Alcance

Incluye los flujos de administrador, oficina y técnico, autenticación individual, invitaciones y recuperación por correo, el formulario único para los cuatro tipos de trabajo, firma o cierre justificado sin firma, búsqueda, historial por máquina y sincronización entre sesiones. La entrega de una invitación a un nuevo destinatario real sigue pendiente de una prueba. No incluye facturación, contabilidad, nóminas, almacén, rutas, PDF, modo sin conexión ni envío real de copias de partes.

## Pruebas

`pnpm test` ejecuta las pruebas de acceso, repositorio y flujos de React con Vitest, sin credenciales ni servicios externos. `pnpm test:watch` las repite durante el desarrollo; `pnpm test:coverage` genera el informe HTML en `coverage/index.html`. `pnpm test:auth` permite ejecutar solo las comprobaciones de acceso.

`pnpm test:numbering` ejecuta la migración y el trigger de numeración en PostgreSQL aislado con PGlite, sin Docker. Comprueba continuidad, prefijo fijo, urgencias, históricos, fallos y números de más de cuatro cifras.

`pnpm test:permissions` conserva la suite SQL contra Supabase local: crea fixtures aislados, comprueba permisos permitidos y denegados y revierte la transacción. Requiere Docker o Podman y una instancia local iniciada. Los detalles y límites están en [la guía de pruebas](docs/testing.md).

## Trabajo y publicación

Los cambios se realizan en `main`. No se crean otras ramas salvo instrucción explícita del usuario. `git add`, `git commit`, `git push` y cualquier subida al repositorio requieren autorización expresa para cada operación. Editar o probar no autoriza publicar. La guía canónica está en `AGENTS.md`, enlazada desde `CLAUDE.md`.
