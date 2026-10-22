# Estado actual

Última actualización: 22 de octubre de 2026.

## Implementado

- Acceso personal con Supabase Auth y roles de administrador de empresa, oficina y técnico.
- Invitaciones, gestión de miembros y recuperación/establecimiento de contraseña. La interfaz publicada usa **Usuarios**, sin bloque de configuración de empresa.
- SMTP de Resend configurado, con dominio verificado y recuperación por correo, cambio de contraseña y acceso posterior confirmados por el administrador.
- Contraseñas de 15 caracteres con cuatro grupos exigidas por Supabase, registro público desactivado y sesiones comprobadas en base de datos.
- Gestión de clientes, máquinas y partes por parte de oficina.
- Asignación de trabajos y creación de urgencias por técnicos.
- Formulario común para instalación, mantenimiento, avería y revisión.
- Cierre con firma o motivo obligatorio de ausencia de firma.
- Historial por máquina, búsqueda, fotografías y correcciones de oficina.
- Persistencia compartida en PostgreSQL, archivos privados en Supabase Storage y actualización mediante Realtime.
- Aislamiento por empresa y permisos de administrador/oficina/técnico aplicados con RLS.
- Numeración atómica, control de edición concurrente y auditoría de correcciones posteriores al cierre.
- Migraciones reproducibles y tipos TypeScript generados desde la base remota.
- Supabase separado: producción conserva `App de partes` y desarrollo usa `climagest-dev`, en MarboxAI/Frankfurt, con copia saneada, cuentas independientes y correo bloqueado. `.env.local` y las protecciones de arranque evitan usar producción en desarrollo; migraciones con destino explícito. Véanse `environments.md` y ADR 010.
- Backups diarios cifrados de base y archivos en Hostinger, con retención, avisos al administrador y recuperación de servicios comprobada. El propietario confirmó el 22 de octubre la copia externa y la custodia separada de la clave; véase `backups.md`.
- Diseño responsive para móvil, tableta y ordenador.
- Frontend actualizado publicado el 20 de octubre de 2026 en `https://partes.juancarlosbazzanella.es` mediante el servicio existente de Dokploy.
- Despliegue de producción adicional en `https://app-parte-aa.vercel.app`, conectado a GitHub y actualizado automáticamente desde `main`, con compilación nativa de Next.js y el mismo Supabase. Véanse `deployment.md` y ADR 009.
- Repositorio Git inicializado en la rama `main`, con secretos y artefactos generados excluidos del control de versiones.
- Gestor de dependencias migrado a pnpm 11.25.0 con versión e integridad fijadas, lockfile congelado y controles contra publicaciones recientes, fuentes transitivas exóticas y scripts de instalación no autorizados.
- Suite automatizada con Vitest y React Testing Library para acceso, contratos del repositorio, archivos privados y flujos críticos de oficina/técnico; comandos `test`, `test:watch`, `test:coverage` y `test:auth`. Véanse `testing.md` y ADR 007.
- Numeración fija `PT-` con contador atómico por empresa aplicada en Supabase, conservando referencias históricas. Pruebas SQL de numeración con PGlite y `test:numbering`, sin Docker ni credenciales, y suite completa de autorización validada en remoto con rollback. Véase ADR 008.

## Límites vigentes

La entrega y activación de una invitación a un nuevo destinatario real todavía no se han probado con SMTP. Las copias de partes por correo siguen simuladas. No hay PDF, facturación, contabilidad, nóminas, almacén, rutas ni funcionamiento sin conexión. Las cuentas demo están desactivadas. La suite React usa jsdom y no sustituye pruebas de navegador, diseño responsive o integraciones reales; la pantalla administrativa completa y la Edge Function no tienen una suite unitaria sin credenciales, aunque el simulacro aislado sí ejecutó la función y comprobó el frontend. La ejecución local de la suite SQL requiere Docker/Podman, ausentes en este equipo; pasó en desarrollo remoto y en la recuperación aislada del VPS con rollback el 21 de octubre. La auditoría de dependencias mantiene un aviso alto sin parche publicado en braces, usado por herramientas de desarrollo; véase `security-auth-2026-10-15.md`. La protección contra contraseñas filtradas requiere Supabase Pro y no se ha contratado. El panel de administración de Dokploy sigue usando HTTP. Las operaciones Git de escritura requieren autorización expresa; el commit `f820af9` se entregó en `main` con permiso del usuario, que también ha autorizado subir el registro del despliegue y la alineación posterior del nombre de migración.

## Registro de cambios

### 2026-10-22 — Custodia externa confirmada y auditoría revalidada

- El propietario confirmó que ha guardado la copia externa cifrada y la clave de recuperación por separado. Se registra su confirmación, sin copiar la clave a otro servicio ni solicitar su contenido. La revisión semanal y la actualización de esa copia siguen siendo responsabilidades operativas.
- La consola autenticada de Hostinger confirmó la primera copia automática, `20261022T011935Z`, iniciada a las 03:19 de Madrid y completada a las 03:21. Los hashes de las seis copias completas pasan; backup y comprobación de salud muestran `success`, y ambos temporizadores están activos. La consulta fue de solo lectura, sin añadir claves SSH, y la consola se cerró después. No se repitió una restauración SQL de esta nueva copia: la recuperación completa verificada sigue identificada en los informes del día 21.
- Pasaron documentación, las 100 pruebas de aplicación y 20 pruebas Python, lint, tipos limpios y compilación de producción.
- La auditoría completa mantiene ocho avisos: dos bajos, cinco moderados y el alto de braces 3.0.3 en herramientas de desarrollo. La fuente oficial sigue sin versión corregida. La auditoría de dependencias de producción, con umbral alto, termina correctamente: cero altos/críticos, dos moderados y uno bajo. La auditoría completa sigue fallando; no se suprimen avisos ni se modifican dependencias o controles.

### 2026-10-21 — Entrega verificada en main y producción

- Se publicó `b7321d85947df5848132ce2954390bad64e6257d` en `main` con la autorización del propietario. Vercel confirmó Ready para `dpl_7Ta1e8jMF3uGBfXh39oVeXhcaQMn`, con el dominio productivo asignado. El bundle apunta exclusivamente a producción y la consulta anónima a clientes devuelve 401. Ambos frontends devuelven HTTP 200.
- El navegador verificó la sesión administrativa ya existente de producción, listado y vista de 390 px sin desbordamiento ni errores; no se editaron sus datos. Se conservan 7 clientes, 8 máquinas, 14 partes y 6 archivos. Desarrollo conserva sus 14 partes saneados y cero medios; ambos tienen 11 migraciones.
- La copia final `20261021T174128Z` pasó otra restauración SQL aislada: 47 tablas, seis objetos, 24 políticas y suite de autorización, con configuración de plataforma y del operador descifradas y verificadas. Sus scripts cifrados coinciden con los actuales. El simulacro de servicios y navegador se conserva en el informe de `20261021T154935Z`.
- Se retiró el acceso SSH temporal a las 19:47 de Madrid, preservando la otra clave autorizada del servidor. La conexión nueva fue rechazada; se eliminaron las identidades temporales y el comando de alta, y se cerró la consola web de esta operación.
- Los dos temporizadores están habilitados y activos; backup y comprobación de salud terminaron con estado correcto. No quedan contenedores ni redes del simulacro y la identidad de Storage no tiene sesiones activas. El paquete externo incluye la copia final, configuración cifrada, ambos informes e instrucciones; excluye la clave privada. El propietario debe copiarlo fuera del Mac/VPS y custodiar la clave por separado.

### 2026-10-21 — Cierre operativo de backups y recuperación de servicios

- El propietario autorizó expresamente `git add`, `git commit` y `git push` a `main` para los cambios revisados. También eligió el correo del administrador para los avisos.
- Se renovó el acceso temporal al VPS, manteniendo sus restricciones, caducidad y huella verificada. Al terminar se retiró exclusivamente esa clave; una conexión nueva fue rechazada y se eliminaron ambas identidades temporales locales. La clave age de recuperación se conserva.
- Se instaló `backup_operations.py`: retención de las últimas 30 jornadas, 8 semanas y 12 meses con copias, las tres copias más recientes, siete días mínimos y la última restauración verificada. Solo gestiona copias con recibo completo y hashes correctos; las copias antiguas desconocidas no se borran.
- Las 20 pruebas Python del operador pasan, incluidas corrupción, ausencia de restauración, enlace simbólico, proyecto ajeno y fallo de envío. La retención se ejecuta después de un backup correcto y no ha borrado copias del día.
- Se configuró una clave de Resend independiente, de envío y limitada al dominio. El propietario completó su creación; no se copió una clave personal ni la credencial SMTP de Supabase. Resend confirmó **delivered** para el mensaje de activación. El aviso no adjunta datos ni errores privados. Se deduplica por incidente y día y el canal tiene comprobación horaria de antigüedad máxima de 36 horas.
- El simulacro detectó y corrigió la ausencia de `rolconfig` en el inventario. Se incorporaron las rutas de esquema de Auth y límites de roles; las copias incluyen también la configuración activa del operador cifrada. La transferencia de SQL a tmpfs valida SHA-256 antes de `pg_restore`. El enlace OnFailure de systemd pasó una prueba aislada con aviso deduplicado.
- El verificador rechaza archivos de control de otra ejecución y resultados de navegador fallidos para evitar validar una recuperación con evidencias antiguas.
- El gateway desechable utiliza el alias DNS oficial de Realtime, necesario para que resuelva su servicio y tenant.
- La importación de firmas SVG históricas amplía temporalmente solo la lista MIME de los buckets desechables y la restablece exactamente en `finally`, incluso si falla una subida. No cambia Storage productivo.
- Pasó el simulacro de servicios sobre `20261021T154935Z`: 47 tablas, 24 políticas, suite SQL, Auth de administrador/técnico, REST, seis objetos por API con SHA-256, invitación Edge, rechazo del técnico y un correo capturado en Mailpit. Realtime recibió el INSERT después de confirmar la suscripción a PostgreSQL. Todo usó red interna sin salida ni puertos publicados y claves nuevas.
- El navegador verificó administrador, parte histórico con foto y firma cargadas, y técnico a 390 × 844 sin desbordamiento ni errores de consola. Cerró el parte ficticio y confirmó su persistencia tras recargar. Se cerraron ambas sesiones de navegador; los datos de estas pruebas solo existieron en el contenedor desechable.
- Pasaron las 100 pruebas de aplicación, 20 pruebas Python, lint, tipos limpios y compilaciones vinext/Next.js. La auditoría conserva los ocho avisos conocidos, incluido braces alto sin parche. La custodia externa corresponde al propietario.


### 2026-10-21 — Entornos separados y backup cifrado activo

- El propietario instaló la clave renovada y la conexión SSH pasó con la huella del host fijada. Se verificaron recursos suficientes, sin reiniciar servicios existentes. Al cerrar la intervención se retiró exclusivamente esa clave del VPS y se verificó el rechazo de una conexión nueva. Se eliminaron la identidad SSH local y el comando de alta; la clave age se conserva.
- Se instalaron scripts de backup y recuperación, certificados oficiales de Supabase y una imagen PostgreSQL fijada por digest. La clave privada de age permanece en el Mac y el VPS recibe solo el destinatario público. La copia final `20261021T122122Z` pasó la restauración: **47 tablas, 6 objetos, 24 políticas RLS y suite de autorización ampliada**, con red aislada y datos en tmpfs. Hay copia cifrada en VPS y Mac; se comprobó también el descifrado de la configuración disponible de Auth y la función Edge. No se presenta como un simulacro completo de todos los servicios de Supabase.
- Las **11 migraciones** coinciden en ambos proyectos. Las dos nuevas se aplicaron primero en desarrollo y después en producción. El lector PostgreSQL permanece `NOLOGIN` en desarrollo y usa una contraseña SCRAM aleatoria fuera de migraciones en producción. Storage usa una cuenta técnica sin acceso a la aplicación y con política SELECT, lista privada y sesión revocable; no se creó una clave S3. Se retiraron los secretos de bootstrap. Las descargas usan nonce y validan ETag, tamaño y hash para evitar respuestas CDN antiguas.
- Se retiraron cuatro retornos locales de Auth productivo y se desplegó la función v3 con JWT obligatorio. Se verificaron ambos sitios publicados con OPTIONS 204, localhost/127.0.0.1 con 403 y POST sin JWT con 401, sin enviar correos. Auth y función anteriores quedaron cifradas para recuperación.
- El servicio terminó correctamente y el temporizador diario está **habilitado y activo** a las 03:15 de Madrid, con hasta diez minutos de dispersión y dos reintentos limitados. No hay borrado automático ni alertas externas. El propietario debe custodiar otra copia cifrada fuera del VPS y del Mac y su clave separadamente, y revisar semanalmente el resultado. No se ejecutaron operaciones Git de escritura. Véanse `backups.md` y ADR 011.
- Se actualizó Vite de 8.0.16 a **8.1.6**, publicado hace más de siete días, por nuevos avisos de seguridad; instalación congelada y controles de pnpm conservados. Pasaron las 100 pruebas, lint, tipos limpios y compilaciones vinext y nativa de Next.js. La auditoría vuelve a los ocho avisos conocidos: dos bajos, cinco moderados y uno alto sin parche en braces; sigue fallando y no se ha suprimido.

### 2026-10-21 — Acceso temporal renovado para Hostinger

- A petición del propietario se generó una nueva clave SSH de cuatro horas, válida hasta las 17:26 de Madrid. La clave privada y el comando de instalación permanecen en el directorio ignorado `outputs/supabase-environments/hostinger-private/`, con permisos restrictivos.
- El comando actualizado retira exclusivamente la clave anterior identificada por su contenido público, conserva las demás y añade la nueva con restricciones de reenvío y PTY. Su ejecución por el propietario y la comprobación de acceso siguen pendientes; todavía no hay backup recuperable ni tarea periódica.

### 2026-10-20 — VPS inspeccionado y acceso temporal preparado

- Tras iniciar sesión el propietario, se abrió la consola web HTTPS de Hostinger. La inspección de solo lectura confirmó Ubuntu 24.04.4, Docker 29.6.1, 66 GiB libres y 5,4 GiB de RAM disponibles. Se reconocieron la aplicación publicada, Dokploy y automatizaciones existentes, sin reiniciarlos ni modificarlos. No se contrató ningún servicio.
- La huella SSH se verificó contra la consola autenticada. Se prepararon una clave temporal de cuatro horas y un comando de alta, con archivos privados bajo `outputs/`, excluidos de Git. El propietario debe ejecutar el alta; no se ha añadido aún esa clave al VPS. Se retirará al acabar la operación.
- Los backups cifrados, la restauración aislada y la programación siguen pendientes. Tampoco se modificaron datos o configuración de producción ni se ejecutaron operaciones Git de escritura.

### 2026-10-20 — Backups previstos en el VPS de Hostinger

- El propietario pidió usar Hostinger en lugar de instalar Docker en su Mac. Se orienta el backup y la restauración de prueba al VPS existente con Dokploy; los dos proyectos de Supabase conservan sus funciones actuales. Se prevén copias cifradas, clave separada, permisos restrictivos y una segunda copia fuera del VPS; aún no se ha generado un backup recuperable ni activado tareas periódicas.
- Se abrió hPanel y se comprobó que requiere iniciar sesión de nuevo. Este Mac no tiene configuración SSH ni identidades cargadas en el agente. El siguiente paso guiado es el acceso del propietario a Hostinger y la inspección de su VPS mediante el panel o consola web. No se reinstaló ningún servidor, no se modificó la aplicación pública y no se ejecutaron operaciones Git de escritura.

### 2026-10-20 — Acceso CLI confirmado y preparación guiada del backup

- El propietario completó la autorización del CLI de Supabase. `projects list` reconoce los dos proyectos de MarboxAI y pasaron los wrappers `db:dev:status` y `db:prod:status`: las nueve versiones locales y remotas coinciden en ambos entornos. No se aplicaron migraciones.
- Se eligió copia local cifrada y custodia de otra copia externa por el propietario. El backup y su prueba de recuperación siguen pendientes: no hay Docker/Podman ni clientes PostgreSQL en este Mac Apple silicon. Se continúa paso a paso con la instalación oficial de Docker Desktop y su aceptación de condiciones por el propietario. No se pidió ni se mostró el token del CLI.
- Un intento controlado de volcado de esquema, usando el proyecto explícito y un directorio temporal privado, falló por la ausencia de Docker. El archivo quedó vacío y el directorio se eliminó automáticamente. El diagnóstico confirma el requisito local; no se ha generado todavía un backup recuperable ni se han exportado datos de clientes.
- La retirada de retornos locales y el despliegue de la función endurecida de producción siguen pendientes. No se ejecutaron operaciones Git de escritura ni cambios en los datos de producción durante esta comprobación.

### 2026-10-20 — Separación de desarrollo y producción

- Tras elegir el usuario MarboxAI, Frankfurt y copia anonimizada, Supabase cotizó 0 USD/mes y creó `climagest-dev` (`eopawtflvgvesigciwgu`). El proyecto actual `rccuxceihlxtaxwwgcfi` conserva producción; no se escribieron datos o configuración productivos.
- Se reprodujeron las nueve migraciones sin editar su SQL y se alinearon las versiones originales solo en el nuevo historial tras verificar los archivos aplicados. La copia SELECT saneada conserva 7 clientes, 8 máquinas, 14 partes y 1 corrección con IDs nuevos, 7 identidades sintéticas y 3 cuentas QA. Excluye datos personales, credenciales, sesiones, invitaciones, eventos y medios reales. Los partes abiertos de oficina se asignan al técnico QA y los cierres firmados indican omisión de firma.
- Se añadieron registro de destinos, wrappers de migración, exportador saneado y preparador de importación transaccional para un proyecto nuevo. No desactivan triggers ni restricciones. Se configuró `.env.local` para desarrollo y se reinició el servidor local. El arranque y Next.js protegen desarrollo/previews; el CLI usa referencias explícitas y exige confirmación técnica adicional para producción.
- Auth de desarrollo tiene registro cerrado, política robusta, retornos locales exactos y sesiones separadas. Se desplegó la función con JWT y correo bloqueado solo en desarrollo, sin copiar SMTP. El código productivo de la función y sus retornos remotos quedan pendientes de endurecimiento posterior; no se han redeplegado.
- Pasó la suite SQL completa de autorización en desarrollo con rollback. Los avisores solo mantienen protección de contraseñas filtradas no habilitada en Free. Los tipos públicos coinciden; la diferencia informativa es PostgREST 14.18 frente a 14.17. La auditoría sigue con los ocho avisos conocidos, incluido `braces` alto sin parche; no se cambian dependencias ni controles.
- Pasaron documentación, las 100 pruebas, lint, tipos y build. La integración real verificó los tres roles y tokens de 900 segundos, denegación anónima, creación/cierre por RPC, Realtime y Storage privado con imagen sintética, bloqueo de archivos cerrados y de invitaciones/cross-origin. Se retiraron dos partes temporales y el archivo; quedan 14 partes y contador 1022 en desarrollo. El navegador confirmó administrador y datos ficticios. PostgreSQL es 17.11 en desarrollo y 17.6 en producción, sin actualizar el motor productivo.
- Pasó también el build nativo de Next.js y la comprobación posterior de tipos. El navegador confirmó el técnico, listado y detalle a 725 px sin desbordamiento, sin errores de consola; oficina se comprobó por API. Se restauró la ventana normal y se dejó el servidor local con desarrollo. La lectura final de producción conserva 7 clientes, 8 máquinas, 14 partes, 6 objetos, 9 migraciones y contador 1020.
- Se revocaron las ocho sesiones temporales de integración Node/curl de las cuentas QA, conservando las del navegador. Se eliminaron los payloads de login, tokens HTTP y SQL de importación con contraseñas; las tres credenciales QA permanecen en su archivo ignorado `0600`, dentro de una carpeta `0700`.
- El CLI de este ordenador no tiene sesión; el conector autenticado permitió las operaciones remotas. Los archivos con contraseñas y evidencias permanecen ignorados con permisos restrictivos. No se hicieron operaciones Git de escritura ni publicaciones productivas. El runbook registra límites, promoción, backups y responsabilidades del propietario.

### 2026-10-20 — GitHub conectado a Vercel y despliegue de producción

- Se creó `app-parte-aa` en Vercel, conectado a `juancarlosbazzanella/App-parte-AA` y `main`, desde el commit `e2e1aef`. Vercel confirmó **Ready** y asignó `https://app-parte-aa.vercel.app`. El usuario autorizó instalar la aplicación oficial de GitHub solo para este repositorio y completó la verificación por correo.
- El proyecto remoto usa Next.js nativo, Corepack, pnpm 11.25.0 e instalación congelada, conservando los controles de suministro y los comandos vinext existentes. La preferencia Node.js 22.x queda sobreescrita por el rango del repositorio: el despliegue efectivo usa 24.x, con aviso de actualización automática. No se cambian dependencias.
- Las dos variables públicas de Supabase se limitaron a Production. Se añadieron dos redirecciones exactas de autenticación y `CLIMAGEST_APP_ORIGIN` para admitir el dominio estable en las invitaciones. Se alineó la lista local de `supabase/config.toml`, conservando el Site URL remoto, dominios y orígenes anteriores, sin comodines para previews.
- Se verificaron HTTPS 200, login y recuperación en navegador sin errores de consola, móvil a 390 × 844 sin desbordamiento, rechazo anónimo de `clients` con 401 y CORS de invitaciones con 204 para ambos dominios y 403 para un origen ajeno. No se enviaron correos ni se crearon datos. El acceso autenticado con una sesión nueva desde Vercel queda fuera de esta verificación.
- Pasaron instalación congelada, las 93 pruebas, lint, tipos y ambas compilaciones. Se limpió `.next/` antes de la comprobación final para retirar tipos residuales incompatibles entre Next.js nativo y vinext; el procedimiento queda documentado. La auditoría mantiene los ocho avisos conocidos, incluido `braces` alto sin parche. La documentación y la configuración local quedan sin stage; no se ejecutaron operaciones Git de escritura, migraciones ni cambios de DNS.

### 2026-10-20 — Sincronización autorizada tras la publicación

- El usuario autorizó subir todos los cambios pendientes a `main`: registro del despliegue, alineación del nombre de migración con la versión remota y referencias documentales y de prueba.
- La migración renombrada conserva exactamente el SQL ya publicado. Esta sincronización no cambia el comportamiento de la aplicación ni requiere volver a aplicar la migración o desplegar el frontend.
- Los paquetes, capturas, comprobaciones HTTP y credenciales permanecen excluidos del repositorio.

### 2026-10-20 — Migración autorizada y publicación completada

- El usuario autorizó aplicar la migración y publicar el frontend después de subir el commit `f820af9` a `main`. Se accedió al mismo servicio de Dokploy tras el inicio de sesión del usuario, conservando proveedor Drop, Railpack 0.15.4, variables y dominio.
- Supabase MCP aplicó `fixed_work_order_numbering` con versión `20261020105413`. Se alinearon el archivo local y las referencias documentales/de prueba con la marca registrada, sin modificar el SQL ni volver a aplicar la migración.
- La comprobación anterior y posterior confirma los mismos 13 partes, máximo 1018, checksum de referencias/secuencias `2d03cc206f26c62a24712964104e67e7` y contador siguiente 1019. El prefijo es PT, la restricción está activa y `authenticated` no puede cambiarlo.
- La suite completa `tests/authorization.sql` pasó contra Supabase remoto y revirtió sus fixtures. Los avisores de seguridad solo mantienen el aviso conocido de protección de contraseñas filtradas, no contratada en el plan Free.
- Durante el despliegue no se ejecutaron nuevas operaciones Git de escritura; el usuario autorizó después la subida de la alineación de versión y este registro.
- Dokploy confirmó **Done** tras 6 min 38 s. El ZIP `climagest-f820af9.zip` contiene 154 archivos y 332574 bytes, con SHA-256 `183279e5857c78130e7e615d0017de6c389bb26d3ad71f3537d03377e209922f`; se conserva junto con el manifiesto y las capturas en `outputs/climagest-release-2026-10-20/`.
- Se verificaron HTTP 200, TLS válido, nuevo bundle público, consulta anónima de clientes rechazada con 401 y administración autenticada con **Usuarios** sin el bloque retirado. La pantalla móvil a 390 × 844 no desborda horizontalmente. Las 93 pruebas pasaron también tras alinear el nombre de la migración. No se crearon partes operativos, no se modificaron miembros ni se enviaron correos en esta comprobación.

### 2026-10-20 — Entrega autorizada al repositorio en main

- Tras revisar la vista previa, el usuario autorizó subir los cambios al repositorio. La entrega usa exclusivamente `main`, sin crear ramas, e incluye los cambios pendientes de autenticación individual, pnpm, pruebas automatizadas y prefijo fijo PT de los que depende la versión actual.
- Se comprobó que el remoto `origin` corresponde a `juancarlosbazzanella/App-parte-AA` y que su `main` coincide con la base local. Se revisaron los archivos pendientes para excluir credenciales, archivos de entorno, datos reales y artefactos generados; las tres migraciones renombradas conservan su contenido original.
- Esta autorización se limita a la entrega al repositorio. No aplica la migración en Supabase remoto ni despliega automáticamente el frontend en el alojamiento existente.

### 2026-10-20 — Reglas Git, usuarios sin configuración y prefijo PT fijo

- Se estableció en `AGENTS.md` el trabajo exclusivo en `main`: no crear otras ramas sin instrucción explícita. Se reforzó la prohibición de `git add`, `git commit`, `git push` y de cualquier subida al repositorio sin autorización específica para cada operación. `CLAUDE.md` conserva su enlace simbólico; no se ejecutaron operaciones Git de escritura ni se creó ninguna rama.
- Se retiraron **Datos de la empresa**, su estado y el método de guardado. La navegación y pantalla se llaman **Usuarios**, manteniendo invitaciones y permisos. El cliente ya no carga prefijo, zona horaria ni siguiente número; el nombre de empresa sigue visible en la cabecera.
- La migración `20261020105413_fixed_work_order_numbering.sql`, creada mediante Supabase CLI, fija el prefijo `PT-` en el trigger y continúa desde el contador vigente o el mayor `sequence_number` histórico más uno. Conserva referencias anteriores y contadores adelantados, comparte secuencia entre oficina/urgencias, revierte el contador si falla la creación y no trunca cifras a partir de 10000. Se fija la columna de compatibilidad a `PT` y se revoca su edición por usuarios autenticados; las columnas y tipos públicos no cambian.
- Se añadió PGlite 0.5.9 solo para desarrollo, respetando la antigüedad mínima y sin scripts de instalación nuevos, para probar el SQL real en PostgreSQL en memoria. Pasan 93 pruebas en ocho archivos, con 12 casos de numeración y una regresión de administración sin datos de empresa. La suite SQL completa incorpora comprobaciones de numeración consecutiva entre roles; no se ha ejecutado sin Supabase local.
- Los cambios están preparados en la copia de trabajo de `main`. La migración y el frontend no se han publicado ni aplicado en Supabase remoto. El despliegue autorizado debe incluir ambos para activar la regla en la aplicación publicada.
- Pasaron documentación, las 93 pruebas, tipos y build. La auditoría conserva los ocho avisos conocidos, incluido braces alto sin parche; no se relajó ningún control de instalación. El informe generado de cobertura queda excluido del lint para evitar avisos sobre sus scripts auxiliares.

### 2026-10-20 — Pruebas de comportamiento crítico

- Se añadieron Vitest 5.0.4, React Testing Library, user-event, jsdom y cobertura V8 con versiones fijas, respetando la antigüedad mínima, el bloqueo de fuentes exóticas y las autorizaciones existentes de scripts. La configuración de pruebas evita el entorno y los plugins de despliegue, simula el cliente Supabase y bloquea fetch.
- Se migraron las tres pruebas de contraseña al runner común y se amplió la suite a 81 casos en siete archivos: enlaces de acceso y sesiones, mapeo de datos, clientes/máquinas, invitaciones, versiones concurrentes, fotos y firmas, correcciones, ambos cierres, navegación por rol, búsqueda, historial, formularios y ciclo de sesión/Realtime.
- Una prueba nueva reprodujo el rechazo no gestionado del cierre de un parte: el diálogo ahora muestra el error, conserva la firma o el motivo y permite reintentar. No se cambiaron esquema, RLS ni datos remotos.
- Se documentaron los comandos, la matriz de cobertura y sus límites, manteniendo la suite SQL de permisos como comprobación separada y las pruebas manuales para navegador e integraciones. El enlace simbólico `CLAUDE.md` se conserva.
- Pasaron las 81 pruebas con cobertura, documentación, lint, análisis de tipos limpio, instalación con lockfile congelado y compilación de producción. El repositorio alcanza un 92,3 % de líneas cubiertas; el informe total solo incluye los cuatro módulos declarados en `vitest.config.ts`, no toda la aplicación. La compilación mantiene los avisos previos de tamaño de chunk y clasificación de rutas de vinext. La suite SQL no se repitió: Supabase CLI confirmó que faltan Docker y Podman. La auditoría repitió los ocho avisos anteriores (dos bajos, cinco moderados y uno alto sin parche en braces), sin nuevos avisos ni supresiones.

### 2026-10-16 — Publicación autorizada completada

- El usuario autorizó la publicación del frontend actualizado en el dominio existente. Se identificó el servidor actual mediante Hostinger y Dokploy, conservando el alojamiento existente.
- El usuario autenticó el panel de Dokploy y habilitó temporalmente el acceso de la extensión a URLs de archivo. Se publicó la copia local mediante carga directa ZIP, sin operaciones Git de escritura. Dokploy confirmó el despliegue como done.
- Se actualizaron README y arquitectura con la recuperación SMTP ya comprobada.
- Se detectó que la extracción ZIP se interrumpía antes de completar los archivos al alcanzar el enlace de la guía. El paquete de transporte omite enlaces; `prebuild` reconstruye solo `CLAUDE.md` si falta y conserva la validación estricta posterior. El enlace original de la copia de trabajo no se sustituye.
- Se interrumpió la compilación al detectar el bootstrap predeterminado de Railpack con npm y `corepack@latest`. El plan versionado de instalación fija Node 22.23.3 y usa su Corepack incluido para activar pnpm desde la versión e integridad del proyecto, manteniendo lockfile congelado y políticas de suministro.
- Se comprobó el plan corregido con Railpack 0.15.4 oficial, verificando su SHA-256. El plan ya no incluye comandos npm y conserva la versión e integridad de pnpm, el lockfile congelado y el comando de inicio del servicio existente.
- La compilación y el despliegue remotos finalizaron correctamente con ese plan. El paquete, SHA-256, digest de imagen y procedimiento se registran en `deployment.md` y los artefactos locales ignorados.
- Se verificaron HTTP 200, certificado HTTPS válido, login y recuperación en escritorio, login móvil a 390 × 844 sin desplazamiento horizontal y rechazo anónimo de clientes con HTTP 401. No se introdujeron credenciales ni se solicitó un nuevo correo desde producción.

### 2026-10-16 — Dominio y SMTP de autenticación

- El usuario añadió en Hostinger el TXT y los dos CNAME indicados por Resend. El panel de Resend confirmó el dominio como Verified.
- El usuario creó la clave de envío y la introdujo directamente en Supabase, que confirmó el guardado de SMTP personalizado. La clave no se compartió en el chat ni se guardó en el repositorio.
- El administrador confirmó la recepción del correo, el cambio de contraseña y el acceso posterior tras solicitar y abrir un nuevo enlace en el mismo navegador. Una consulta de solo lectura confirmó correo validado, cuenta habilitada, inicio de sesión reciente y membresía activa con rol administrador.
- La prueba dejó documentado que la recuperación PKCE se completa en el navegador desde el que se solicita. La versión local requiere mantener el servidor activo en el mismo ordenador; los accesos externos requieren publicar el frontend actualizado.
- Pasaron de nuevo la comprobación documental, lint, el análisis de tipos limpio, las tres pruebas de contraseña y la compilación de producción. La auditoría confirmó los mismos ocho avisos (dos bajos, cinco moderados y uno alto sin parche en braces); no se ha suprimido ninguno.

### 2026-10-15 — Acceso personal y autorización por empresa

- Se ampliaron el esquema y los tipos con el rol administrador y se aplicaron las migraciones en Supabase remoto. Tras comparar el SQL normalizado, se alinearon los nombres de todos los archivos de migración con las versiones reales registradas en remoto, sin modificar el historial ni su contenido.
- Se sustituyeron el selector y las credenciales demo por login vacío, recuperación y establecimiento de contraseñas individuales; se desactivaron definitivamente las membresías ficticias, se bloquearon sus cuentas Auth y se rotaron sus claves a valores aleatorios desconocidos, revocando sus sesiones.
- Se añadieron usuarios y configuración de empresa para administradores, con invitaciones mediante Edge Function, auditoría, protección del último administrador y reasignación previa de técnicos.
- Se limitaron clientes, máquinas e historial del técnico; las urgencias no amplían permisos. Se validan membresías activas y sesiones existentes incluso al usar tokens antiguos, también al consultar o editar el perfil personal.
- Se revocaron escrituras directas en partes; los cierres de técnico, oficina y administrador usan operaciones privadas comprobadas. Las correcciones exigen motivo y mantienen firma y cierre originales; los archivos cerrados no se pueden sustituir.
- Se acortaron las URLs de archivos privados a dos minutos, renovadas durante su visualización, y se rechazaron formatos distintos de JPEG, PNG y WebP para nuevas imágenes.
- Se configuraron en el panel remoto el registro por invitación, la política fuerte de contraseñas, cambio seguro, tokens de acceso de quince minutos y seis redirecciones exactas. El administrador inicial se provisionó de forma privada; SMTP queda pendiente de dominio/clave del proveedor.
- Se añadieron pruebas de contraseña y SQL con rollback; pasaron ambos cierres, aislamiento, denegaciones y revocación. Se verificaron login real, administración en escritorio y técnico/cierre en móvil con fixtures aislados.
- Se actualizaron Next, React, Vite y dependencias transitivas vulnerables manteniendo pnpm fijado, instalación congelada y la antigüedad mínima. No quedan avisos críticos; queda un aviso alto sin corrección disponible en herramientas de desarrollo, documentado sin suprimirlo.
- Se mantuvo el desarrollo limitado a la interfaz IPv4 local para permitir pruebas del navegador. La documentación operativa está en `auth-setup.md`; la decisión, en ADR 006.

### 2026-09-23 — Auditoría de seguridad y migración a pnpm

- Se auditó la aplicación, Supabase, Storage, RLS, autenticación, dependencias y el despliegue público; los hallazgos y correcciones propuestas quedaron registrados en `docs/security-audit-2026-09-23.md`.
- Se adoptó pnpm 11.25.0 como único gestor, fijando también su integridad SHA-512 y sustituyendo el lockfile de npm.
- Se añadieron una antigüedad mínima de siete días para nuevas versiones, bloqueo de fuentes transitivas exóticas, scripts de instalación autorizados explícitamente y un comando de auditoría de dependencias.
- Se documentó la decisión en el ADR 005 y se actualizaron las guías operativas sincronizadas.

### 2026-09-17 — Autorización obligatoria para operaciones Git

- Se añadió a la guía canónica de agentes la prohibición de ejecutar `git add`, `git commit` o `git push` sin autorización explícita del usuario para esa operación.
- La misma regla se aplica automáticamente a `CLAUDE.md`, que continúa siendo un enlace simbólico a `AGENTS.md`.
- Las solicitudes de edición, implementación, prueba o revisión no se consideran autorización implícita para preparar, confirmar o publicar cambios.

### 2026-09-17 — Inicio del historial Git

- Se preparó el primer commit con el código, las migraciones, la documentación y la configuración reproducible del proyecto.
- Se mantuvieron fuera del repositorio las credenciales locales, las dependencias, las compilaciones y las cachés de herramientas.
- Se conservó `.env.example` como referencia segura de las variables necesarias.

### 2026-09-17 — Migración completa a Supabase

- Se creó el esquema multiempresa con perfiles, miembros, clientes, máquinas, partes, fotografías y correcciones.
- Se añadieron restricciones de integridad, índices, numeración atómica, versiones optimistas y funciones transaccionales para crear, actualizar, cerrar y corregir partes.
- Se activó RLS en todas las tablas públicas y se definieron políticas específicas para oficina, técnicos e historial por máquina.
- Se configuró el bucket privado `work-order-files` y políticas de Storage para fotografías y firmas.
- Se sustituyó IndexedDB por el repositorio Supabase y se añadió autenticación, URLs firmadas y sincronización Realtime.
- Se cargaron cuatro usuarios, cinco clientes, siete máquinas, once partes, firmas y una fotografía de demostración.
- Se verificaron inicio de sesión, visibilidad por rol, denegación de escrituras, alta urgente, actualización, cierre y auditoría de correcciones.

### 2026-09-16 — Segunda pasada de interfaz operativa

- Se mantuvo intacta la paleta cromática y se reforzaron tipografía, espaciado, radios y profundidad de las superficies.
- El listado de partes incorpora un resumen de abiertos, trabajos para hoy y cerrados, además de separar visualmente los partes abiertos del historial cerrado.
- Se unificaron las fichas de clientes y máquinas, los buscadores, las cabeceras de página y la presentación del detalle de un parte.
- El formulario común se organiza ahora en tres pasos visibles: planificación, contenido técnico y fotografías.
- La pantalla de acceso presenta con mayor claridad los perfiles de prueba y las credenciales preparadas.
- Cada cambio de pantalla restablece el desplazamiento para que el encabezado y la acción principal siempre aparezcan completos.
- No se modificaron la paleta, los datos, los permisos, la navegación ni las reglas de negocio.

### 2026-09-16 — Refinamiento visual de la aplicación

- Se mantuvo la paleta existente y se mejoraron jerarquía tipográfica, espaciado y densidad visual.
- Los partes usan ahora filas más compactas con separación clara entre identidad, estado y planificación.
- Se simplificaron acceso, navegación, buscadores, fichas de clientes y máquinas, detalles y formularios.
- Se reforzaron los estados de foco y la adaptación de acciones y metadatos entre móvil y escritorio.
- No se modificaron permisos, datos, navegación ni reglas de negocio.

### 2026-09-16 — Estructura y gobierno documental

- Se trasladó el código ejecutable a `src/` y se reservó `tests/` para las comprobaciones.
- Se añadieron la arquitectura, el estado del proyecto y los ADR de persistencia y autenticación.
- `CLAUDE.md` quedó enlazado simbólicamente a `AGENTS.md` para mantener ambos idénticos.
- Se añadió la comprobación documental y su ejecución automática antes de desarrollo, lint, build y start.
- El diálogo de cierre se reinicia al montarse, evitando actualizaciones de estado dentro de un efecto.

## Regla de mantenimiento

Cada cambio debe añadir o modificar una entrada aquí. Si altera módulos o flujo de datos, también debe actualizar `architecture.md`; si introduce una decisión duradera, debe crear o sustituir un ADR numerado en `decisions/`.
