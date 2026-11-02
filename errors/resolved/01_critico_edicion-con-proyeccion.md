# 01. Edicion con proyeccion

- **Severidad:** CRÍTICO
- **Dónde:** src/features/shell/ui/results/useDocumentMenu.ts, src-tauri/src/shell/prelude/cursor.js
- **Estado:** resuelto — con proyección el resultado no es editable (marca `editable` del cursor). Menú compacto: Expandir/Colapsar si aplica, «Ver documento…», «Copiar valor/nombre/ruta» en campos y «Copiar JSON» en documentos, objetos y arrays; sin editar, insertar ni eliminar, y Supr no borra.

## Problema
Se pueden editar documentos de un `find` con proyección, y guardar reemplaza el documento entero con lo que se ve.

## Escenario de fallo
`db.c.find({}, {name:1})` → editar `name` → guardar → se borran todos los demás campos del documento.

## Recomendación
Si el cursor tiene proyección (`find(q, proj)` o `.projection()`), desactivar la edición o volver a leer el documento completo de la BD antes de abrir el editor.
