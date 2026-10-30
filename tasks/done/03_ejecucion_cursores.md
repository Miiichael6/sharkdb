# 03 · API de shell (db, colecciones, cursores) y ejecución

**Estado:** ✅ Terminada
**Fase:** 2 Motor · **Depende de:** 02 · **Doc:** R5, R7

## Objetivo
Dentro del motor de 02 existen `db`, colecciones y cursores con la API del shell de Mongo conectados al driver real, y el frontend puede ejecutar un script y paginar sus resultados.

## Pasos

### Paso 1: Puente nativo
- [x] `src-tauri/src/shell/native.rs`: funciones nativas `__native.find/aggregate/insert/update/delete/findAndModify/count/distinct/runCommand/listCollections` que llaman al driver de la sesión (`Handle::block_on` desde el hilo del script, nunca desde un worker de tokio) (R5)
- [x] `src-tauri/src/shell/cursors.rs`: registro de cursores abiertos por sesión; un cursor que queda como valor final del script se entrega por lotes (`next_batch`) y se cierra al cerrar la pestaña o desconectar (R7)

### Paso 2: Prelude del shell
- [x] `src-tauri/src/shell/prelude.js` (incluido con `include_str!`): clases propias `DB`, `Collection`, `Cursor` sobre `__native`: `db.coll` / `db.getCollection()` / `db.getSiblingDB()` vía `Proxy`, cursor perezoso con `sort/skip/limit/projection/toArray/forEach/map/next/hasNext/count/itcount`, métodos CRUD y `aggregate`, `use`, `show dbs`/`show collections` (R5)
- [x] `ScriptOutcome` final: lista de salidas en orden (texto de `print`, resultado de escritura, documento/valor, cursor paginable) + `elapsed_ms`; comandos Tauri `execute_script(sid, db, code)`, `next_batch`, `close_cursor`, `cancel_script` registrados en `lib.rs` (R5, R7)

### Paso 3: Servicio en el frontend
- [x] `src/features/shell/application/ports.ts` (`ShellGateway`) + `infrastructure/tauriShellGateway.ts`; `application/shellService.ts` con paginación skip/limit sobre lotes; registrar en `src/app/services.tsx`
- [x] Tests: `shellService.test.ts` con gateway falso; `cargo test` del prelude contra un mock de `__native` (encadenado de cursor, `forEach`, `use`)

### Paso 4: Verificación
- [x] Prueba real contra Mongo local ~~desde devtools~~ (ver Bitácora): `db.getCollection('x').find({}).sort({_id:-1}).limit(5)`; un script con `forEach` + `print`; `insertOne` + `find` en el mismo script; `use otra; db.y.count()`; cancelar un `while(true)`
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(shell): API db/colección/cursor y ejecución de scripts` (propuesto, pendiente del usuario)
- **Cierre de Fase 2**

## Criterios de aceptación
- [x] Scripts de varias sentencias con variables y bucles se ejecutan contra el servidor real
- [x] Un `find` grande se recorre por lotes sin cargar toda la colección en memoria
- [x] Un script lento se puede cancelar y la sesión sigue usable
- [x] Los cursores se cierran al desconectar la sesión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Nativas reducidas a `find/aggregate/runCommand/cursorNext/cursorClose` (+ `native/` y `prelude/` como carpetas); CRUD, `count`, `distinct`, `listCollections` se montan en `prelude.js` sobre `runCommand`.
- 2026-10-30: Salidas = `print` en orden + valor final (no una por sentencia); los cursores que no quedan como resultado se cierran al acabar cada script; un shell por conexión (`sid`), 04 puede pasarlo a uno por pestaña. El paginador del frontend guarda lo ya leído para volver atrás sin ir al servidor.
- 2026-10-30: Sin CDP (el `npm run start:dev` del usuario ocupaba el 1420 sin puerto de depuración): prueba real con `cargo test live -- --ignored` (runtime + driver contra Mongo local, BD `robo3b_test`) y la app recompilada y arrancada por ese mismo `tauri dev`.
