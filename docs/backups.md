# Backups cifrados y recuperación

Estado: 21 de octubre de 2026. Operador: VPS existente de Hostinger; producción sigue alojada en Supabase. Decisión: [ADR 011](decisions/011-encrypted-vps-backups.md).

## Accesos mínimos

La migración `20261021114123_add_dedicated_backup_reader.sql`, aplicada primero en desarrollo y después en producción, crea `climagest_backup_reader` inicialmente `NOLOGIN`. Se le conceden `pg_read_all_data`, `BYPASSRLS` y lectura por defecto, con límites de conexión y tiempos. En producción se activó aparte con contraseña aleatoria y verificador SCRAM-SHA-256 de 16384 iteraciones. Desarrollo conserva `NOLOGIN`. El secreto no está en SQL ni en Git. El rol permite leer datos sensibles de Auth y Storage; la lectura por defecto previene accidentes, pero los privilegios heredados de `PUBLIC` siguen existiendo y no se presenta como una barrera absoluta contra cualquier escritura PostgreSQL.

La migración `20261021120754_add_read_only_storage_backup_identity.sql` añade una lista privada de identidades técnicas y una política **solo SELECT** en Storage. La función privada comprueba `auth.uid()`, la lista autorizada y la sesión real en `auth.sessions`; no confía en `user_metadata`. La tabla tiene RLS y las funciones y permisos se conceden expresamente. Los roles API no pueden modificar la lista.

El operador de archivos es `backup-hostinger@ops.climagest.invalid`, creado sin invitación ni envío de correo. No pertenece a ninguna empresa: la API no le muestra clientes, partes u organizaciones. Solo descarga objetos; no recibe políticas de creación, sustitución o borrado. Al terminar cada copia se cierra su sesión global; los tokens duran 900 segundos. Para retirarlo, desactivar su fila privada y revocar sus sesiones. La contraseña queda en la configuración privada del VPS y su copia cifrada.

Las claves S3 nativas conceden acceso completo a Storage. Se eligió una cuenta con RLS para limitar la capacidad de escritura; no se creó ninguna clave S3. El token personal de Management API y la clave `service_role` no se conservan en el VPS. Las credenciales de bootstrap se retiraron tras probar la recuperación.

## Componentes y custodia

- `scripts/backup/supabase_backup.py`: archivo PostgreSQL completo en formato custom y objetos privados, cifrados por streaming con age. No escribe un dump ni medios sin cifrar en disco.
- `scripts/backup/verify_restore.py`: descifra en el Mac y transmite por SSH con host verificado a un contenedor desechable del VPS, sin red ni puertos y con PostgreSQL en tmpfs. La clave privada no se copia al VPS.
- `scripts/backup/certs/`: certificados raíz públicos de Supabase CLI, fijados por commit y SHA-256 en `sources.json`. La conexión exige TLS `verify-full`.
- PostgreSQL `17.6.1.166`, fijado por digest en ambos scripts; age 1.3.2 descargado de su publicación oficial y contrastado con SHA-256. Python 3 y Docker completan el runtime.
- `/opt/climagest-backup/`: código, age y destinatario público. `/etc/climagest-backup/config.json`: configuración `0600`, accesible solo por root. El proceso está separado de los contenedores existentes de la aplicación.
- `/var/backups/climagest/`: copias cifradas fuera de rutas web. Se descargaron también al Mac bajo `outputs/supabase-environments/backups/`, ignorado por Git.

La clave privada de recuperación está en `outputs/supabase-environments/hostinger-private/backup-recovery.agekey`, con permisos `0600`. La entrega lista para copiar es `outputs/supabase-environments/climagest-backup-verificado-2026-10-21.tar`; incluye únicamente la copia final, la configuración cifrada del operador, informe, instrucciones y SHA-256. Excluye la clave privada. El propietario debe custodiar otra copia fuera del Mac, separada de los backups, y comprobar que puede leerla. El VPS recibe solo el destinatario público. Sin esa clave las copias no pueden descifrarse. El alta SSH temporal la ejecutó el propietario; se verifica la huella del host con `StrictHostKeyChecking=yes` y se retiró exclusivamente la clave de esta operación al terminar, conservando las demás. Una conexión nueva fue rechazada; la identidad SSH local y el comando de alta se eliminaron. Para intervenciones futuras el propietario deberá autorizar otro acceso.

## Consistencia e integridad

Se mantiene una transacción `REPEATABLE READ READ ONLY` y se exporta su snapshot. El dump, inventario y hashes de aplicación, Auth, Storage, lista privada y migraciones usan ese snapshot. El inventario incluye también configuraciones de roles; sus rutas de esquema son necesarias para arrancar Auth. El verificador restaura rutas y límites admitidos, dejando credenciales, hooks de precarga y claves JWT para el aprovisionamiento explícito del destino. Se conservan propietarios, ACL, roles sin contraseñas, pertenencias, extensiones, políticas e historial SQL. Los objetos grandes de PostgreSQL se detectan y rechazan hasta diseñar su recuperación explícita.

Cada objeto se cifra por separado. El manifiesto cifrado registra ruta, tamaño y SHA-256; se comprueban también tamaño y ETag de Storage frente al snapshot cuando existe. Las descargas usan URL única y `Cache-Control: no-cache`: se observó una respuesta CDN `HIT` para una URL ya autorizada después del logout, mientras una URL nueva quedó denegada. La revocación se valida contra origen; no se promete retirar bytes ya entregados o cacheados en clientes/CDN.

Después de descargar se compara el inventario vivo de objetos y buckets con el del snapshot. Si hubo cambios, se rechaza la copia y debe repetirse. No es un snapshot atómico distribuido: una modificación que revierta exactamente todos los metadatos podría no detectarse. Los directorios `.partial` no se anuncian como copias completas.

El backup contiene hashes y sesiones Auth y se trata como dato sensible. La configuración disponible de Auth/SMTP/OAuth y la función Edge se custodian en un complemento cifrado; se conservaron también sus versiones anteriores para rollback. Los valores que la API oculte, claves de firma y secretos administrados requieren custodia o regeneración separadas. El archivo SQL no recrea por sí solo todos los servicios de un proyecto Supabase. Tras una recuperación de plataforma se revisarán las claves de firma y sesiones antes de exponerla.

Cada copia nueva incluye además `operator-configuration.json.age` con la configuración activa del operador, cifrada para la misma clave de recuperación. Cuando cambien Auth, SMTP, proveedores o funciones, actualizar su complemento cifrado desde un ordenador autorizado. El VPS no conserva un token de Management API para refrescar esos ajustes. La aplicación y sus despliegues tienen recuperación separada en `deployment.md`.

## Restauración comprobada

Las copias anteriores al endurecimiento (`20261021T114720Z`) y con el lector PostgreSQL dedicado (`20261021T115435Z`) pasaron: 46 tablas, 6 archivos, 23 políticas RLS y `tests/authorization.sql`, con fixtures revertidos. Los informes están en `outputs/supabase-environments/hostinger-private/restore-report.json` y `restore-reader-report.json`, también copiados al VPS.

La primera copia final **`20261021T122122Z` pasó**: **47 tablas, 6 archivos y 24 políticas**, además de la suite SQL ampliada con lectura técnica, prohibición de escribir/borrar, lista privada inaccesible y pérdida de acceso tras revocar la sesión. Se verificó también que la cuenta técnica no ve clientes, partes ni organizaciones mediante REST. El informe `outputs/supabase-environments/hostinger-private/restore-final-report.json` está copiado junto al backup del VPS. Se descifraron y comprobaron también los complementos de configuración.

El contenedor de prueba limita CPU/memoria, usa `--network=none`, no publica puertos y almacena los datos en tmpfs. No arranca Auth, Storage, SMTP ni funciones. Al terminar se elimina solo el contenedor aleatorio creado por esa prueba. No se restaura sobre desarrollo ni producción. El archivo descifrado se transmite a tmpfs del contenedor, se comprueba su SHA-256 y se retira después de `pg_restore`; no se escribe un dump sin cifrar en el disco persistente. Los roles se reconstruyen con sus atributos necesarios y las políticas se comparan con `search_path=pg_catalog`, evitando diferencias textuales por contexto.

`python3 scripts/backup/verify_restore.py --help` describe sus parámetros. Una restauración SQL no sustituye un simulacro posterior de recuperación de toda la plataforma, objetos mediante su API y frontend publicado.

## Programación y revisión

`climagest-backup.service` ejecuta el operador con configuración privada, límites de tiempo y prioridad reducida. El servicio pasó y `climagest-backup.timer` quedó **habilitado y activo el 21 de octubre**: ejecución diaria a las **03:15 de Madrid**, más hasta diez minutos de dispersión. `Persistent=true` recupera una ejecución pendiente. Los fallos tienen hasta dos reintentos separados por quince minutos. La primera ejecución programada figura para el 22 de octubre a las 03:17 de Madrid; las ejecuciones manuales previas ya produjeron copias verificadas.

La retención conserva la última copia de las últimas **30 jornadas, 8 semanas y 12 meses con copias**, además de las tres más recientes, siete días mínimos y la última restauración verificada. Se ejecuta después de un backup correcto. Solo se borran directorios de este proyecto con `completed.json`, recibo completo y cifrados verificados por SHA-256; sin restauración verificada se bloquea el borrado. Los directorios antiguos desconocidos y los enlaces simbólicos no se eliminan. El operador reserva al menos 5 GiB libres para proteger el disco de la aplicación; si no quedan, falla sin publicar una copia parcial.

Los fallos finales de systemd generan correo al administrador. Una tarea horaria avisa si no hay copia completa de las últimas 36 horas. La clave Resend es independiente, solo de envío y limitada al dominio; vive en la configuración privada y su copia cifrada. No se adjuntan datos ni trazas. Cada tipo de aviso se deduplica durante 24 horas y una copia posterior avisa de recuperación. La activación se comprobó con un correo que Resend marcó **delivered**. Si el VPS está apagado o el correo/red fallan, este operador no puede avisar por sí mismo. Véase [ADR 012](decisions/012-backup-operations-and-service-recovery.md). El propietario debe revisar semanalmente:

```bash
systemctl list-timers climagest-backup.timer
systemctl show climagest-backup.service -p Result -p ExecMainStatus
journalctl -u climagest-backup.service -n 20 --no-pager
ls -lt /var/backups/climagest
```

Investigar cualquier fallo o ausencia de una copia reciente y revisar capacidad y avisos. El propietario debe guardar y verificar otra copia cifrada fuera del VPS y del Mac, con la clave custodiada aparte. El snapshot semanal de Hostinger no sustituye las copias de Supabase.

Referencias: [backup y restauración](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [rol de backup y limitaciones](https://supabase.com/docs/guides/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy-1d5783), [TLS](https://supabase.com/docs/guides/database/psql), [Storage y RLS](https://supabase.com/docs/guides/storage/security/access-control), [age](https://github.com/FiloSottile/age/releases/tag/v1.3.2).

## Simulacro de servicios

`verify_restore.py --full-stack --stack-control /ruta/privada/prueba` amplía la prueba SQL con Auth, PostgREST, Storage, Realtime, Edge y un gateway. Requiere las imágenes de `recovery-sources.json` ya descargadas y el grafo pnpm instalado. Las fuentes oficiales del gateway están fijadas por commit y SHA-256. La función Edge se recupera del complemento cifrado y se empaqueta con las dependencias fijadas del proyecto.

La red es interna, sin salida ni puertos publicados. Solo un puente local en `127.0.0.1:54399` accede por SSH con el host fijado. No se reutilizan firmas, contraseñas SMTP ni claves API productivas. Las sesiones de la copia se revocan y sus usuarios se bloquean solo en el contenedor; se crean cuentas ficticias para el simulacro. Mailpit captura los correos dentro de la red. La configuración privada de preparación queda junto a `--stack-control` con permisos 0600; el operador debe eliminarla al terminar. Un archivo nuevo `<control>.stop.json` con `status: "passed"` termina la fase de navegador; se rechazan resultados fallidos y archivos ready/stop de una ejecución anterior; hay un máximo de veinte minutos. Se eliminan únicamente los contenedores, red y archivos temporales con el identificador aleatorio de la prueba.

La copia puede contener archivos históricos cuyo formato ya no admite la política actual de nuevas subidas. El simulacro incorpora temporalmente esos MIME en los buckets de su base desechable, importa los bytes sin alterar su tipo y restablece exactamente las listas originales incluso ante un error. Después compara los objetos descargados por API con sus hashes. Esta excepción nunca se aplica al proyecto remoto.

El simulacro completo sobre **`20261021T154935Z` pasó** el 21 de octubre: 47 tablas, 24 políticas, suite SQL, 7 clientes y 14 partes originales; Auth con administrador/técnico y JWT de 900 segundos; seis objetos importados/descargados por API con SHA-256; invitación Edge capturada en Mailpit y rechazo del técnico; asignación por RPC y evento INSERT recibido por Realtime. La prueba espera la confirmación de la suscripción de PostgreSQL antes de crear el parte. El navegador cargó foto y firma históricas, verificó el técnico a 390 × 844 sin desbordamiento ni errores, cerró un parte ficticio y confirmó su persistencia tras recargar. Los dos partes de fixture, la invitación y las cuentas QA pertenecieron solo a la copia desechable. El informe privado es `restore-full-stack-report.json`. No se probaron activación de la invitación por un destinatario real, OAuth ni secretos ocultos por Supabase.
