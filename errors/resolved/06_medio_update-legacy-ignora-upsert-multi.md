# 06. Update legacy ignora upsert multi

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (`update(filter, update, options = {})`)
- **Estado:** resuelto

## Problema
Se ignoran los argumentos booleanos de la sintaxis antigua `update(q, u, upsert, multi)`.

## Escenario de fallo
`db.c.update(q, u, false, true)` modifica un solo documento y no avisa. `update(q, u, true)` no hace upsert.

## Recomendación
Aceptar la firma booleana (mapearla a `{upsert, multi}`) o dar error.
