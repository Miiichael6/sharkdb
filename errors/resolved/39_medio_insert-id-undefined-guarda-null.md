# 39. insertOne({_id: undefined}) guarda _id: null

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/common.js (`withId`)
- **Estado:** resuelto — se rechaza con error claro en lugar de generar ObjectId (decisión: avisar del typo antes que imitar a mongosh). `withId(doc, name)` falla si `_id === undefined` en `insertOne`, `insertMany`/`insert` (indicando el índice del documento), `Bulk.insert` y `bulkWrite insertOne`. Sin clave `_id` se sigue generando ObjectId; `_id: null` explícito se respeta.

## Problema
`withId` comprueba `'_id' in doc`, así que con `_id: undefined` no genera ObjectId; el `undefined` se convierte en `Null` (convert/to_bson.rs). Afecta a `insertOne`, `insertMany`, `insert`, `Bulk.insert` y al `insertOne` de `bulkWrite`.

## Escenario de fallo
`db.c.insertOne({_id: idCalculado, ...})` con `idCalculado` sin definir inserta un documento con `_id: null`; el siguiente insert igual falla con duplicate key. El driver de mongosh genera un ObjectId cuando `doc._id == null`.

## Recomendación
Generar ObjectId cuando `doc._id === undefined` (sobrescribiendo la clave), o rechazar `_id: undefined` con un error claro.
