# 30. Safe mode huecos

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/safe_mode/policy.rs (`WRITE_COMMANDS`)
- **Estado:** pendiente

## Problema
Faltan comandos que modifican el servidor: `profile` (con nivel), `setProfilingLevel`, `validate` con `repair: true`, `autoCompact`, `setFreeMonitoring`, `cleanupStructuredEncryptionData`/`compactStructuredEncryptionData`.

## Escenario de fallo
Con safe mode activo, `db.runCommand({ profile: 2 })` activa el profiler en producción.

## Recomendación
Añadirlos a la lista; para `profile` y `validate`, bloquear solo si cambian algo (`profile` distinto de -1, `repair: true`).
