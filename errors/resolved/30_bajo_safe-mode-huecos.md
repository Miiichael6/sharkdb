# 30. Safe mode huecos

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/safe_mode/policy.rs (`WRITE_COMMANDS`)
- **Estado:** resuelto — añadidos a `WRITE_COMMANDS` `setProfilingLevel`, `autoCompact`, `setFreeMonitoring`, `compactStructuredEncryptionData` y `cleanupStructuredEncryptionData`. `profile` solo se permite con nivel -1 y sin `slowms`/`sampleRate`/`filter` (que se aplican aunque el nivel sea -1); `validate` se bloquea con `repair` verdadero. Tests: `safe_mode/policy.rs` (`profiling_monitoring_and_encryption_maintenance_are_writes`, `profile_is_a_write_unless_it_only_reads_the_settings`, `validate_is_a_write_only_when_it_repairs`).

## Problema
Faltan comandos que modifican el servidor: `profile` (con nivel), `setProfilingLevel`, `validate` con `repair: true`, `autoCompact`, `setFreeMonitoring`, `cleanupStructuredEncryptionData`/`compactStructuredEncryptionData`.

## Escenario de fallo
Con safe mode activo, `db.runCommand({ profile: 2 })` activa el profiler en producción.

## Recomendación
Añadirlos a la lista; para `profile` y `validate`, bloquear solo si cambian algo (`profile` distinto de -1, `repair: true`).
