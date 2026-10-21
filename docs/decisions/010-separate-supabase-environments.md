# ADR 010: separar desarrollo y producción en Supabase

Fecha: 20 de octubre de 2026. Estado: aceptado e implantado.

## Contexto

La aplicación local y las publicadas utilizaban el mismo backend. Probar cambios podía afectar datos, usuarios, archivos o correo publicado. El usuario pidió conservar el proyecto existente y crear una copia de pruebas; eligió MarboxAI, Frankfurt y datos anonimizados con cuentas independientes.

## Decisión

Mantener `rccuxceihlxtaxwwgcfi` para producción y usar `eopawtflvgvesigciwgu` (`climagest-dev`) para desarrollo. Ambos están en la misma región y organización. No se crean ramas Git o Supabase. La cotización inicial fue 0 USD/mes en Free.

Una secuencia de migraciones versionadas define esquema, funciones, RLS, Storage y Realtime de ambos proyectos. Los cambios pasan por desarrollo y solo se aplican a producción con revisión, backup recuperable y autorización. Los datos QA forman parte del aprovisionamiento del entorno, sin añadir una migración de datos de prueba compartida. No hay promoción de filas ni sincronización bidireccional.

La exportación transforma datos en origen con SELECT y campos explícitos. Remapea identificadores con sal por exportación, sustituye contactos y texto y excluye credenciales, sesiones, configuración de correo y medios. El importador exige desarrollo recién migrado, genera credenciales aleatorias y conserva restricciones y triggers. Añade tres cuentas QA y asigna los partes abiertos de oficina al técnico de pruebas.

El frontend local y las previews rechazan producción; Vercel Production rechaza desarrollo. Los comandos de migración indican el proyecto y la escritura productiva exige repetir su referencia. Son barreras operativas, además de las autorizaciones humanas y RLS.

`config.toml` describe desarrollo local y no se sincroniza sobre producción. Auth, secretos, SMTP y despliegues de funciones se gestionan por entorno. La función bloquea invitaciones fuera de producción y solo se desplegó en desarrollo. Los despliegues productivos conservan variables y servicios actuales.

## Consecuencias

Las pruebas quedan aisladas del backend publicado. Se mantienen dos proyectos y su configuración externa a migraciones; `docs/environments.md` registra responsables, verificaciones y promoción. La copia transforma fechas, asignaciones, datos identificativos y cierres firmados: no sirve de backup o réplica exacta. El desarrollo necesita Internet; los contenedores quedan para pruebas desechables. No se automatizan migraciones al subir `main`.
