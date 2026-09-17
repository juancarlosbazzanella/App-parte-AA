# ADR 002: Acceso y autorización simulados

- Estado: sustituida por ADR 004
- Fecha: 2026-09-16

## Contexto

La demostración necesita alternar rápidamente entre oficina y tres técnicos, pero no se publicará ni manejará cuentas reales.

## Decisión

Usar usuarios fijos y una contraseña común de demostración. La interfaz aplica permisos por rol: oficina tiene acceso global; cada técnico solo gestiona sus trabajos y puede consultar el historial cerrado de la máquina asociada.

## Consecuencias

El flujo permite validar la experiencia y los permisos funcionales, pero no ofrece una frontera de seguridad: los datos y las comprobaciones están en el cliente. Antes de publicar se sustituirá por autenticación de servidor, sesiones seguras y autorización aplicada en cada operación de datos.
