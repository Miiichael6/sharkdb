# 10. Safe mode lista negra incompleta

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/safe_mode/policy.rs
- **Estado:** resuelto

## Problema
El safe mode funciona con una lista de comandos bloqueados, y le faltan comandos.

## Escenario de fallo
Con safe mode activo aún pasan, entre otros: `shutdown`, `fsync` con lock, `replSetReconfig`/`replSetStepDown`, `setFeatureCompatibilityVersion`, `setParameter`, `killSessions`/`killAllSessions`/`killCursors`, `abortTransaction`/`commitTransaction`, `shardCollection`/`moveChunk`/`movePrimary`/`reshardCollection`/`addShard`/`removeShard`/`enableSharding`, `createSearchIndexes`/`dropSearchIndex`/`updateSearchIndex`, `planCacheClear`, `dropConnections`, `setDefaultRWConcern`, `cleanupOrphaned`, y `explain` envolviendo una escritura (con verbosity `executionStats` se ejecuta).

## Recomendación
Pasar a una lista de comandos permitidos (solo lectura) e inspeccionar el comando que va dentro de `explain`.
