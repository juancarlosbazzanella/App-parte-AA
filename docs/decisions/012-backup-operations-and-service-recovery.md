# ADR 012 — Retención, avisos y recuperación de los servicios de la aplicación

- Fecha: 2026-10-21
- Estado: aceptado

## Contexto

La primera copia recuperó PostgreSQL y comprobó los archivos por hash. Quedaban por controlar el crecimiento del disco, avisar de fallos y probar los servicios que consumen la base restaurada. El propietario autorizó completar estas operaciones y eligió el correo del administrador.

## Decisión

Después de una copia correcta, verificar sus cifrados y conservar la copia más reciente de las últimas 30 jornadas, 8 semanas y 12 meses con copias. Proteger siempre las tres copias más recientes, los últimos siete días y la última restauración verificada. Exigir recibo e integridad, historial suficiente y una prueba de restauración antes de borrar. No gestionar directorios desconocidos ni enlaces simbólicos. Mantener el límite mínimo de 5 GiB libres.

Enviar avisos operativos mediante una clave Resend independiente con Sending access y limitada al dominio, custodiada en la configuración privada y su copia cifrada. Los correos solo identifican el estado del backup; no adjuntan datos, claves ni trazas. Deduplicar cada tipo de aviso durante 24 horas. El fallo final de systemd activa el aviso y una tarea independiente comprueba cada hora que exista copia completa de las últimas 36 horas. Una copia posterior avisa de recuperación si había incidencia.

Probar además los servicios usados por ClimaGest sobre una restauración desechable. Fijar las imágenes por digest y los archivos oficiales por commit y SHA-256. Usar red Docker interna sin salida ni puertos publicados, datos en tmpfs y claves nuevas. Capturar SMTP dentro de la red. Acceder desde el navegador local mediante el canal SSH verificado; la clave de recuperación permanece en el Mac. Restaurar el código Edge sin cambiar su autorización; un alias DNS interno permite probar la rama productiva sin acceder al proyecto real. Esperar la confirmación de la suscripción PostgreSQL antes de verificar un cambio de Realtime. Importar formatos históricos solo en la copia y restablecer las listas MIME originales incluso ante errores. Eliminar exclusivamente los recursos aleatorios de ese simulacro al terminar.

## Consecuencias

La retención reduce crecimiento, pero las copias grandes pueden agotar el espacio incluso dentro de estos límites. El operador debe revisar capacidad y copiar backups fuera del VPS y del Mac. El aviso local no detecta por sí mismo un VPS apagado ni puede entregar correo si el proveedor de correo o la red están caídos; la supervisión independiente del proveedor sigue siendo una responsabilidad externa. La prueba cubre los servicios usados por la aplicación, sin afirmar equivalencia con toda la plataforma administrada, OAuth o secretos ocultos.
