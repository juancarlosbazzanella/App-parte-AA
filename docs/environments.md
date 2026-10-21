# Desarrollo y producción de Supabase

Estado: 21 de octubre de 2026. Decisión: [ADR 010](decisions/010-separate-supabase-environments.md).

## Topología y responsabilidades

| Uso | Aplicación | Proyecto Supabase | Referencia |
| --- | --- | --- | --- |
| Desarrollo | localhost / 127.0.0.1, puerto 5173 | `climagest-dev` | `eopawtflvgvesigciwgu` |
| Producción | Vercel y Dokploy publicados | `App de partes` | `rccuxceihlxtaxwwgcfi` |

Ambos proyectos pertenecen a MarboxAI y están en Frankfurt (`eu-central-1`). El usuario eligió organización, región y copia anonimizada. Supabase cotizó el nuevo proyecto en **0 USD/mes**, dentro del plan Free; no se contrató un plan de pago. La cotización no garantiza precios o límites futuros.

La aplicación local se ejecuta en el ordenador; su backend de desarrollo está alojado en Supabase y necesita Internet. No se instaló Supabase en Docker. Una instancia desechable con contenedores puede añadirse para probar reconstrucciones completas.

El asistente puede preparar migraciones, aplicar cambios en desarrollo, regenerar tipos, sanear copias, verificar permisos y mantener la documentación. El propietario conserva la gestión de facturación, recuperación de cuenta, MFA, accesos, secretos y aprobación de operaciones productivas. Las operaciones Git requieren las autorizaciones específicas de `AGENTS.md`.

## Implantación

- Se creó `climagest-dev` y se ejecutaron en orden las nueve migraciones de `supabase/migrations/`, sin cambiar su SQL: esquema, funciones, índices, RLS, bucket privado y publicación Realtime.
- El historial de desarrollo conserva las versiones originales. MCP asignó marcas nuevas durante la ejecución; tras verificar los archivos exactos aplicados se alinearon **solo las versiones del proyecto nuevo**. Producción no se reparó ni se volvió a migrar.
- La copia contiene 1 empresa, 7 clientes, 8 máquinas, 14 partes y 1 corrección. Hay 7 identidades sintéticas que conservan relaciones y estados de pertenencia, y 3 cuentas adicionales para probar los roles.
- `supabase/data/export-development.sql` produce JSON saneado dentro de producción mediante una consulta SELECT. Remapea UUID con una sal aleatoria por exportación y sustituye nombres, contactos, direcciones, marcas, series, textos, horarios, fechas y horas trabajadas por valores ficticios. Conserva secuencias, tipos, estados y relaciones operativas. Es una copia de pruebas saneada, sin garantía formal de anonimización frente a toda correlación posible.
- No se exportaron contraseñas, hashes, tokens, sesiones, MFA, invitaciones, registros de acceso, claves SMTP, credenciales de servicio ni objetos de Storage. Se excluyeron fotos; los cierres mantienen su estado con motivo de omisión de firma y sin rutas a archivos reales.
- `scripts/development-snapshot.mjs` genera contraseñas aleatorias independientes y SQL transaccional. No desactiva triggers, claves foráneas ni restricciones. Reconstruye las asignaciones históricas y restaura el contador al menos al valor de origen y al mayor número más uno. Asigna los partes abiertos de oficina al técnico QA para probar su acceso.
- El importador rechaza otro destino y bases que ya contienen usuarios ajenos a la semilla o archivos. Se utiliza en proyectos nuevos; no es un refresco automático ni una herramienta de restauración de producción.
- `.env.local` apunta al proyecto nuevo con su clave publicable y permisos `0600`. Los despliegues públicos conservan sus variables anteriores.
- Desarrollo tiene registro público, acceso anónimo y enlace manual desactivados; confirmación de correo, cambio seguro y contraseñas de 15 caracteres con cuatro grupos. Site URL local y cuatro retornos exactos. Tokens de 900 segundos y rotación de refresh tokens.
- Se desplegó `climagest-invite` **solo en desarrollo**, con JWT obligatorio, CORS local y respuesta 503 para bloquear envíos. No se copió SMTP. Las cuentas `.invalid` no tienen buzón: recuperación e invitaciones por correo quedan fuera de esta puesta en marcha.

El 21 de octubre se retiraron las cuatro redirecciones locales de Auth en producción, conservando las cuatro publicadas y el Site URL. Se desplegó `climagest-invite` v3 productiva con JWT obligatorio y CORS limitado a los dos sitios publicados. Las comprobaciones devolvieron OPTIONS 204 desde ambos sitios, 403 desde localhost/127.0.0.1 y POST 401 sin JWT; no enviaron correos. CORS y las barreras de entorno no sustituyen JWT y RLS.

Ambos proyectos tienen las **11 migraciones** alineadas. `20261021114123_add_dedicated_backup_reader.sql` crea un rol de lectura para backups, inicialmente `NOLOGIN`; en producción se activó aparte con contraseña SCRAM aleatoria custodiada en la configuración privada del operador. Desarrollo conserva `NOLOGIN`. `20261021120754_add_read_only_storage_backup_identity.sql` añade una lista privada y una política SELECT de Storage para el operador técnico, sin pertenencia a empresas ni permisos de escritura. El historial y el SQL permanecen versionados en Supabase y en el repositorio, sin contraseñas en migraciones.

## Uso cotidiano

Ejecutar `pnpm dev` y abrir `http://localhost:5173`.

Las tres cuentas están en el archivo privado e ignorado `outputs/supabase-environments/development-credentials.json`: `admin@dev.climagest.invalid`, `office@dev.climagest.invalid` y `technician@dev.climagest.invalid`. Las contraseñas no se incluyen en documentación. Su pérdida requiere restablecimiento privilegiado en desarrollo; no usar cuentas de producción.

`scripts/environment-policy.mjs` bloquea producción en `pnpm dev`, Next.js dev y Vercel Preview. Vercel Production exige producción. Las compilaciones fuera de Vercel admiten ambos proyectos registrados, para conservar Dokploy y permitir verificar builds locales con desarrollo. El frontend solo admite claves `sb_publishable_`. Los valores comprobados por vinext se pasan al proceso que arranca el framework.

En otro ordenador, copiar `.env.example` a `.env.local` y obtener la clave **publicable de desarrollo**. Nunca guardar claves de servicio en variables públicas. Reiniciar el servidor al cambiar variables. `NEXT_PUBLIC_*` se incorpora al bundle: cambiar el entorno de un servidor no repara un frontend compilado con otro backend.

Los destinos sin secretos están en `supabase/environments.json`. Los comandos de esta guía ignoran el enlace persistido en `supabase/.temp/`. `config.toml` describe desarrollo local y no debe sincronizarse sobre producción con `config push`. La semilla opcional inexistente `seed.sql` se desactivó; la histórica permanece en su migración original.

Vercel conserva las credenciales productivas limitadas a Production. No se han aprovisionado Preview y Development de Vercel con nuevas credenciales. Si se habilitan, usarán `climagest-dev`; las previews necesitan además un origen estable autorizado expresamente. No descargar variables de Production sobre `.env.local`.

## Migraciones: una fuente, dos destinos

La fuente de verdad es `supabase/migrations/`. Supabase guarda el historial y las sentencias aplicadas en `supabase_migrations.schema_migrations`; no hace falta una segunda copia manual en SQL Editor. Se puede consultar:

```sql
select version, name, statements
from supabase_migrations.schema_migrations
order by version;
```

1. Crear con `pnpm db:generate -- nombre_descriptivo`, editar el archivo nuevo y documentar. No modificar migraciones ya aplicadas.
2. Revisar `pnpm db:dev:status` y `pnpm db:dev:plan`. El plan usa `--dry-run --skip-vault`.
3. Aplicar con `pnpm db:dev:migrate`. No se usan `--include-seed`, `--include-all`, resets o reparaciones automáticas.
4. Probar comportamiento y permisos, revisar avisores y comparar tipos. Cuando haya Docker/Podman, comprobar también una reconstrucción desde cero en una instancia desechable, sin resetear el desarrollo compartido.
5. Antes de producción, revisar SQL y compatibilidad con el frontend publicado, obtener backup recuperable de datos **y archivos** y probar su restauración aislada. Preferir cambios aditivos compatibles; retirar columnas después. Definir ventana y recuperación para cambios incompatibles.
6. Con autorización específica, revisar `pnpm db:prod:status` y `pnpm db:prod:plan`, y ejecutar:

```bash
pnpm db:prod:migrate --confirm-production=rccuxceihlxtaxwwgcfi
```

La confirmación técnica no sustituye la autorización del propietario. Frontend y Edge Function se publican por separado. Arrancar, compilar o subir `main` no ejecuta migraciones automáticamente.

Los wrappers requieren autenticación CLI propia con `pnpm exec supabase login` o un token de alcance limitado en el almacén de secretos. El propietario completó el login el 20 de octubre de 2026. Las nueve migraciones iniciales coincidían con ambos proyectos y el 21 se aplicaron las dos migraciones del backup primero en desarrollo y después en producción, tras probar recuperación. No guardar tokens o contraseñas en código, argumentos o variables públicas. El CLI sigue fijado en 2.117.0.

Con el CLI autenticado, verificar desarrollo con:

```bash
pnpm exec supabase db query --linked --project-ref eopawtflvgvesigciwgu --file tests/authorization.sql
pnpm exec supabase db advisors --linked --project-ref eopawtflvgvesigciwgu --type security
pnpm exec supabase gen types --project-id eopawtflvgvesigciwgu --schema public
```

Comparar antes de sustituir `src/lib/database.types.ts`: desarrollo solo difiere de la copia actual en la versión informativa PostgREST (14.18 frente a 14.17), sin cambios en el esquema público.

La instancia nueva ejecuta PostgreSQL 17.11 y producción mantiene 17.6. Ambas usan la misma versión mayor 17; no se actualizó producción. Las migraciones y la suite SQL se validaron en desarrollo. Antes de una actualización de motor productiva, revisar su changelog y probar recuperación por separado.

## Verificación realizada

Pasaron documentación, 100 pruebas en nueve archivos, lint, tipos limpios y `pnpm build`. La suite SQL completa de autorización pasó con rollback. La comprobación real de API verificó login de los tres roles y tokens de 900 segundos, denegación anónima, creación y cierre por RPC, evento INSERT recibido por el técnico mediante Realtime, subida/descarga/borrado de PNG sintético en el bucket privado y denegación de subidas tras el cierre. La función devolvió 503 al intentar invitar desde desarrollo y 403 para un origen productivo. No se enviaron correos.

También pasó `pnpm exec next build`, el motor nativo utilizado por Vercel, y se repitió el análisis de tipos sin caché. El navegador confirmó administrador y técnico, listado y detalle de parte con datos ficticios, sin errores de consola. La vista compacta del técnico midió 725 px de viewport y 725 px de contenido, sin desbordamiento; esta comprobación no sustituye una revisión completa en teléfono físico. Tras los builds se reinició el servidor de desarrollo y se cerraron las herramientas del navegador.

Se retiraron los dos partes temporales de integración y el archivo sintético: permanecen 14 partes, cero objetos de Storage y cero invitaciones. Se revocaron las ocho sesiones temporales de Node/curl de las cuentas QA, conservando las sesiones del navegador. El contador de desarrollo quedó en **1022**, sin rebobinar los números utilizados durante la comprobación. Los resultados y capturas se conservan en `outputs/supabase-environments/`, excluido de Git; los payloads de login, tokens HTTP y SQL temporal con contraseñas se eliminaron.

## Repetir una copia controlada

La copia es puntual: no hay réplica ni sincronización de filas hacia producción.

1. Revisar el exportador si hay tablas/columnas nuevas; medios, invitaciones y eventos se excluyen. Revisar también webhooks, cron, Vault e integraciones si se añaden en el futuro.
2. Ejecutar **solo SELECT** del archivo `supabase/data/export-development.sql` sobre producción mediante conector o SQL Editor. Guardar únicamente el JSON `snapshot` en un archivo local ignorado con permisos restrictivos. No volcar datos personales para sanearlos después.
3. Preparar un proyecto de desarrollo nuevo con todas las migraciones. Si se sustituye otro, preservar sus pruebas necesarias; borrar datos requiere una instrucción expresa aparte. No resetear producción.
4. Revisar la referencia, actualizar el registro y ejecutar `pnpm db:dev:prepare-copy ruta/al/snapshot.json`. Escribe en `outputs/supabase-environments/prepared/` y rechaza sobrescribir archivos previos.
5. Revisar e importar el SQL **solo en desarrollo**, indicando el destino explícitamente. La guardia SQL exige una base recién migrada y evita repetir la importación sobre las cuentas creadas. Custodiar los archivos con contraseñas y eliminarlos cuando dejen de necesitarse.
6. Configurar Auth, orígenes y función sin correo; repetir permisos, login de tres roles, partes de prueba, Storage y Realtime con medios sintéticos. No enviar correos reales durante la comprobación.

## Recuperación y acciones del propietario

El proyecto nuevo no es un backup: transforma datos y excluye medios. La recuperación de producción debe incluir backup independiente cifrado, retención, objetos privados, configuración de Auth/funciones y restauración probada. La clonación administrada requiere plan de pago y tampoco copia todos los servicios; no se contrató para este trabajo.

El propietario debe custodiar las credenciales QA, gestionar MFA y accesos mínimos en Supabase/Vercel/GitHub, y elegir y verificar la política de backup antes de futuras entregas productivas. No necesita crear el proyecto ni compartir claves de servidor por chat.

El propietario eligió inicialmente una copia local cifrada y custodiar personalmente otra copia externa; después pidió utilizar su Hostinger en lugar de instalar Docker en el Mac. Se adopta el VPS existente con Dokploy como destino para ejecutar los backups y pruebas de recuperación aisladas. La inspección de solo lectura confirmó Ubuntu 24.04.4, Docker 29.6.1, dos CPU, 8 GB de RAM (5,4 GiB disponibles) y 66 GiB libres en disco; no se contrataron recursos adicionales. Los dos proyectos de Supabase siguen siendo los backends de desarrollo y producción; esta decisión afecta a las operaciones de backup, no migra las bases de datos a Hostinger.

El backup se cifra por streaming con age, fuera de rutas web y con permisos restrictivos. El VPS guarda solo la clave pública; la clave privada de recuperación queda en el Mac. La copia final `20261021T122122Z`, descargada también al Mac, pasó la recuperación aislada: **47 tablas, 6 objetos, 24 políticas RLS y suite de autorización**, sin red ni puertos y con datos en tmpfs. La configuración disponible de Auth y la función Edge se guardaron también cifradas y se comprobó su descifrado. Esto no sustituye un simulacro de todos los servicios de un proyecto Supabase. Véase [backups](backups.md).

El propietario instaló la clave SSH temporal renovada el 21 de octubre y la conexión pasó con la huella del host verificada. Se retiró a las 14:37 de Madrid, antes de su caducidad: se eliminó exclusivamente esa clave y una conexión nueva fue rechazada. También se eliminaron su clave privada local y el comando de alta. La clave de recuperación age se conserva. No se reiniciaron los servicios existentes.

El servicio pasó su ejecución real y el temporizador diario está **activado** (03:15 de Madrid más hasta diez minutos de dispersión), con hasta dos reintentos a intervalos de quince minutos si falla. Storage usa una cuenta técnica con SELECT y sesión revocable; no se creó una clave S3 ni se conserva una clave de servicio o token personal en el VPS. Se activaron retención conservadora con recibos/hashes, avisos al correo del administrador y una comprobación horaria de antigüedad. Resend confirmó entregado el mensaje de activación. El propietario debe revisar semanalmente el resultado y custodiar otra copia fuera del VPS y del Mac y la clave separadamente. Los detalles y límites están en `backups.md` y ADR 012. Hostinger muestra un backup semanal del VPS, que no sustituye estas copias de Supabase. No se contrató otro servicio.

Siguen los avisos conocidos de protección de contraseñas filtradas no habilitada en Free y `braces` alto en herramientas de desarrollo. No se suprimieron ni relajaron controles. Véase `security-auth-2026-10-15.md`.

Referencias oficiales: [entornos](https://supabase.com/docs/guides/deployment/managing-environments), [clonación y límites](https://supabase.com/docs/guides/platform/clone-project), [backup y restauración CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Se revisó el changelog actual: no se debilita TLS y el cambio de pgcrypto en PostgreSQL 17.11 no elimina bcrypt `crypt()` utilizado en las cuentas sintéticas.

La recuperación de servicios sobre una copia productiva cifrada se comprobó en contenedores desechables del VPS, sin restaurar sobre ninguno de los dos proyectos. Incluyó las APIs, correo capturado y frontend con cierre móvil persistente; véase `backups.md`.
