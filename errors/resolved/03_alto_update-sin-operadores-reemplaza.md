# 03. Update sin operadores reemplaza

- **Severidad:** ALTO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (updateOne/updateMany/findOneAndUpdate/replaceOne), src-tauri/src/shell/prelude/bulk.js
- **Estado:** resuelto — `updateOne`/`updateMany`/`findOneAndUpdate`, `Bulk.find().update/updateOne` y `bulkWrite` rechazan un update sin operadores `$` (o pipeline); `replaceOne`/`findOneAndReplace` rechazan un reemplazo con claves `$`, como mongosh. El `update()` legacy queda para la 06.

## Problema
No se comprueba que el documento de update use operadores `$`, ni que `replaceOne` no los use.

## Escenario de fallo
`db.c.updateOne({_id}, {status:'x'})` reemplaza el documento entero por `{status:'x'}` (mongosh lo rechaza). Lo mismo con `updateOne` en `bulkWrite`.

## Recomendación
Igual que mongosh: un update debe empezar por `$` o ser un pipeline; un replace no puede contener claves con `$`. Si no, error.
