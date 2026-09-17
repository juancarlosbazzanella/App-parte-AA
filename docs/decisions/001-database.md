# ADR 001: Persistencia local en IndexedDB

- Estado: sustituida por ADR 003
- Fecha: 2026-09-16

## Contexto

El prototipo debe funcionar en un único navegador, sin publicación ni servidor, y conservar datos, fotografías y firmas tras recargar.

## Decisión

Persistir un `DemoState` completo en IndexedDB mediante la abstracción `demoRepository` de `src/lib/climagest.ts`. Los datos iniciales y su versión forman parte del código. La preparación de Drizzle/D1 queda inactiva hasta una fase de producción.

## Consecuencias

La solución admite más contenido que `localStorage` y mantiene aislada la futura sustitución del repositorio. Los datos no se comparten entre dispositivos, no tienen copias de seguridad y pueden perderse al borrar el almacenamiento del navegador. La producción requerirá una base centralizada y almacenamiento de archivos.
