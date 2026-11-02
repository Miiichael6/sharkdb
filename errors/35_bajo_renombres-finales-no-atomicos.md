# 35. Renombres finales no atómicos

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/backup/staging.rs (`Replacements::commit`, `partial_replace_error`)
- **Estado:** pendiente

## Problema
Sync y restore cambian cada colección por su provisional con un `renameCollection` + `dropTarget` aparte. Cada uno es atómico, pero el conjunto no: si uno falla, los anteriores ya están hechos y no se deshacen.

## Escenario de fallo
Restore de `users`, `orders` y `products`. Se reemplazan `users` y `orders`, y falla el de `products`. `products` sigue con sus datos originales (su provisional y las siguientes se borran), así que no se pierde nada, pero el destino queda mezclado: dos colecciones nuevas y una vieja. Es un problema si dependen entre sí (por ejemplo, `orders` nuevos que apuntan a productos que solo existen en el `products` nuevo). El error dice cuáles se reemplazaron.

## Recomendación
Opciones, de menor a mayor esfuerzo:
- Ofrecer en el error «Reintentar lo que falta», reutilizando el mismo trabajo.
- Antes de renombrar, mover las originales a respaldos (`<col>.sharkdb-backup-<run>`) y, si un renombre falla, restaurarlas; borrar los respaldos al terminar bien.
