# 54. Cancelar antes de que el backend registre el trabajo no tiene efecto

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/sync/commands.rs, src-tauri/src/backup/commands.rs (`jobs.start` tras varios `await`), src-tauri/src/jobs/mod.rs (`Jobs::cancel`)
- **Estado:** pendiente

## Problema
`jobs.start` se llama después de varios `await`; `Jobs::cancel` no hace nada si el id aún no existe.

## Escenario de fallo
El usuario pulsa "Cancelar" justo al lanzar un sync o restore: la cancelación se pierde y la operación sigue hasta terminar como correcta (ventana de milisegundos).

## Recomendación
Registrar el trabajo antes de cualquier `await`, o recordar las cancelaciones de ids todavía no registrados.
