# Estado actual

Última actualización: 20 de octubre de 2026.

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
- Diseño responsive para móvil, tableta y ordenador.
- Frontend actualizado publicado el 20 de octubre de 2026 en `https://partes.juancarlosbazzanella.es` mediante el servicio existente de Dokploy.
- Repositorio Git inicializado en la rama `main`, con secretos y artefactos generados excluidos del control de versiones.
- Gestor de dependencias migrado a pnpm 11.25.0 con versión e integridad fijadas, lockfile congelado y controles contra publicaciones recientes, fuentes transitivas exóticas y scripts de instalación no autorizados.
- Suite automatizada con Vitest y React Testing Library para acceso, contratos del repositorio, archivos privados y flujos críticos de oficina/técnico; comandos `test`, `test:watch`, `test:coverage` y `test:auth`. Véanse `testing.md` y ADR 007.
- Numeración fija `PT-` con contador atómico por empresa aplicada en Supabase, conservando referencias históricas. Pruebas SQL de numeración con PGlite y `test:numbering`, sin Docker ni credenciales, y suite completa de autorización validada en remoto con rollback. Véase ADR 008.

## Límites vigentes

La entrega y activación de una invitación a un nuevo destinatario real todavía no se han probado con SMTP. Las copias de partes por correo siguen simuladas. No hay PDF, facturación, contabilidad, nóminas, almacén, rutas ni funcionamiento sin conexión. Las cuentas demo están desactivadas. La suite React usa jsdom y no sustituye pruebas de navegador, diseño responsive o integraciones reales; la pantalla administrativa completa y la Edge Function no tienen suite de ejecución propia. La ejecución local de la suite SQL requiere Docker/Podman, ausentes en este equipo; pasó en Supabase remoto con rollback el 20 de octubre. La auditoría de dependencias mantiene un aviso alto sin parche publicado en braces, usado por herramientas de desarrollo; véase `security-auth-2026-10-15.md`. La protección contra contraseñas filtradas requiere Supabase Pro y no se ha contratado. El panel de administración de Dokploy sigue usando HTTP. Las operaciones Git de escritura requieren autorización expresa; el commit `f820af9` se entregó en `main` con permiso del usuario, que también ha autorizado subir el registro del despliegue y la alineación posterior del nombre de migración.

## Registro de cambios

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
