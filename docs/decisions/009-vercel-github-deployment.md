# ADR 009 — Despliegue de Next.js en Vercel desde GitHub

- Fecha: 20 de octubre de 2026.
- Estado: aceptado.

## Contexto

El usuario solicita conectar `juancarlosbazzanella/App-parte-AA` con Vercel y desplegar la aplicación. El repositorio usa Next.js, pero `pnpm build` genera el destino vinext/Cloudflare utilizado por el alojamiento existente. Vercel necesita la salida nativa de Next.js.

## Decisión

Crear el proyecto `app-parte-aa` en el espacio `juancarlosbazzanella`, conectado al repositorio existente y con `main` como rama de producción. La aplicación oficial de GitHub se autoriza únicamente para este repositorio. No se crean ramas ni se escriben commits para realizar el despliegue.

Configurar en el proyecto remoto el preset Next.js, el directorio raíz del repositorio y la salida predeterminada de Next.js. La preferencia del proyecto se estableció en Node.js 22.x, pero Vercel resuelve 24.x al prevalecer el rango `engines.node >=22.13.0` del repositorio. La instalación usa `corepack pnpm install --frozen-lockfile`, con `ENABLE_EXPERIMENTAL_COREPACK=1`, para respetar la versión SHA-512 de pnpm 11.25.0 y los controles de `pnpm-workspace.yaml`. El comando de compilación es:

```sh
node scripts/prepare-deployment.mjs && corepack pnpm run docs:check && corepack pnpm exec next build
```

Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` se configuran solo para Production, utilizando el proyecto Supabase existente. No se carga ninguna clave de servidor. Se añaden a Supabase las URLs exactas `https://app-parte-aa.vercel.app/?auth=setup` y `https://app-parte-aa.vercel.app/?auth=reset`. La función existente de invitaciones admite el nuevo origen mediante `CLIMAGEST_APP_ORIGIN=https://app-parte-aa.vercel.app`, configurado en su entorno de Supabase, sin modificar su código ni sus comprobaciones de usuario y administrador.

## Consecuencias

Los futuros cambios autorizados que lleguen a `main` activan despliegues automáticos. El desarrollo y la compilación vinext existentes conservan sus comandos. Las vistas previas no reciben la configuración de la base de producción; necesitarían un entorno Supabase independiente antes de utilizarse.

Las verificaciones locales de ambos motores deben limpiar `.next/` al cambiar de uno a otro, para evitar mezclar sus tipos de rutas generados. Esa caché permanece fuera del repositorio.

El dominio personalizado existente continúa servido por Dokploy. La creación de Vercel no modifica DNS, no ejecuta migraciones ni carga datos. Los ajustes de compilación viven en Vercel y se registran en `docs/deployment.md`; al recrear el proyecto deben restaurarse expresamente. Para fijar una versión principal efectiva de Node.js habría que acotar también `engines.node` y publicar ese cambio con autorización independiente. La documentación y la configuración local quedaron sin stage hasta la autorización expresa posterior del propietario, concedida el 21 de octubre para `git add`, `git commit` y `git push` a `main`.
