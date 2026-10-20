# ADR 007 — Pruebas automatizadas del comportamiento crítico

- Estado: aceptada
- Fecha: 2026-10-20

## Contexto

La aplicación disponía de tres pruebas de contraseña con Node y una suite SQL transaccional de autorización. El guardado de partes, los enlaces de acceso, los archivos privados y los flujos de React carecían de regresiones automatizadas. La interfaz concentra sus pantallas en un componente grande; reorganizarlo solo para probarlo ampliaría el alcance del cambio.

## Decisión

Usar Vitest con configuración independiente de los plugins de despliegue y React Testing Library con jsdom. Probar la interfaz por sus controles y resultados visibles, usando sus componentes reales. Sustituir el cliente Supabase en el límite del repositorio para comprobar los argumentos de RPC, las conversiones y los errores sin credenciales; sustituir el repositorio para los flujos completos de React. Simular únicamente las APIs de navegador que jsdom no implementa, incluido el contexto gráfico de canvas.

La ejecución normal bloquea fetch y no carga variables locales de entorno. Los fixtures son ficticios y los mocks se reinician entre pruebas. Las dependencias se fijan y respetan las políticas existentes de pnpm; no se autoriza ningún script nuevo de instalación. `pnpm test` termina con error si falla una prueba; `test:watch`, `test:coverage` y el filtro compatible `test:auth` cubren los demás usos.

Conservar la suite SQL como capa independiente contra Supabase local y las pruebas manuales para navegadores, tamaños de pantalla, dibujo táctil, correo y persistencia real. No conectar las pruebas predeterminadas a producción ni añadir porcentajes arbitrarios de cobertura como requisito.

## Consecuencias

Los cambios de lógica crítica pueden verificarse localmente en segundos. El informe de cobertura ayuda a localizar huecos y no equivale a una garantía de calidad ni de autorización. Las simulaciones de Supabase comprueban contratos del cliente; solo la suite SQL comprueba RLS, roles y funciones reales. La verificación de navegador y de integraciones sigue siendo necesaria para cambios que afecten esos límites.
