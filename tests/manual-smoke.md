# Pruebas manuales esenciales

Ejecutar estas comprobaciones tras cambios funcionales o visuales:

1. Entrar con cuentas individuales de los tres roles y confirmar que cada técnico solo lista sus trabajos.
2. Crear y asignar un trabajo desde oficina; crear una urgencia desde técnico.
3. Guardar un parte abierto y cerrarlo primero con firma y después sin firma, exigiendo motivo.
4. Confirmar que el técnico no edita un parte cerrado y que oficina/administrador sí pueden corregirlo con motivo obligatorio, sin cambiar la firma ni el cierre originales.
5. Abrir el historial de una máquina y comprobar partes cerrados de distintos técnicos.
6. Buscar por cliente, marca, modelo, número de serie y dirección.
7. Adjuntar una foto, recargar y confirmar que datos, foto y firma persisten mediante URLs privadas firmadas.
8. Abrir dos sesiones, modificar un parte y comprobar que la otra sesión recibe la actualización.
9. Intentar desde técnico editar un cliente o un parte ajeno y confirmar que Supabase lo rechaza.
10. Usar **Sincronizar datos** y verificar que no borra información.
11. Revisar los flujos principales a anchuras de móvil, tableta y escritorio, sin recortes ni desplazamiento horizontal.
12. Recorrer con teclado los menús, tarjetas, buscadores, formularios y diálogos, comprobando que el foco sea visible.

13. Desde administración, invitar a un correo autorizado y confirmar recepción, activación y establecimiento de contraseña; no dar la entrega por verificada si SMTP no está configurado.
14. Rechazar contraseñas de menos de 15 caracteres o sin los cuatro grupos, y validar coincidencia y máximo de 72 bytes. Repetir una solicitud directamente a Auth para confirmar enforcement fuera de la UI.
15. Recuperar contraseña, confirmar caducidad/uso único del enlace y nuevo login después de cambiarla. Ningún token debe permanecer en la URL.
16. Oficina y técnico no ven administración ni pueden invocar sus RPC. Una petición anónima no obtiene datos ni invita usuarios.
17. Probar el último administrador, desactivación, reactivación de una cuenta real y cambios de rol; exigir reasignar partes abiertos. Las cuentas históricas demo no se pueden reactivar.
18. Conservar un token antes de cerrar sesión/desactivar la membresía y comprobar que ya no lee datos. Comprobar cambio de permisos con Realtime, al recuperar foco y recargando.
19. Como técnico, comprobar clientes y máquinas vinculados por oficina; una urgencia propia solo utiliza esas máquinas y no desbloquea otro historial.
20. Mantener un formulario abierto más de dos minutos y comprobar renovación de imágenes privadas. Intentar modificar/borrar fotos y firma cerradas y confirmar la denegación.
21. En **Usuarios**, comprobar en escritorio y móvil que siguen disponibles las invitaciones y el equipo, sin el bloque **Datos de la empresa**, prefijo ni botón de guardar empresa.
22. Tras aplicar la migración de numeración, crear un parte desde oficina y después una urgencia desde técnico: ambos deben usar `PT-` y números consecutivos desde el mayor número existente o el contador reservado. Confirmar que los partes históricos conservan sus referencias, incluso con otros prefijos. Crear desde dos sesiones a la vez y comprobar referencias distintas. Guardar o cerrar un parte ya creado no debe consumir otro número.

## Resultado del 20 de octubre de 2026

- Se aplicó la migración fija PT en Supabase con autorización del usuario y pasó la suite completa de autorización con fixtures revertidos, incluidos ambos cierres y numeración compartida entre roles.
- Dokploy confirmó el frontend publicado. Con la sesión existente del administrador se comprobaron **Usuarios**, invitaciones y equipo, y ausencia de **Datos de la empresa** y sus controles. La captura de escritorio y la de móvil a 390 × 844 están en la carpeta ignorada `outputs/climagest-release-2026-10-20/`; el móvil no tiene desbordamiento horizontal.
- HTTPS respondió HTTP 200 con TLS válido y un nuevo bundle de cliente; la consulta anónima a clientes devolvió 401. No se introdujeron credenciales, enviaron correos, crearon partes operativos ni cambiaron miembros durante estas comprobaciones. Los 13 partes y su checksum de referencias permanecen intactos; el contador siguiente es 1019.

## Resultado del 16 de octubre de 2026

- El administrador confirmó recepción del correo de recuperación, establecimiento de contraseña y acceso posterior en el mismo navegador. Supabase confirmó mediante consulta de solo lectura el inicio de sesión reciente y la membresía administradora activa.
- Durante las pruebas locales se observó un fallo al abrir el enlace en un contexto distinto. Para PKCE, solicitar y completar la recuperación en el mismo navegador, conservando el origen y su almacenamiento. No compartir enlaces ni contraseñas en el chat.
- La entrega y activación de invitaciones a un nuevo destinatario real no se dan por verificadas con SMTP.
- Tras la publicación, Dokploy mostró el despliegue terminado y el dominio público respondió HTTP 200 con certificado TLS válido. Se revisaron login personal y formulario de recuperación en escritorio, ausencia de selector demo y login móvil a 390 × 844 sin desplazamiento horizontal. La consulta anónima a clientes fue rechazada con HTTP 401. No se introdujeron credenciales ni se solicitó otro correo desde el dominio público durante esta comprobación.
