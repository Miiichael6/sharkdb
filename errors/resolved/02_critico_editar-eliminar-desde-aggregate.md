# 02. Editar eliminar desde aggregate

- **Severidad:** CRÍTICO
- **Dónde:** src/features/shell/ui/results/useDocumentMenu.ts, src/features/shell/ui/results/CursorResult.tsx, src-tauri/src/shell/prelude/cursor.js
- **Estado:** resuelto — los resultados de aggregate no son editables (marca `editable` del cursor). Menú compacto: Expandir/Colapsar si aplica, «Ver documento…», «Copiar valor/nombre/ruta» en campos y «Copiar JSON» en documentos, objetos y arrays; sin editar, insertar ni eliminar, y Supr no borra.

## Problema
El cursor de `aggregate` usa como `ns` la colección de origen, así que editar o eliminar desde sus resultados actúa sobre los documentos reales, buscándolos por `_id`.

## Escenario de fallo
Con `$unwind`, al guardar el array queda en un solo elemento. Con `$group`, el `_id` del grupo puede coincidir con un documento real y se borra o reemplaza. Con `$project` o `$lookup` se pierden campos o se añaden los del join.

## Recomendación
No permitir editar ni eliminar en resultados de `aggregate`.
