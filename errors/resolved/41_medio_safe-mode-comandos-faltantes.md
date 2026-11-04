# 41. Comandos de escritura que faltan en la lista del safe mode

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/safe_mode/policy.rs
- **Estado:** resuelto — añadidos a `WRITE_COMMANDS` los 14 comandos (zonas, query settings, transiciones de config server, aborts de move/unshard, `setChangeStreamState`, `appendOplogNote` y el alias `deleteIndexes`). Se bloquean también dentro de `explain`. La lista sigue siendo negra; pasar a lista blanca queda pendiente. Tests: `safe_mode/policy.rs` (`zones_query_settings_and_cluster_transitions_are_writes`, `explaining_a_new_write_command_is_a_write`) y `tests/live.rs` (`live_safe_mode_rejects_writes`, vía `runCommand`/`adminCommand`).
- **Relacionado:** 30 (huecos del safe mode), 10 (lista negra)

## Problema
Siguen sin bloquearse (y no están en la 30):
- Zonas de sharding: `addShardToZone`, `removeShardFromZone`, `updateZoneKeyRange` (modifican `config.shards`/`config.tags` y provocan migraciones).
- `setQuerySettings`, `removeQuerySettings` (8.0), `configureQueryAnalyzer` (7.0).
- `transitionToDedicatedConfigServer`, `transitionFromDedicatedConfigServer`, `abortMoveCollection`, `abortUnshardCollection`, `setChangeStreamState`, `appendOplogNote`.
- `deleteIndexes` (alias histórico de `dropIndexes`; comprobar en qué versiones lo acepta el servidor).

## Escenario de fallo
Con safe mode activo, `db.adminCommand({updateZoneKeyRange: 'a.x', min:{...}, max:{...}, zone: null})` reconfigura el balanceo en producción.

## Recomendación
Añadirlos a la lista. A largo plazo, pasar a lista de comandos permitidos.
