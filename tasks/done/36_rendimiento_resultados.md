# 36 · Rendimiento de los resultados

**Estado:** ✅ Terminada
**Fase:** 21 Rendimiento · **Depende de:** 34 · **Doc:** R73, R74, R75

## Objetivo
Un `find` o `aggregate` devuelto tal cual llega a la vista sin el viaje BSON → JS → BSON, solo se trae lo que se muestra, y el tiempo se muestra separado en consulta y carga para compararlo con Robo 3T.

## Pasos

### Paso 1: Cursor sin pasar por JavaScript
- [x] `src-tauri/src/shell/`: cuando el valor de una sentencia es un cursor que el script no leyó, el primer lote va del driver a la salida directamente en BSON/EJSON, sin convertir a valores de QuickJS (medido: ~45 ms de ~75 ms en release con 50 docs grandes) (R73)
- [x] Los cursores que el script recorre (`forEach`, `toArray`, `next`) siguen igual; acelerar la conversión BSON ↔ JS solo si la medición lo justifica (R73)

### Paso 2: Traer solo la página
- [x] El primer lote pide el tamaño de página de la vista (50) en vez del lote por defecto; el pager pide el resto al paginar (R74)

### Paso 3: Tiempo de consulta y de carga
- [x] `outcome.rs` y `domain/outcome.ts`: separar el tiempo hasta la respuesta del servidor del de traer y convertir; la barra muestra ambos (p. ej. `0.006 s · carga 0.070 s`) (R75)

### Paso 4: Verificación
- [x] Medir antes/después en dev y release con `ALEMANIA_AL02_Obras` en Mongo **local**, anotar cifras en la Bitácora
- [x] Tests de motor: cursor directo, cursor recorrido por el script y paginación siguen dando lo mismo
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `cargo test` pasan
- [x] Commit: `perf(shell): cursores sin conversión a JS y tiempo de consulta y carga`

## Criterios de aceptación
- [x] `find({})` sobre 50 docs grandes tarda claramente menos que hoy (0,160 s en dev), con cifras anotadas
- [ ] El tiempo de consulta mostrado es comparable al de Robo 3T (ver Bitácora: pendiente de comparar a mano)
- [x] Los resultados, la paginación y las vistas no cambian

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: `opt-level = 2` en dependencias ya bajó dev de 0,450 s a 0,160 s; Robo 3T mide solo el envío (cursor perezoso).
- 2026-11-01: `find({})` en `OPE_PEX.ALEMANIA_AL02_Obras` (~19 KB/doc): dev 157 → 64 ms, release 77 → 21 ms; consulta ~2 ms. Medido con un test live temporal, ya quitado.
- 2026-11-01: Rust (`prelude/cursor_result.rs`) completa el primer lote y marca el cursor JS con `_exhaust` si se agota; consulta = esperas de `find`/`aggregate`/comandos, el `getMore` cuenta como carga.
- 2026-11-01: Sin Robo 3T ni la app abierta aquí: falta comparar a mano la cifra de consulta con Robo 3T y ver la barra (cubierta por tests de `timingText`).
