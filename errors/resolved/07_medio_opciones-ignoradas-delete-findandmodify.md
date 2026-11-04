# 07. Opciones ignoradas delete findandmodify

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (deleteOne/deleteMany/findOneAndUpdate/findOneAndReplace)
- **Estado:** resuelto

## Problema
Se descartan opciones: `deleteOne` y `deleteMany` no pasan `collation` ni `hint`; `findOneAndUpdate` solo pasa `sort`, `projection`, `upsert` y `returnNewDocument`, y descarta `arrayFilters`, `collation`, `hint` y `returnDocument:'after'`.

## Escenario de fallo
Sin `collation` (por ejemplo, para no distinguir mayúsculas) se borra un conjunto distinto del esperado. Sin `arrayFilters` el update falla o modifica otros elementos. Con `returnDocument:'after'` se devuelve el documento anterior.

## Recomendación
Pasar todas las opciones al comando `delete`/`findAndModify`.
