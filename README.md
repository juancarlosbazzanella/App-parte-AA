# ClimaGest

Aplicación responsive para gestionar partes de trabajo de una pequeña empresa de climatización, conectada a Supabase.

## Probarlo en el ordenador

Requiere Node.js 22 o posterior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Después abre `http://localhost:5173` en el navegador.

La copia de trabajo ya puede usar un `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca se debe incluir una clave secreta o `service_role` en variables `NEXT_PUBLIC_*`.

## Accesos de demostración

La contraseña de todas las cuentas es `demo1234`.

- `oficina@climagest.demo`
- `alvaro@climagest.demo`
- `lucia@climagest.demo`
- `marcos@climagest.demo`

La pantalla de acceso permite seleccionar cualquiera de ellas sin escribir el correo manualmente.

## Datos y archivos

Clientes, máquinas, partes y auditoría se guardan en PostgreSQL mediante Supabase. Fotografías y firmas se almacenan en el bucket privado `work-order-files`; la aplicación obtiene URLs firmadas temporales. Supabase Auth mantiene las sesiones y PostgreSQL aplica los permisos mediante RLS. La opción **Sincronizar datos** vuelve a consultar el servidor sin borrar información.

Las migraciones y los datos iniciales están en `supabase/migrations/`. Para crear una migración nueva se usa `npx supabase migration new <nombre>`.

## Documentación del proyecto

- [Arquitectura](docs/architecture.md)
- [Estado actual y registro de cambios](docs/current-state.md)
- [Decisiones técnicas](docs/decisions/)
- [Pruebas manuales](tests/manual-smoke.md)

El código de la aplicación está en `src/`. Todo cambio debe actualizar `docs/current-state.md` y, cuando corresponda, la arquitectura o una decisión técnica. `AGENTS.md` y `CLAUDE.md` muestran la misma guía mediante un enlace simbólico; `npm run docs:check` comprueba esta estructura.

## Alcance

Incluye los flujos de oficina y técnico, autenticación real, el formulario único para los cuatro tipos de trabajo, firma o cierre justificado sin firma, búsqueda, historial por máquina y sincronización entre sesiones. No incluye facturación, contabilidad, nóminas, almacén, rutas, PDF, modo sin conexión ni envío real de correos.
