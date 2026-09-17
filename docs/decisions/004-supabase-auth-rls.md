# ADR 004: Autenticación Supabase y autorización con RLS

- Estado: aceptada
- Fecha: 2026-09-17

## Contexto

Los permisos simulados en React no constituyen una frontera de seguridad y pueden eludirse llamando directamente a una API.

## Decisión

Usar Supabase Auth para sesiones de correo y contraseña. Guardar roles por empresa en `organization_members`, nunca en metadatos editables. Activar RLS en todas las tablas públicas y políticas equivalentes en `storage.objects`. Ejecutar las transiciones sensibles de los partes mediante funciones transaccionales y conservar los datos de cierre como inmutables.

## Consecuencias

La autorización se aplica aunque el cliente se modifique o se use la API directamente. Las políticas y funciones forman parte del contrato de la aplicación y deben probarse por rol. Las cuatro cuentas iniciales comparten una contraseña únicamente porque son datos ficticios; producción necesitará invitaciones, recuperación de contraseña y credenciales individuales.
