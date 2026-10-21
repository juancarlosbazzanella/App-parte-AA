# Pruebas de ClimaGest

## Aislamiento de entornos

`tests/environment-policy.test.ts` comprueba que desarrollo y previews rechazan producción, Vercel Production rechaza desarrollo, se excluyen claves de servidor, los comandos seleccionan referencias explícitas y el importador solo prepara una copia nueva para desarrollo. Comprueba también credenciales QA independientes, conservación de triggers y ausencia de mutación del snapshot. No usa credenciales ni red.

La suite SQL `tests/authorization.sql` pasó de nuevo el 21 de octubre contra `climagest-dev` mediante el CLI autenticado y revirtió todos sus fixtures. Añade casos del lector técnico: SELECT permitido, escrituras denegadas, lista privada inaccesible y sesión revocada sin acceso. Docker/Podman siguen ausentes en el Mac. La recuperación final `20261021T122122Z` pasó en un contenedor desechable del VPS: **47 tablas, 6 objetos y 24 políticas** coincidieron y pasó la suite SQL ampliada. No se reseteó ninguna base existente. Las **11 migraciones** coinciden en ambos proyectos. Véanse [entornos](environments.md) y [backups](backups.md).

`python3 -m unittest discover -s tests -p 'test_backup*.py' -v` pasa 20 pruebas del operador, incluidas siete de retención y avisos: archivos truncados o modificados, rutas fuera del backup e imagen inesperada fallan antes de SSH/Docker; se rechazan credenciales legibles por terceros y los GET de objetos usan un nonce único sin contraseña en la URL. No necesita red, credenciales ni Docker. La comprobación HTTP real confirmó sesión técnica cerrada, acceso nuevo denegado y acceso anónimo denegado. Una URL entregada previamente puede conservar una respuesta en CDN; las descargas del operador evitan reutilizarla y comprueban tamaño, ETag y SHA-256. No se promete revocar bytes ya entregados.

La comprobación de integración adicional pasó contra desarrollo real: login de tres roles, tokens de 900 segundos, rechazo anónimo, RPC de creación/cierre, evento Realtime y Storage privado con PNG sintético, incluyendo rechazo de nuevas subidas después del cierre. Se verificaron las invitaciones bloqueadas con 503 y el origen productivo rechazado con 403. Los partes y archivos temporales se eliminaron; el contador de pruebas conserva los números consumidos. La suite aislada alcanza 100 pruebas en nueve archivos.

El navegador confirmó administrador y técnico con sus datos ficticios; el técnico abrió un parte en vista compacta de 725 px, sin desbordamiento (contenido de 725 px). El acceso de oficina se verificó por API. También pasó la compilación nativa de Next.js, además de vinext, y el análisis de tipos posterior. No se da por realizada una prueba de tacto o teléfono físico.

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

La numeración se prueba con SQL real en PGlite sobre un esquema mínimo, sin toda la infraestructura de Supabase. PGlite usa una sola conexión: comprueba lotes y rollback, pero no sustituye la prueba de concurrencia entre sesiones ni la suite completa de RLS/RPC. La migración del prefijo fijo se aplicó en Supabase el 20 de octubre con autorización del usuario. A continuación pasó `authorization.sql` contra el proyecto remoto, con sus fixtures revertidos. Se confirmó que permanecen los 13 partes y el mismo checksum de sus referencias, y que el contador siguiente es 1019 con prefijo PT.

Completar `tests/manual-smoke.md` cuando el cambio afecte esos límites. Mantener los tres roles y las dos vías de cierre en las regresiones. Una corrección debe incluir una prueba que falle antes y pase después. Evitar nuevas pruebas que solo repitan detalles internos o estilos.

Antes de entregar: `pnpm docs:check`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit --pretty false --incremental false`, `pnpm build` y `pnpm security:audit`. La auditoría mantiene un aviso alto previo sin parche en braces, documentado en `security-auth-2026-10-15.md`; no se suprime ni se considera aprobada.

La retención se prueba con 500 copias ficticias y una restauración antigua: se conservan las ventanas y la copia verificada. Corrupción, ausencia de prueba o proyecto distinto bloquean cualquier borrado; directorios ajenos y enlaces no se eliminan. Un envío fallido no se registra como entregado y los repetidos no llaman a red. Los simulacros de servicios de `verify_restore.py --full-stack` son operaciones separadas y temporales; SMTP se captura dentro de la red. El mensaje operativo de activación del canal al administrador se comprobó por separado con Resend.

Los bundles de recuperación y evidencias privadas de `outputs/` quedan fuera de ESLint y TypeScript, igual que de Git; el código mantenido sigue comprobándose. Se probó aparte, en PostgreSQL desechable, la restauración de valores por defecto de solo lectura dentro de una transacción explícita de escritura. El enlace OnFailure de systemd se probó con unidades temporales y notificación de prueba deduplicada, sin interrumpir el backup real.

El 21 de octubre pasó también el simulacro de servicios recuperados descrito en `backups.md`, con Auth, REST, Storage, Edge, SMTP capturado y Realtime reales en una red desechable. El navegador verificó administrador, medios históricos, técnico móvil y cierre persistente. Esta prueba operativa requiere una copia cifrada, SSH temporal e imágenes fijadas; no forma parte de Vitest ni envía correos a destinatarios externos.
