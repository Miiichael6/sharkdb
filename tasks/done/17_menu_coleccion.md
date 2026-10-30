# 17 · Menú contextual completo de colección

**Estado:** ✅ Terminada (prueba manual del menú pendiente en la UI)
**Fase:** 7 Administración · **Depende de:** 09, 13 · **Doc:** R35

## Objetivo
El menú contextual de una colección tiene las mismas entradas que Robo 3T: ver, insertar, actualizar y eliminar documentos, eliminar todos, renombrar, duplicar, eliminar colección, estadísticas, versión y distribución de shards.

## Pasos

### Paso 1: Plantillas de shell y API de shards
- [x] `src/features/shell/domain/collectionScripts.ts`: script de cada acción de colección que abre un shell (ver, actualizar, eliminar, versión y distribución de shards) y si se ejecuta al abrir; `defaultQuery` reutiliza la misma expresión `getCollection` (R35)
- [x] `src-tauri/src/shell/prelude/prelude.js`: `getShardVersion()` y `getShardDistribution()` en `Collection` (error claro si la colección no está fragmentada) (R35)

### Paso 2: Duplicar colección
- [x] `explorerService.duplicateCollection(sid, db, coll, name)`: `$out` en la misma BD + copia de índices, reutilizando `copyCollection` (R35)
- [x] `writeActions.ts`: duplicar, copiar, actualizar y eliminar documentos cuentan como escritura en safe mode

### Paso 3: Menú y enrutado
- [x] `Explorer.tsx`: menú de colección en el orden de Robo 3T; `Workspace.tsx`/`App.tsx`: las acciones de script abren pestaña con su plantilla
- [x] `useExplorerActions.ts`: diálogo "Duplicar colección" (nombre por defecto `<coll>_copy`)

### Paso 4: Tests
- [x] vitest: `collectionScripts`, `duplicateCollection`, `writeActions`
- [x] Rust: tests del prelude para `getShardVersion` / `getShardDistribution`

### Paso 5: Verificación
- [x] `npm test`, `tsc`, lint y `cargo test` pasan
- [x] Prueba real contra Mongo local (`cargo test live -- --ignored`): plantillas de actualizar/eliminar, `$out` del duplicado y consultas de shards; clic en el menú de la app pendiente de prueba manual en la UI
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] Commit: `feat(explorer): menú contextual completo de colección`

## Criterios de aceptación
- [x] El menú de colección muestra todas las entradas de Robo 3T y cada una hace algo
- [x] Actualizar/eliminar documentos abren un shell con la plantilla sin ejecutarla; ver documentos, versión y distribución de shards se ejecutan al abrir
- [x] Duplicar crea `<nombre>` con los mismos documentos e índices
- [x] En safe mode las entradas que escriben aparecen deshabilitadas

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: El Mongo local (< 4.4) rechaza `$out: { db, coll }`; `copyPipeline` usa `$out: "<nombre>"` dentro de la misma BD, así duplicar funciona en cualquier versión (copiar a otra BD sigue necesitando ≥ 4.4).
- 2026-10-30: Duplicar nunca reemplaza: si el destino existe da error (copiar sí reemplaza). Copiar colección no estaba en `ACTION_COMMANDS` y no se deshabilitaba en safe mode; corregido.
- 2026-10-30: Un mongod sin sharding responde a `getShardVersion` con `inShardedMode: false` (sin error); `getShardDistribution` sí falla con mensaje claro si la colección no está en `config.collections`.
