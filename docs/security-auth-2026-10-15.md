# Verificación de acceso y dependencias — 15 de octubre de 2026

## Acceso

Se aplicaron en Supabase las migraciones de administrador, autorización e invitaciones y validación de sesiones. La Edge Function `climagest-invite` está desplegada con JWT obligatorio. Las cuentas Auth demo se bloquearon, se sustituyeron sus contraseñas conocidas por hashes de valores aleatorios y se revocaron sus sesiones, conservando el historial. El administrador real se provisionó sin incluir sus datos ni sus credenciales en archivos del repositorio.

La suite `tests/authorization.sql` pasa contra el proyecto remoto y revierte todos sus datos. Cubre acceso anónimo, aislamiento entre empresas y técnicos, ausencia de escalada por urgencias, denegación de administración a oficina/técnico, escrituras directas bloqueadas, ambos cierres, firma ajena rechazada, archivos cerrados inmutables, auditoría de correcciones, protección del último administrador, reasignación previa y revocación de sesiones/membresías.

Se comprobó por HTTP que Supabase rechaza contraseñas de 14 caracteres y contraseñas sin cada grupo requerido. Los tokens de acceso nuevos duran 900 segundos. Un token de una sesión cerrada deja de leer clientes. También se comprobó el rechazo de orígenes no autorizados en la Edge Function y de acceso anónimo a datos.

Se verifica la interfaz con cuentas ficticias aisladas: administración en escritorio, técnico en móvil, ausencia de datos ajenos y cierre sin firma con motivo obligatorio. El 16 de octubre Resend confirmó el dominio verificado y Supabase confirmó el guardado de SMTP personalizado, con la clave introducida directamente por el usuario. Tras solicitar y abrir un enlace nuevo en el mismo navegador, el administrador confirmó recepción, cambio de contraseña e inicio de sesión posterior. Una consulta de solo lectura confirmó correo validado, cuenta habilitada, inicio de sesión reciente y membresía administradora activa. La entrega de invitaciones a otros miembros todavía no se ha probado con SMTP.

## Dependencias

La auditoría inicial encontró 32 avisos altos y uno crítico. Se revisaron los avisos y se aplicaron versiones corregidas publicadas hace más de siete días, sin relajar los controles de pnpm:

- Next.js y eslint-config-next 16.3.8; React, React DOM y React Server DOM Webpack 19.2.8; Vite 8.0.16.
- Overrides compatibles de undici, ws, brace-expansion, js-yaml, browserslist, image-size y source-map-js, además de sharp 0.35.5.
- Los overrides efectivos se guardan en `pnpm-workspace.yaml`. La instalación usa el lockfile actualizado y `pnpm install --frozen-lockfile`; no se añade ningún paquete autorizado para ejecutar scripts.

Tras las actualizaciones quedan 2 avisos bajos, 5 moderados y **un aviso alto sin versión corregida publicada**: [GHSA-vfj7-8cjw-p6xm, braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Llega por micromatch/fast-glob a ESLint y a un plugin de desarrollo de vinext. El fallo es agotamiento de pila con patrones de llaves profundamente anidados. El flujo de login no proporciona entrada de usuarios a esos patrones. La dependencia permanece en el grafo de herramientas y no se oculta ni se suprime el aviso: **`pnpm security:audit` continúa fallando por este aviso**. Queda pendiente una corrección del proveedor o una sustitución compatible de esa herramienta.

El 16 de octubre se repitieron y pasaron documentación, lint, análisis de tipos sin caché incremental, las tres pruebas de contraseña y la compilación de producción. La auditoría repitió los mismos ocho avisos y sigue fallando por braces sin parche. La compilación avisa de un chunk de cliente superior a 500 kB y de clasificación estática incompleta de rutas en vinext; finaliza correctamente.

No se habilitó protección contra contraseñas filtradas porque el proyecto usa Free y Supabase la ofrece desde Pro. No se contrató ni modificó ningún plan. El cliente sigue usando sesiones persistentes de Supabase en el navegador; cualquier ampliación que acepte HTML o scripts deberá revisar el riesgo de XSS y la estrategia de sesiones.

## Revalidación del 20 de octubre

La suite automatizada se amplió a 81 casos de acceso, repositorio e interfaz con fixtures ficticios y fetch bloqueado. La auditoría tras añadir las dependencias de prueba mantiene exactamente los ocho avisos anteriores; braces sigue sin versión corregida publicada según el aviso GHSA, revisado de nuevo. No se añadieron autorizaciones para scripts de instalación. Supabase CLI no pudo inspeccionar una instancia local porque este equipo no dispone de Docker ni Podman: la suite SQL no se repitió y las simulaciones no se presentan como validación nueva de RLS.

La ampliación posterior a 93 pruebas añade PGlite 0.5.9 como herramienta de desarrollo para ejecutar la migración de prefijo fijo PT en PostgreSQL aislado. La auditoría vuelve a mantener los mismos ocho avisos, sin dependencias nuevas vulnerables ni permisos de instalación adicionales. Tras la autorización del usuario se aplicó la migración en Supabase, se comprobó la restricción fija PT y la revocación de edición, y pasó la suite completa de autorización con rollback. Los avisores no añadieron hallazgos: se mantiene únicamente la protección de contraseñas filtradas desactivada en el plan Free ([referencia y remediación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

El frontend nuevo quedó publicado con **Usuarios** sin configuración de empresa. Se verificaron la sesión existente de administrador, escritorio y móvil, HTTPS y rechazo anónimo de clientes. No se crearon partes operativos ni se enviaron invitaciones/correos; los 13 partes conservaron su checksum y el siguiente número es `PT-1019`.

## Publicación comprobada el 16 de octubre

Dokploy confirmó el despliegue terminado del frontend actualizado. El dominio respondió HTTP 200 con certificado TLS válido; se revisaron login, formulario de recuperación y vista móvil sin desplazamiento horizontal. Supabase rechazó con HTTP 401 la consulta anónima a clientes. Se conservaron las redirecciones exactas y las variables existentes; las claves SMTP y de servicio permanecen fuera del frontend y del ZIP. La auditoría posterior mantiene los mismos ocho avisos, incluido braces alto sin parche. El panel de Dokploy observado sigue usando HTTP y queda pendiente proteger su administración con HTTPS. No se repitió el login con credenciales ni un nuevo correo desde producción; tampoco se da por verificada una invitación real nueva.
