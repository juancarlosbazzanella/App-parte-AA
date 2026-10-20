# ADR 005: pnpm y controles de cadena de suministro

- Estado: aceptado
- Fecha: 23 de septiembre de 2026

## Contexto

Los gestores de paquetes ejecutan código de terceros durante la instalación y el ecosistema npm ha sufrido campañas que publican versiones maliciosas y usan scripts de ciclo de vida para extraer secretos o propagarse. Un lockfile reduce cambios inesperados, pero no protege por sí solo cuando se añade o actualiza una dependencia comprometida.

## Decisión

El proyecto usa exclusivamente pnpm 11.25.0. `package.json` fija la versión y su hash SHA-512, y `pnpm-lock.yaml` es el único lockfile. Desarrollo y CI instalan con `--frozen-lockfile`.

La configuración compartida aplica:

- una antigüedad mínima de 10.080 minutos (siete días) para versiones nuevas;
- bloqueo de dependencias transitivas obtenidas de Git, URL, archivo local u otra fuente exótica;
- versiones exactas al guardar dependencias;
- error ante scripts de instalación que no tengan una decisión explícita;
- una lista `allowBuilds` revisada para los únicos paquetes nativos que actualmente la necesitan.

No se permite npm, Yarn, `npx`, un segundo lockfile ni desactivar temporalmente estas medidas. Cada entrega ejecuta `pnpm security:audit` y revisa manualmente los avisos relevantes para producción.

## Consecuencias

Las instalaciones son más reproducibles y una versión recién publicada no entra de inmediato. Añadir paquetes con binarios o scripts requiere una revisión explícita. La ventana de siete días no garantiza que un paquete sea seguro y la auditoría del registro tampoco detecta vulnerabilidades todavía desconocidas, por lo que siguen siendo necesarias revisión de cambios, actualización deliberada y mínimos privilegios para CI.

## Actualización 2026-10-15

Los overrides de seguridad efectivos se mantienen en `pnpm-workspace.yaml`, junto con los controles compartidos. Se sustituyó el campo raíz heredado `overrides` de `package.json`, que no constituye la configuración de overrides de pnpm. Las actualizaciones de seguridad y el aviso pendiente sin parche se documentan en `docs/security-auth-2026-10-15.md`.

## Actualización 2026-10-16

El despliegue de Dokploy conserva Railpack 0.15.4 con un plan `railpack.json` versionado que reemplaza su bootstrap por defecto con npm y `corepack@latest`. Se fija Node 22.23.3 y se utiliza el Corepack incluido para activar la versión de pnpm con SHA-512 de `package.json` e instalar con lockfile congelado. El plan generado se ha validado con el binario oficial de esa versión de Railpack, comprobado mediante SHA-256.
