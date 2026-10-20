# ADR 008 — Prefijo fijo y contador consecutivo de partes

- Estado: aceptada; migración preparada localmente, pendiente de publicación.
- Fecha: 2026-10-20
- Amplía ADR 003 y 007; sustituye la configuración de empresa en la interfaz descrita en ADR 006.

## Contexto

El administrador podía cambiar el nombre de empresa y el prefijo de partes desde «Datos de la empresa». El usuario ha pedido retirar ese bloque y que todos los partes nuevos usen `PT-` con número consecutivo según los ya creados. La numeración debe seguir siendo segura entre oficina y técnicos, y las referencias históricas identifican documentos que no deben renumerarse.

## Decisión

- Eliminar el formulario, su estado y la operación `saveOrganization` del cliente. Renombrar la pantalla y navegación a **Usuarios**, conservando invitaciones y gestión de accesos. El estado de interfaz conserva el nombre de empresa, sin prefijo, zona horaria ni contador.
- Asignar siempre el prefijo `PT-` desde el trigger privado de PostgreSQL. Cada nueva inserción recibe un número del contador atómico por empresa, incluidos partes de oficina y urgencias. No se aceptan referencias ni números suministrados al insertar, tampoco en inserciones privilegiadas nuevas.
- Mantener cuatro cifras como mínimo: `PT-0001` a `PT-9999`, luego `PT-10000`, etc. Evitar que `lpad` trunque las cifras superiores a cuatro.
- Mantener intactas todas las referencias y secuencias históricas. La migración actualiza cada contador al mayor entre su valor actual y el máximo histórico más uno, para no retroceder ni repetir números. Los fallos de creación revierten el contador dentro de la misma transacción. Una eliminación administrativa posterior no recupera números usados.
- Conservar la columna `work_order_prefix` por compatibilidad, con valor y default `PT`, una restricción que impide otros valores y sin permiso de edición para `authenticated`. No cambian columnas ni firmas de RPC públicas, por lo que los tipos generados conservan su forma.
- Versionar el cambio en una migración nueva creada mediante Supabase CLI, sin reescribir migraciones anteriores ni aplicar cambios en remoto durante esta preparación.

## Verificación

Añadir PGlite 0.5.9 como dependencia exclusiva de desarrollo para ejecutar el SQL real de la migración y el trigger en PostgreSQL local en memoria. No requiere Docker, credenciales ni un proyecto remoto; su paquete no introduce scripts de instalación. La base de prueba contiene solo las tablas necesarias para numeración y no simula toda la autorización de Supabase. Comprueba históricos, contadores atrasados y adelantados, ambos orígenes, fallos, lotes, prefijo inmutable y números de más de cuatro cifras. PGlite usa una conexión y no demuestra concurrencia entre sesiones; el mecanismo mantiene el UPDATE atómico de PostgreSQL.

La suite completa `authorization.sql` incorpora la secuencia compartida entre urgencia de técnico y planificación de oficina. Sigue necesitando Supabase local para validar el conjunto real de RLS/RPC, sesiones y Storage. Las pruebas React verifican que la administración mantiene usuarios e invitaciones sin el bloque retirado.

## Consecuencias

La regla se aplica en la base, no depende de ocultar controles ni de calcular números en el navegador. El formulario anterior deja de estar disponible y no hay selector de prefijos. Para que la versión publicada adopte la regla hay que aplicar esta migración y desplegar el frontend en una publicación autorizada. Este cambio no autoriza operaciones Git ni crea ramas.
