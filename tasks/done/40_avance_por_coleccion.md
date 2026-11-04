# 40 · Avance por colección en sync, restore y backup

**Estado:** ✅ Terminada
**Fase:** 25 Detalle de operaciones · **Depende de:** 20, 22 · **Doc:** R94, R95 (D23)

## Objetivo
Hoy cada operación solo informa un avance agregado (`job-progress`: colección actual + proporción global), y en el sync se copian 3 colecciones a la vez. Esta tarea hace que el backend informe **el estado y el porcentaje de cada colección** y que cada `Operation` del frontend lleve esa lista, lista para que la 41 la pinte.

## Pasos

### Paso 1: Backend (Rust)
- [x] `src-tauri/src/jobs/report.rs`: nuevo `CollectionProgress { db, collection, state, done, total, error? }` con `state` = `running | copied | applied | failed` (los estados de D23 que conoce el backend; `pending` y `discarded` los deduce el frontend). `db` y `collection` van separados, no como la etiqueta `db.coll`
- [x] `jobs/events.rs`: evento `job-collection` (con `job`), emitido junto a `job-progress` sin tocar este último, para no romper la barra actual
- [x] Emisores: `sync/copy.rs` (cada copia en paralelo informa la suya; `copied` al terminar la provisional, `applied` por colección cuando `Replacements::finish` la reemplaza), `backup/restore.rs` (igual: `copied` → `applied`) y `backup/dump.rs` (pasa directo a `applied`: el archivo ya está escrito). `failed` lleva el error de esa colección (R94)
- [x] Tests Rust con un `report` falso: el sync con 3 en paralelo emite el avance de cada colección por separado; ninguna llega a `applied` antes de que todas estén `copied`; un fallo marca `failed` solo la que falló

### Paso 2: Dominio del frontend (lógica pura + tests)
- [x] `src/shared/domain/collectionProgress.ts` (nuevo): tipos `CollectionStatus` (`pending | running | copied | applied | failed | discarded`) y `CollectionProgressEntry`; `plannedCollections(databases)` arma la lista inicial en `pending` desde la selección del request; `applyCollectionEvent(list, event)`; `settleCollections(list, opStatus)` al terminar la operación: si falló o se canceló, toda colección no `applied` pasa a `discarded` porque el destino quedó como estaba (R95)
- [x] Mismo archivo: `byDatabase(list)` agrupa por BD en el orden del plan y `databaseSummary(group)` → `{ applied, total, percent, worst }` (`worst` = el estado que manda en la cabecera: failed > running > copied > pending > applied)
- [x] Tests: plan inicial, eventos fuera de orden o tardíos (un evento de una operación ya terminada no cambia nada), cancelación con colecciones `copied` → `discarded`, resumen por BD, restore con duplicados (sigue `applied`; el aviso sale de `CollectionResult.duplicates`)

### Paso 3: Integración
- [x] `shared/domain/operations.ts`: `Operation` gana `collections`; `OperationSpec` lleva `databases` (la selección) para el plan inicial; nuevo evento de reducer `collection`; `finished/failed/cancelled` llaman a `settleCollections`
- [x] Adaptador Tauri de operaciones (`shared/infrastructure`, junto al que escucha `job-progress`): escucha `job-collection` y lo despacha con su `id`; `useDataOperations.ts` pasa `request.databases` en el spec de sync, restore y backup

### Paso 4: Verificación
- [x] Sync real de 2 BDs con varias colecciones: las 3 en paralelo avanzan cada una con su %, la barra global sigue igual que antes
- [x] Cancelar a mitad: las colecciones ya copiadas acaban en `discarded`, no en verde; restore con un error forzado: solo esa colección en `failed`
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `cargo test`, `npm test`, typecheck y `vite build` pasan (sin `cargo fmt`: reformatea medio `src-tauri`)
- [x] Commit: `feat(operations): avance y estado de cada colección en sync, restore y backup`

## Criterios de aceptación
- [x] Cada operación sabe, en todo momento, el estado y el % de cada una de sus colecciones, agrupadas por BD
- [x] En sync y restore ninguna colección figura como aplicada antes de que el destino se haya reemplazado de verdad
- [x] Al cancelar o fallar, lo que no se aplicó queda marcado como descartado
- [x] El evento `job-progress` y la barra global de la fila no cambian

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario junto con la 41. El estado intermedio `copied` existe porque sync y restore solo reemplazan el destino al final (`backup::staging`): pintar verde al copiar mentiría si luego falla otra colección.
- 2026-11-04: D23 aceptada tal cual. Los emisores reciben un trait `Report` (avance agregado + por colección) en vez de un closure; `jobs/collections.rs` recuerda el último avance de cada una para que copiada/aplicada/fallida salgan con su %.
- 2026-11-04: Una colección parada por "Cancelar" o por el fallo de otra no se avisa como fallida: queda en running/copied y el frontend la pasa a descartada. Al terminar bien, todas pasan a aplicadas aunque falte algún evento.
- 2026-11-04: Verificado con las pruebas reales (`--ignored`) contra el mongod local: 3 en paralelo con avance propio, ninguna aplicada antes de estar todas copiadas, `.bson` roto → solo esa en fallida. La vista en la app llega con la 41.
