# 34. Editar en vista o timeseries

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/prelude/cursor.js (`_editable()`), src/features/explorer/ui/explorerMenu.tsx
- **Estado:** resuelto — los `find` sobre una vista o una timeseries no son editables (`listCollections` al mostrar el resultado): menú compacto con «Ver documento…», sin editar, insertar ni eliminar. En timeseries el menú de colección ya no ofrece «Renombrar» ni «Validación»; las vistas ya tenían su propio menú.

## Problema
Los resultados de un `find` sobre una vista o una colección timeseries se marcan como editables, y el menú de colección ofrece las mismas acciones (validación, renombrar) en vistas y timeseries.

## Escenario de fallo
Editar o eliminar un documento de una vista da un error del servidor en lugar de no ofrecerse.

## Recomendación
Marcar `editable: false` cuando la colección es vista (o timeseries para reemplazos) y adaptar el menú al tipo de colección.
