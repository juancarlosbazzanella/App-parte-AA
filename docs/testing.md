# Pruebas de ClimaGest

La suite prioriza pérdidas de datos, acceso, cierres y permisos visibles. Se ejecuta con Node 22.13 o posterior y el pnpm fijado por el proyecto.

## Ejecución habitual

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:watch
pnpm test:coverage
pnpm test:auth
pnpm test:numbering
```

`test` ejecuta una vez todas las pruebas y devuelve un código distinto de cero al fallar. `test:watch` permanece observando cambios. El informe de `test:coverage` se abre desde `coverage/index.html` y está excluido de Git y del lint por ser contenido generado. Para ejecutar un solo archivo: `pnpm exec vitest run tests/workspace.test.tsx`.

Las pruebas no necesitan `.env.local`, cuentas ni Supabase iniciado. `vitest.config.ts` evita cargar el entorno y los plugins de despliegue; `tests/setup.ts` sustituye el cliente Supabase y bloquea fetch. Los fixtures usan datos ficticios y dominios `example.test`. No se envían correos ni se modifican datos remotos.

`test:numbering` usa el entorno Node y PGlite para ejecutar PostgreSQL en memoria, con la migración real de numeración. Incluido también en `pnpm test`, no necesita Docker ni conexión externa. La configuración común solo instala los sustitutos de DOM cuando hay navegador simulado.

## Cobertura por riesgo

| Archivo | Comportamiento protegido |
| --- | --- |
| `auth-policy.test.ts` | Grupos de caracteres, mínimo exacto, límite de 72 bytes y Unicode. |
| `repository-auth.test.ts` | Invitación, recuperación PKCE, tokens antiguos, URL limpia incluso ante errores, consumo único, sesiones, validación y cierre global tras cambiar contraseña. |
| `repository-load.test.ts` | Pertenencia activa, carga acotada a empresa, conversiones, nulos, horas cero, fotos/correcciones por parte, archivos privados y rechazo de cargas incompletas. |
| `repository-work-orders.test.ts` | Los cuatro tipos, creación y actualización, versión esperada, urgencias, corrección auditada, ambos cierres, fotos, firma y limpieza tras fallos. |
| `repository-management.test.ts` | Clientes/máquinas por empresa, invitaciones, mensajes públicos y protección del último administrador/reasignación a través del contrato RPC. |
| `auth-screen.test.tsx` | Login personal, petición pendiente sin duplicados, recuperación, contraseñas, confirmación, errores y reintento. |
| `workspace.test.tsx` | Navegación de los tres roles, gestión de usuarios sin datos de empresa, búsqueda, historial de otro técnico, creación, guardado abierto, corrección motivada, formato de foto, ambos cierres, error recuperable de cierre, Realtime y salida de sesión. |
| `work-order-numbering.test.ts` | SQL real de la migración y el trigger: prefijo fijo PT, históricos intactos, contadores atrasados/adelantados, continuidad oficina/urgencias, lotes, rollback tras fallos, aislamiento de contadores y paso de cuatro a cinco cifras. |
| `authorization.sql` | RLS/RPC reales: empresas y técnicos, administración, urgencias, secuencia PT compartida, ambos cierres, firma ajena, inmutabilidad, auditoría y revocación. |

Las pruebas React montan `ClimaGestApp`, navegan y usan los formularios reales. Solo se simulan el repositorio y APIs ausentes de jsdom. Las pruebas del repositorio ejecutan su implementación real y simulan el cliente Supabase. No se comprueban clases CSS, snapshots masivos ni componentes vendorizados.

## Autorización real en PostgreSQL

En un equipo con Docker o Podman instalado y activo:

```bash
pnpm exec supabase start
pnpm test:permissions
```

`supabase start` prepara la instancia local con las migraciones. La suite SQL existente crea fixtures, usa los roles efectivos y revierte la transacción. Su fallo debe detener la validación de cambios de permisos. No sustituirla por aserciones sobre mocks ni dirigirla automáticamente al proyecto publicado. Los procedimientos privilegiados anteriores están documentados en `auth-setup.md`.

## Límites y mantenimiento

jsdom no comprueba disposición visual, móvil real, dibujo de canvas, envío/recepción SMTP, persistencia tras recargar ni transporte Realtime. El contexto de canvas está simulado aunque se disparan los eventos reales del componente de firma. La pantalla administrativa completa y la Edge Function todavía no tienen pruebas automatizadas de interfaz/ejecución propia; sus llamadas del repositorio y la autorización SQL sí tienen comprobaciones.

La numeración se prueba con SQL real en PGlite sobre un esquema mínimo, sin toda la infraestructura de Supabase. PGlite usa una sola conexión: comprueba lotes y rollback, pero no sustituye la prueba de concurrencia entre sesiones ni la suite completa de RLS/RPC. La migración del prefijo fijo está preparada localmente y debe aplicarse en el entorno de destino durante el despliegue autorizado.

Completar `tests/manual-smoke.md` cuando el cambio afecte esos límites. Mantener los tres roles y las dos vías de cierre en las regresiones. Una corrección debe incluir una prueba que falle antes y pase después. Evitar nuevas pruebas que solo repitan detalles internos o estilos.

Antes de entregar: `pnpm docs:check`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit --pretty false --incremental false`, `pnpm build` y `pnpm security:audit`. La auditoría mantiene un aviso alto previo sin parche en braces, documentado en `security-auth-2026-10-15.md`; no se suprime ni se considera aprobada.
