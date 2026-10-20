# Publicación de ClimaGest

## Alojamiento existente

La aplicación se aloja en el VPS de Hostinger mediante Dokploy, con el dominio `https://partes.juancarlosbazzanella.es`. El servicio existente es `App-partes-AA`, dentro de `App Partes AA`, entorno `production`.

El 16 de octubre de 2026, tras la autorización del usuario y su acceso directo al panel, se publicó el frontend con autenticación individual. Dokploy confirmó el despliegue como **done** y el dominio público respondió correctamente por HTTPS. La carga utilizó el proveedor Drop, sin operaciones Git de escritura.

## Publicación comprobada — 16 de octubre de 2026

- Paquete publicado: `climagest-source-v3.zip`, 139 archivos y 291152 bytes, guardado en `outputs/climagest-release-2026-10-16/` junto con su manifiesto y el registro de compilación. Esa carpeta está excluida del control de versiones.
- SHA-256 del ZIP: `4b7e2335b77cdfbbc7ab7959677dc6fe1cdfb6691468af80f5ea1147301c6c7d`.
- Digest de la imagen resultante: `sha256:b6c4eb9b017ead82bbfd8ebc9f46270df6e30dfd57d6df6c0fce00ed4d7235cd`.
- Compilación remota con Railpack 0.15.4, Node 22.23.3, pnpm 11.25.0, instalación congelada y comprobación documental; despliegue terminado en 4 min 57 s.
- Dominio público: HTTP 200 con validación TLS correcta. Login personal y formulario de recuperación revisados en escritorio; login a 390 × 844 sin desplazamiento horizontal. No aparece el selector demo.
- Consulta anónima a clientes en Supabase: HTTP 401. Se conservaron el Site URL público y las seis redirecciones exactas de autenticación.
- El administrador ya había confirmado recuperación y acceso desde la versión local. No se introdujeron sus credenciales ni se solicitó un nuevo correo desde producción durante esta comprobación. La invitación completa de un nuevo destinatario real sigue pendiente.

El paquete publicado se conserva sin modificar. Las actualizaciones documentales posteriores que registran el resultado permanecen en la copia local y no requieren volver a desplegar la aplicación.

## Paquete y compilación

- Preparar un ZIP de los archivos fuente presentes en la copia de trabajo, incluidos cambios sin commit. Excluir `.git`, dependencias, compilaciones, estado de herramientas, archivos ignorados, enlaces simbólicos y todos los `.env*` salvo `.env.example`. La carga inicial con un enlace simbólico se interrumpió antes de completar la extracción.
- Conservar `CLAUDE.md` como enlace en la copia de trabajo. El ZIP omite esa entrada: `prebuild` ejecuta `scripts/prepare-deployment.mjs` para recrearla solo si falta y después mantiene `docs:check`. No se reemplazan archivos ni enlaces existentes y no se debilita la validación documental.
- Usar el proveedor **Drop** de la aplicación existente para cargar el ZIP, sin preparar commits ni hacer push. Conservar las variables de entorno y la configuración del dominio de Dokploy. Comprobar que aparece un despliegue nuevo: el aviso de aceptación no acredita una compilación correcta.
- Mantener Railpack y las políticas de pnpm 11.25.0 fijado con SHA-512, lockfile congelado y controles de suministro. No ejecutar migraciones ni cargar semillas: Supabase remoto ya está actualizado.
- `railpack.json` fija Node 22.23.3 y sustituye los comandos de instalación generados: utiliza Corepack incluido en Node 22 y pnpm fijado por el proyecto. Evita el bootstrap predeterminado de Railpack que instalaba globalmente `corepack@latest` con npm. La compilación que incluía ese bootstrap se interrumpió para corregir el plan.
- El plan se verificó con el binario oficial de Railpack 0.15.4, comprobado mediante SHA-256: selecciona Node 22.23.3, pnpm 11.25.0 e instalación congelada sin comandos npm. El ZIP no contiene `node_modules`; la comprobación local del plan puede advertir de su presencia en la copia de trabajo, que no se sube al servidor.
- Mantener el comando de inicio existente de Railpack: `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 0.0.0.0 --port 3000 --inspector-port 0`.
- Ejecutar documentación, lint, análisis de tipos limpio, pruebas de contraseña, compilación y auditoría. El aviso alto sin parche de braces sigue documentado en `security-auth-2026-10-15.md`; no desactivar la auditoría.

Las claves de SMTP y servicio permanecen en Supabase. El frontend solo requiere la URL y la clave publicable ya configuradas en Dokploy. No incluir credenciales ni registros reales en el ZIP.

## Verificación y recuperación

Antes de la actualización se confirmó que el último despliegue terminado corresponde al commit `840df0bee0c34b2745668070febd877f2042e307`, procedente de `juancarlosbazzanella/App-parte-AA`. Dokploy no tiene activada la función de rollbacks; no confundir el historial con una imagen de rollback disponible.

Si falla la compilación, conservar la instancia que sigue funcionando. Si es necesario restaurar la versión anterior, recuperar la configuración del proveedor GitHub y desplegar su estado anterior, comprobando el commit indicado. La carga directa no modifica el repositorio remoto. Guardar el ZIP publicado y su SHA-256 en los artefactos locales ignorados para repetir la actualización.

Tras el despliegue, comprobar HTTPS sin omitir validación del certificado, pantalla de acceso personal en escritorio y móvil, ausencia de selector demo y rechazo de datos anónimos. La recuperación PKCE debe solicitarse y completarse desde el mismo navegador y origen público. Mantener en Supabase las redirecciones exactas del dominio público para `auth=reset` y `auth=setup`.

El panel de Dokploy observado utiliza HTTP. Conviene configurar HTTPS para su administración; no se ha cambiado su transporte durante esta publicación.
