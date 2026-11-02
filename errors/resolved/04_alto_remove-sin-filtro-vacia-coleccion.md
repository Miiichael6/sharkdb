# 04. Remove sin filtro vacia coleccion

- **Severidad:** ALTO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (`remove(filter = {}, justOne)`)
- **Estado:** resuelto — `remove`, `deleteOne`, `deleteMany` (también en `bulkWrite` y `explain().remove`) exigen filtro; para borrar todo hay que pasar `{}` explícito.

## Problema
Si no se le pasa filtro, `remove()` usa `{}`.

## Escenario de fallo
`db.c.remove()` borra todos los documentos de la colección. mongosh y el shell antiguo exigen un filtro.

## Recomendación
Que `remove()` sin argumentos dé error.
