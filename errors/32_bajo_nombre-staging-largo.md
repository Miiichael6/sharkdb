# 32. Nombre staging largo

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/backup/staging.rs (`{colección}.sharkdb-staging-{run}`)
- **Estado:** pendiente

## Problema
El nombre provisional añade un sufijo largo al de la colección y puede superar el límite de 255 bytes del namespace.

## Escenario de fallo
Restaurar o sincronizar una colección con nombre muy largo falla al crear la colección provisional.

## Recomendación
Usar un nombre provisional corto (`sharkdb-staging-{run}-{n}`) y guardar el mapeo.
