# 31. Editar indice misma clave ventana

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/application/explorerService.ts (`replaceIndex`)
- **Estado:** resuelto — `replaceIndex` usa `inPlaceIndexChange`: si no cambia nada que el servidor guarde no hace nada, y `hidden` y `expireAfterSeconds` se cambian con `collMod` sin borrar el índice. Pasar a `unique` sigue borrando y creando (con `collMod` requiere 6.0+ y dos pasos con `prepareUnique`); si falla, se restaura el original (#12). Tests: `explorerService.test.ts` (`does nothing when nothing the server keeps changes`, `changes only the TTL in place, without dropping the index`, `hides the index in place`).

## Problema
Con la misma clave, el índice se borra y se recrea aunque no haya cambios. Mientras tanto, un índice `unique` no protege.

## Escenario de fallo
Durante la recreación entra un duplicado y el nuevo índice `unique` falla; si además falla la restauración, la colección se queda sin el índice.

## Recomendación
No hacer nada si la especificación no cambió; para cambios que lo permitan (`hidden`, `expireAfterSeconds`, `unique` en 6.0+) usar `collMod` en lugar de borrar y crear.
