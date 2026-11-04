# 40. aggregate con $out/$merge no se ejecuta si no se muestra

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (`aggregate`), src-tauri/src/shell/prelude/cursor.js (`_fetch`/`_take`)
- **Estado:** resuelto — como en Robo 3T (y mongosh), `Collection.aggregate` abre el cursor al llamarlo si alguna etapa es `$out` o `$merge` (`Cursor._start`), así escribe aunque se guarde en una variable, vaya en un bucle o pase de `MAX_RESULTS`, y en el orden del script. El resto de pipelines sigue perezoso. Como ya se ejecutó, un modificador después (`.allowDiskUse()`, `.maxTimeMS()`...) falla y explica que la opción va en el segundo argumento. No hay `Database.aggregate`. Tests: `tests/prelude.rs` (`write_pipeline_*`, `read_pipeline_stays_lazy`) y `tests/live.rs` (`live_write_pipeline_runs_when_called`).

## Problema
`aggregate()` solo crea un `Cursor` perezoso; el pipeline se envía al iterarlo o al mostrarlo como valor de una sentencia de primer nivel. mongosh ejecuta en el acto los pipelines con `$out`/`$merge`.

## Escenario de fallo
- `var r = db.a.aggregate([{$match:{}},{$merge:'b'}]);` no escribe nada.
- `for (const m of meses) db.v.aggregate([{$match:{m}},{$merge:'resumen'}])` escribe 0 documentos sin ningún error.
- Si se itera más tarde, se ejecuta fuera de orden y un `find()` intermedio ve datos viejos.
- Si ya se alcanzó `MAX_RESULTS`, la sentencia se descarta (`Step::Dropped`) y tampoco se ejecuta.

Los tests (`tests/live.rs`) usan `.toArray()` para forzarlo.

## Recomendación
En `Collection.aggregate` (y `Database.aggregate` si aplica), si alguna etapa tiene `$out` o `$merge`, abrir el cursor en el momento (`_fetch`/`hasNext()`).
