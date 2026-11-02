# 31. Editar indice misma clave ventana

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/application/explorerService.ts (`replaceIndex`)
- **Estado:** pendiente

## Problema
Con la misma clave, el índice se borra y se recrea aunque no haya cambios. Mientras tanto, un índice `unique` no protege.

## Escenario de fallo
Durante la recreación entra un duplicado y el nuevo índice `unique` falla; si además falla la restauración, la colección se queda sin el índice.

## Recomendación
No hacer nada si la especificación no cambió; para cambios que lo permitan (`hidden`, `expireAfterSeconds`, `unique` en 6.0+) usar `collMod` en lugar de borrar y crear.
