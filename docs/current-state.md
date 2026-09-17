# Estado actual

Última actualización: 17 de septiembre de 2026.

## Implementado

- Autenticación de Supabase para oficina y tres técnicos de demostración.
- Gestión de clientes, máquinas y partes por parte de oficina.
- Asignación de trabajos y creación de urgencias por técnicos.
- Formulario común para instalación, mantenimiento, avería y revisión.
- Cierre con firma o motivo obligatorio de ausencia de firma.
- Historial por máquina, búsqueda, fotografías y correcciones de oficina.
- Persistencia compartida en PostgreSQL, archivos privados en Supabase Storage y actualización mediante Realtime.
- Aislamiento por empresa y permisos de oficina/técnico aplicados con RLS.
- Numeración atómica, control de edición concurrente y auditoría de correcciones posteriores al cierre.
- Migraciones reproducibles y tipos TypeScript generados desde la base remota.
- Diseño responsive para móvil, tableta y ordenador.
- Repositorio Git inicializado en la rama `main`, con secretos y artefactos generados excluidos del control de versiones.

## Límites vigentes

No hay correo real, PDF, facturación, contabilidad, nóminas, almacén, rutas ni funcionamiento sin conexión. La aplicación usa todavía una contraseña común solo para sus cuentas ficticias y no existe una suite automatizada de interfaz.

## Registro de cambios

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
- Se añadió `npm run docs:check` y su ejecución automática antes de desarrollo, lint, build y start.
- El diálogo de cierre se reinicia al montarse, evitando actualizaciones de estado dentro de un efecto.

## Regla de mantenimiento

Cada cambio debe añadir o modificar una entrada aquí. Si altera módulos o flujo de datos, también debe actualizar `architecture.md`; si introduce una decisión duradera, debe crear o sustituir un ADR numerado en `decisions/`.
