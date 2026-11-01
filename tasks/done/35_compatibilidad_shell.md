# 35 · Compatibilidad del shell con Robo 3T

**Estado:** ✅ Terminada
**Fase:** 20 Shell compatible · **Depende de:** 03 · **Doc:** R69, R70, R71, R72

## Objetivo
Los scripts escritos para Robo 3T (shell clásico 4.2) funcionan tal cual: escrituras masivas, lotes grandes y los atajos de cursor, colección, base de datos y servidor que hoy obligan a usar `runCommand`.

## Pasos

### Paso 1: Escrituras masivas y lotes grandes
- [x] `src-tauri/src/shell/prelude/bulk.js` (nuevo): `bulkWrite` (insertOne, updateOne/Many, replaceOne, deleteOne/Many; ordered) e `initializeOrderedBulkOp`/`initializeUnorderedBulkOp` con `find().upsert().updateOne()/update()/replaceOne()/remove()/removeOne()` y `execute()` → `BulkWriteResult` (R69)
- [x] Partir `insert`, `insertMany`, `update`/`delete` masivos y los bulk en lotes que respeten `maxWriteBatchSize` (100 000) y 16 MB por comando; resultados e `insertedIds` sumados y errores con su índice global (R70)

### Paso 2: Cursor y colección
- [x] Cursor: `explain(verbosity)`, `pretty()`, `size()`, `count()`, `collation()`, `min`/`max`, `readPref`, `noCursorTimeout`, `allowDiskUse`, `comment` (R71)
- [x] Colección: `renameCollection`, `dropIndexes`, `createIndexes`, `getIndexKeys`, `dataSize`, `storageSize`, `totalSize`, `totalIndexSize`, `isCapped`, `validate`, `explain()`, `watch` solo si cabe sin bloquear (si no, error claro) (R71)

### Paso 3: Base de datos, servidor y globales
- [x] `db`: `stats()`, `serverStatus()`, `currentOp()`, `killOp()`, `isMaster()`, `hostInfo()`, `getMongo()`, `printCollectionStats()`, `createUser`/`dropUser`/`updateUser`/`grantRolesToUser`/`revokeRolesFromUser` (R72)
- [x] `rs.status()`/`rs.conf()`/`rs.isMaster()` y `sh.status()` (resumen de `config`) (R72)
- [x] Globales: `sleep(ms)` (cancelable), `load(ruta)` relativo a la carpeta del script abierto, `hex_md5`, `it` (siguiente lote del último cursor) (R72)
- [x] Respetar safe mode en todo lo que escribe (bulk, renombrar, usuarios, killOp); prelude dividido por áreas si `prelude.js` crece de más

### Paso 4: Verificación
- [x] Tests en `src-tauri/src/shell/tests/` (motor) y `live.rs` contra Mongo **local** (nunca prod): bulk ordenado y no ordenado, `insertMany` de 150 000 docs y de >16 MB, cada atajo nuevo
- [ ] Prueba real en la app con scripts copiados de Robo 3T (pendiente del usuario, ver Bitácora)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `cargo test` pasan
- [ ] Commit: `feat(shell): bulk, lotes grandes y atajos del shell clásico` (propuesto, pendiente del usuario)

## Criterios de aceptación
- [x] `bulkWrite` y `initializeOrderedBulkOp/UnorderedBulkOp` devuelven los mismos contadores que en Robo 3T
- [x] Un `insertMany` de más de 100 000 documentos o de más de 16 MB termina bien
- [x] Los atajos listados funcionan sin `runCommand` y respetan safe mode

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: Pedida por el usuario al comparar con Robo 3T; hoy `insertMany` va en un solo comando y el servidor rechaza >16 MB o >100 000 docs.
- 2026-11-01: Lotes en JS sobre `runCommand` (tamaño con `Object.bsonsize`, tope 16 MB − 16 KB por comando); prelude partido en 8 `.js` por área. Mongo local es 4.2: `allowDiskUse` en find pide 4.4 y se prueba en aggregate.
- 2026-11-01: `it` sigue el último cursor entre ejecuciones: el frontend libera los cursores viejos después de ejecutar (no antes), salvo los que reusa el resultado. `watch` da error claro; `killOp` cuenta como escritura en safe mode.
- 2026-11-01: Prueba en la ventana de la app no hecha (no se puede manejar Tauri desde esta sesión); en su lugar `live_compat.rs` corre scripts tipo Robo 3T por el mismo `ShellRuntime`/`MongoNatives` contra Mongo local.
- 2026-11-01: Tras la prueba del usuario, cada resultado lleva `elapsedMs` de su sentencia (incluye el primer lote del cursor) y la pestaña lo muestra junto al título; la barra sigue con el total.
