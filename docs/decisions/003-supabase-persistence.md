# ADR 003: Persistencia centralizada en Supabase

- Estado: aceptada
- Fecha: 2026-09-17

## Contexto

IndexedDB no comparte datos entre dispositivos, no ofrece copias centralizadas y obliga a guardar el estado completo junto con fotografías y firmas codificadas como data URLs.

## Decisión

Usar PostgreSQL de Supabase para el dominio normalizado y un bucket privado de Supabase Storage para fotografías y firmas. Mantener migraciones SQL versionadas, claves UUID expuestas, numeración de partes atómica y control de concurrencia mediante una columna `version`. La interfaz continúa consumiendo un `DemoState`, construido por una capa de repositorio.

## Consecuencias

Los datos se comparten entre sesiones, mantienen integridad referencial y admiten auditoría. La aplicación depende de conectividad y del proyecto Supabase. Los archivos requieren políticas separadas y URLs firmadas. Toda evolución del esquema debe incluir una migración y regenerar `src/lib/database.types.ts`.
