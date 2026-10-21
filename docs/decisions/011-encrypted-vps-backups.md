# ADR 011 — Backups cifrados en el VPS existente

- Fecha: 2026-10-21
- Estado: aceptado

## Contexto

El propietario dispone de Hostinger/Dokploy y pidió utilizarlo para backups, sin instalar Docker en el Mac. La copia saneada de desarrollo excluye medios y credenciales y no permite recuperar producción. Los snapshots del VPS no copian automáticamente los servicios alojados en Supabase.

## Decisión

Ejecutar un operador separado de la aplicación en el VPS, sin reinstalar servicios. Crear un archivo lógico completo de PostgreSQL y copias de todos los objetos privados, cifrados por streaming con age y conservados fuera de rutas públicas. El VPS almacena solo la clave pública de cifrado. La clave privada permanece en el Mac y en la custodia externa del propietario, separada de las copias.

Fijar PostgreSQL y age por versión y huella. Conectar con TLS `verify-full` y certificados oficiales de Supabase. No almacenar el token personal de Management API en el VPS. Usar un rol de base de datos dedicado, con `NOLOGIN` inicial y contraseña aprovisionada fuera de migraciones. Descargar los objetos con una cuenta Auth técnica sin pertenencia a empresas, autorizada mediante lista privada y una política RLS solo SELECT. El operador cierra su sesión al terminar. La función comprueba usuario y sesión reales, sin confiar en metadatos editables por usuarios.

Validar cada versión del procedimiento restaurando en un contenedor desechable sin red ni puertos, con PostgreSQL en tmpfs. Descifrar en el Mac y transmitir por SSH con host verificado; la clave privada no se copia al VPS. Comparar datos y objetos, políticas RLS y ejecutar la suite real de autorización. No modificar ninguna base existente durante el simulacro.

## Consecuencias

La operación no exige otro plan ni mueve el backend a Hostinger. Hay responsabilidad operativa sobre horario, retención, alertas, rotación de credenciales y copia externa. El rol de backup puede leer datos sensibles de Auth; la configuración de solo lectura es un valor predeterminado y no elimina privilegios heredados de `PUBLIC`. Las claves S3 de Supabase permiten todas las operaciones de Storage; la cuenta con RLS limita la capacidad de escribir. Las descargas del operador usan una URL única y comprueban tamaño/ETag para evitar respuestas antiguas de CDN. La revocación se comprueba contra origen; los bytes ya entregados o cacheados requieren considerar su TTL.

Los ajustes de plataforma, SMTP, OAuth, claves de firma y secretos de funciones requieren custodia independiente. Una restauración SQL verificada no demuestra todavía una recuperación completa de todos los servicios alojados. No activar borrados automáticos ni afirmar recuperación completa antes de verificar las copias y sus límites. Véase [procedimiento](../backups.md).
