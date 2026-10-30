# 03 · API de shell (db, colecciones, cursores) y ejecución

**Estado:** ⬜ Pendiente
**Fase:** 2 Motor · **Depende de:** 02 · **Doc:** R5, R7

## Objetivo
Dentro del motor de 02 existen `db`, colecciones y cursores con la API del shell de Mongo conectados al driver real, y el frontend puede ejecutar un script y paginar sus resultados.

## Pasos

### Paso 1: Puente nativo
- [ ] `src-tauri/src/shell/native.rs`: funciones nativas `__native.find/aggregate/insert/update/delete/findAndModify/count/distinct/runCommand/listCollections` que llaman al driver de la sesión (`Handle::block_on` desde el hilo del script, nunca desde un worker de tokio) (R5)
- [ ] `src-tauri/src/shell/cursors.rs`: registro de cursores abiertos por sesión; un cursor que queda como valor final del script se entrega por lotes (`next_batch`) y se cierra al cerrar la pestaña o desconectar (R7)

### Paso 2: Prelude del shell
- [ ] `src-tauri/src/shell/prelude.js` (incluido con `include_str!`): clases propias `DB`, `Collection`, `Cursor` sobre `__native`: `db.coll` / `db.getCollection()` / `db.getSiblingDB()` vía `Proxy`, cursor perezoso con `sort/skip/limit/projection/toArray/forEach/map/next/hasNext/count/itcount`, métodos CRUD y `aggregate`, `use`, `show dbs`/`show collections` (R5)
- [ ] `ScriptOutcome` final: lista de salidas en orden (texto de `print`, resultado de escritura, documento/valor, cursor paginable) + `elapsed_ms`; comandos Tauri `execute_script(sid, db, code)`, `next_batch`, `close_cursor`, `cancel_script` registrados en `lib.rs` (R5, R7)

### Paso 3: Servicio en el frontend
- [ ] `src/features/shell/application/ports.ts` (`ShellGateway`) + `infrastructure/tauriShellGateway.ts`; `application/shellService.ts` con paginación skip/limit sobre lotes; registrar en `src/app/services.tsx`
- [ ] Tests: `shellService.test.ts` con gateway falso; `cargo test` del prelude contra un mock de `__native` (encadenado de cursor, `forEach`, `use`)

### Paso 4: Verificación
- [ ] Prueba real contra Mongo local desde devtools: `db.getCollection('x').find({}).sort({_id:-1}).limit(5)`; un script con `forEach` + `print`; `insertOne` + `find` en el mismo script; `use otra; db.y.count()`; cancelar un `while(true)`
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(shell): API db/colección/cursor y ejecución de scripts`
- **Cierre de Fase 2**

## Criterios de aceptación
- [ ] Scripts de varias sentencias con variables y bucles se ejecutan contra el servidor real
- [ ] Un `find` grande se recorre por lotes sin cargar toda la colección en memoria
- [ ] Un script lento se puede cancelar y la sesión sigue usable
- [ ] Los cursores se cierran al desconectar la sesión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
