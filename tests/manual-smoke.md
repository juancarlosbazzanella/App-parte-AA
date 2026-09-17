# Pruebas manuales esenciales

Ejecutar estas comprobaciones tras cambios funcionales o visuales:

1. Entrar como cada usuario y confirmar que cada técnico solo lista sus trabajos.
2. Crear y asignar un trabajo desde oficina; crear una urgencia desde técnico.
3. Guardar un parte abierto y cerrarlo primero con firma y después sin firma, exigiendo motivo.
4. Confirmar que el técnico no edita un parte cerrado y que oficina sí puede corregirlo.
5. Abrir el historial de una máquina y comprobar partes cerrados de distintos técnicos.
6. Buscar por cliente, marca, modelo, número de serie y dirección.
7. Adjuntar una foto, recargar y confirmar que datos, foto y firma persisten mediante URLs privadas firmadas.
8. Abrir dos sesiones, modificar un parte y comprobar que la otra sesión recibe la actualización.
9. Intentar desde técnico editar un cliente o un parte ajeno y confirmar que Supabase lo rechaza.
10. Usar **Sincronizar datos** y verificar que no borra información.
11. Revisar los flujos principales a anchuras de móvil, tableta y escritorio, sin recortes ni desplazamiento horizontal.
12. Recorrer con teclado los menús, tarjetas, buscadores, formularios y diálogos, comprobando que el foco sea visible.
