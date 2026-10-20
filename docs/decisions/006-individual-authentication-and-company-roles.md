# ADR 006: Cuentas individuales y tres roles por empresa

- Estado: aceptada; amplía ADR 004
- Fecha: 2026-10-15

## Contexto

El acceso de demostración compartía contraseñas y no distinguía la administración de usuarios del trabajo de oficina. Los técnicos podían descargar toda la cartera y una urgencia podía ampliar su acceso al historial. El usuario aprobó cuentas individuales y los roles administrador, oficina y técnico.

## Decisión

- Conservar Supabase Auth, con login por correo y contraseña, invitaciones y recuperación. No hay registro público. Las contraseñas tienen al menos 15 caracteres, mayúsculas, minúsculas, números y símbolos; el cliente también respeta el límite de 72 bytes de bcrypt. Supabase verifica la política, además del formulario.
- Mantener los roles en `organization_members`, asociados a una empresa y a un estado activo. Los metadatos editables no deciden permisos. `admin` incorpora las operaciones de oficina, pero solo `admin` administra miembros y configura la empresa.
- Comprobar la sesión en `auth.sessions` dentro de los ayudantes privados de autorización. Esto bloquea tokens antiguos al cerrar sesión, además de aplicar inmediatamente los cambios de membresía.
- Limitar el técnico a sus partes, los clientes y máquinas autorizados por trabajos de origen oficina y el historial cerrado de esas máquinas. Las urgencias son propias y requieren un vínculo previo autorizado; no crean nuevos permisos.
- Ejecutar escrituras de partes mediante RPC públicas `SECURITY INVOKER` que llaman a operaciones privadas `SECURITY DEFINER`. Estas comprueban identidad, empresa, rol, asignación y versión antes de escribir. Se revocan INSERT/UPDATE directos de partes. Los cierres se atribuyen al usuario autenticado, incluida oficina/administración, y verifican la pertenencia del archivo de firma.
- Conservar la firma y los datos originales de cierre. Las correcciones requieren un motivo escrito y producen auditoría. Los archivos cerrados son inmutables, también para oficina y administrador.
- Invitar mediante `climagest-invite`, una Edge Function con JWT verificado, comprobación adicional con Auth y autorización actual en PostgreSQL. Solo el servidor utiliza `service_role`. La función reserva una invitación autorizada y la completa contra el usuario realmente creado por Auth. Los fallos quedan registrados y no conceden acceso.
- Serializar cambios de miembros por empresa, impedir retirar al último administrador y exigir reasignación de partes abiertos antes de desactivar o cambiar el rol de un técnico. Auditar altas y cambios de acceso.
- Desactivar definitivamente las cuentas demo sin eliminar sus registros, bloquear sus usuarios Auth, rotar las claves compartidas y revocar sus sesiones. El primer administrador se provisiona con herramientas privilegiadas, nunca con un formulario público que permita elegir el rol.

## Consecuencias

La protección se aplica fuera de la interfaz, incluida la API y Storage. Los enlaces de acceso se consumen una sola vez, se retiran de la URL y permiten establecer la contraseña. Tras cambiarla se cierran las sesiones y se solicita login de nuevo.

La aplicación conserva un cliente web Supabase con sesiones persistentes, renovación de tokens y PKCE para recuperación. Las invitaciones también aceptan enlaces de Auth y `token_hash`. No se añade autenticación basada en cabeceras de ChatGPT ni se almacenan contraseñas en la aplicación. Los archivos privados usan enlaces de dos minutos, renovados mientras están abiertos; un enlace ya emitido sigue siendo válido hasta expirar.

El correo requiere SMTP propio configurado en Supabase. La lista de redirecciones se limita a seis direcciones exactas para activación/recuperación en producción y desarrollo. Cambiar el dominio exige actualizar esa lista y la lista de orígenes de la Edge Function. No se puede prometer entrega de correo antes de verificar SMTP.

Se añaden pruebas de la política de contraseña y una suite SQL transaccional de autorización con rollback. El flujo visual se comprueba con una empresa y usuarios ficticios aislados, que se eliminan tras la validación.
