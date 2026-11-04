# 38. dropIndex('*') borra todos los índices

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (`dropIndex`)
- **Estado:** resuelto — `dropIndex('*')` y `dropIndex([...])` fallan sin enviar nada y remiten a `dropIndexes()`; con un nombre o una clave sigue igual.

## Problema
`dropIndex(name)` envía `{dropIndexes: c, index: name}` sin validar. Con `'*'` el servidor borra todos los índices salvo `_id`, incluidos los `unique`. mongosh (y el shell clásico desde 4.2) rechaza `'*'` en `dropIndex`.

## Escenario de fallo
`db.orders.dropIndex('*')` pensando en un comodín o copiado de un script: desaparecen los índices únicos y a partir de ese momento se pueden insertar duplicados, además del impacto en rendimiento.

## Recomendación
En `dropIndex`, si `name === '*'` o es un array, fallar remitiendo a `dropIndexes()`.
