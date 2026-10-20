# Puesta en marcha del acceso y el correo

## Estado al 16 de octubre de 2026

Resend confirmó el dominio como **Verified** y Supabase confirmó el guardado de SMTP personalizado con la clave introducida directamente por el usuario. El administrador confirmó la recepción del correo de recuperación, el cambio de contraseña y el acceso posterior al solicitar y abrir un nuevo enlace en el mismo navegador. Una consulta de solo lectura confirmó el inicio de sesión reciente y el rol administrador activo. La entrega y activación de una invitación a un nuevo destinatario real todavía no se han probado con SMTP. Las instrucciones siguientes se conservan como referencia de configuración.

El frontend actualizado ya está publicado en [ClimaGest](https://partes.juancarlosbazzanella.es/). Se comprobaron HTTPS, login y formulario de recuperación públicos, vista móvil y rechazo de datos anónimos. El acceso con credenciales y un nuevo correo de recuperación desde el dominio público no se repitieron durante la publicación; las pruebas anteriores del administrador se completaron desde el origen local. Véase `deployment.md`.

## Acceso del administrador

El administrador inicial se ha creado de forma privada en Supabase. El correo y el enlace personal de activación no se guardan en el repositorio. La pantalla de activación permite establecer la contraseña y después iniciar sesión. Si caduca el enlace, se necesita otro enlace generado por una herramienta privilegiada o recuperación de contraseña cuando SMTP esté operativo.

Las cuentas antiguas de demostración quedan desactivadas y no pueden reactivarse. Sus clientes, máquinas y partes siguen disponibles para administración/oficina. Invita a los técnicos reales y reasigna sus partes abiertos desde la planificación.

## Conectar Resend con Supabase

1. Crea una cuenta en [Resend](https://resend.com/signup).
2. En **Domains → Add domain**, añade un subdominio que controles, por ejemplo `acceso.juancarlosbazzanella.es`.
3. Copia exactamente los registros DNS que muestre Resend y añádelos en el proveedor del dominio. No copies valores abreviados con `[…]`. Los tipos y destinos pueden variar; utiliza los que muestre tu cuenta. En la configuración observada aparecen un TXT de DKIM y dos CNAME para el envío.
4. En Resend pulsa **I've already added the records** y espera el estado **Verified**. No necesitas habilitar la recepción de correo.
5. En **API Keys**, crea una clave para enviar correo, limitada al dominio verificado cuando esa opción esté disponible. No la envíes por chat ni la guardes en el código.
6. Abre [Supabase → Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/rccuxceihlxtaxwwgcfi/auth/smtp), activa SMTP personalizado y completa:

| Campo | Valor |
| --- | --- |
| Sender email | `no-reply@acceso.juancarlosbazzanella.es`, si ese es el dominio verificado |
| Sender name | `ClimaGest` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | La clave API de Resend; introdúcela directamente en Supabase |

7. Guarda los cambios. Para enlaces de acceso, mantén desactivado el seguimiento de clics del proveedor.
8. Prueba **He olvidado mi contraseña** con tu propia cuenta: debe llegar un mensaje, abrir la pantalla de contraseña, rechazar una débil y permitir establecer una robusta. El enlace solo se puede utilizar una vez.
9. En **Usuarios**, invita a una persona autorizada con el rol correcto y comprueba que recibe el mensaje y accede a su empresa. Nunca se envía una contraseña compartida.

Durante las pruebas locales, abre el correo en el mismo ordenador y completa la recuperación en el navegador desde el que se solicitó: el flujo PKCE necesita su verificador local. Una dirección `127.0.0.1` o `localhost` apunta al dispositivo que abre el enlace, y el servidor debe seguir activo en el puerto 5173. Para destinatarios externos debe publicarse primero el frontend actualizado y solicitar los enlaces desde su URL pública.

[Instrucciones oficiales de Resend para Supabase](https://resend.com/docs/send-with-supabase-smtp). El correo de pruebas incluido por Supabase tiene restricciones de destinatarios y no sustituye SMTP para usuarios reales: [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Configuración de autenticación

En el proyecto remoto se ha desactivado el registro público y se han exigido contraseñas de 15 caracteres con mayúsculas, minúsculas, números y símbolos, además de cambio de contraseña seguro. Los tokens de acceso nuevos duran 900 segundos y mantienen rotación de refresh tokens. Se permite confirmar correo y se mantienen desactivados el acceso anónimo y el enlace manual de identidades.

En **URL Configuration** deben mantenerse el Site URL de la aplicación publicada y estas seis redirecciones exactas:

- `https://partes.juancarlosbazzanella.es/?auth=setup`
- `https://partes.juancarlosbazzanella.es/?auth=reset`
- `http://localhost:5173/?auth=setup`
- `http://localhost:5173/?auth=reset`
- `http://127.0.0.1:5173/?auth=setup`
- `http://127.0.0.1:5173/?auth=reset`

La comprobación de contraseñas filtradas requiere un plan Pro o superior. El proyecto actual usa Free y no se ha contratado ningún plan adicional. Las sesiones y los permisos se validan en la base de datos aunque el JWT todavía no haya expirado.

## Desarrollo y verificación

- `pnpm dev` sirve la aplicación en `http://127.0.0.1:5173`, también accesible como `http://localhost:5173`.
- `pnpm test:auth` comprueba las contraseñas, los enlaces de acceso, las sesiones y los formularios con Vitest y fixtures ficticios, sin credenciales.
- `pnpm test:permissions` ejecuta `tests/authorization.sql` contra Supabase local. Con el CLI autenticado, también puede usarse `pnpm exec supabase db query --linked --file tests/authorization.sql`. La suite crea datos aislados dentro de una transacción y finaliza con rollback.
- La Edge Function se versiona en `supabase/functions/climagest-invite/`. Para desplegarla con un CLI autorizado: `pnpm exec supabase functions deploy climagest-invite --project-ref <referencia>`. Mantén `verify_jwt = true` y los secretos exclusivamente en el entorno de Supabase.
- El aprovisionamiento inicial utilizó una función temporal protegida por un secreto aleatorio de un solo uso. Tras crear el administrador se sustituyó por una respuesta 410, con verificación JWT habilitada y sin lógica ni secretos de aprovisionamiento.
- Publicar los cambios de aplicación es un paso independiente; este trabajo no autoriza operaciones Git ni publica el frontend automáticamente.

Las migraciones locales están alineadas con el historial remoto. La migración de numeración fija del 20 de octubre se aplicó tras la autorización del usuario y quedó registrada como `20261020105413_fixed_work_order_numbering.sql`; se alineó su nombre local conservando el SQL. Cuando se aplique una migración a través de MCP y el servidor asigne otra marca temporal, compara su contenido y alinea el nombre local con la versión devuelta antes de usar el CLI. No repitas una migración ya aplicada ni repares el historial sin comprobar el SQL.
