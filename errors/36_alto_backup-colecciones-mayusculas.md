# 36. Backup pierde colecciones que solo difieren en mayúsculas

- **Severidad:** ALTO
- **Dónde:** src-tauri/src/backup/format.rs (`file_stem`), src-tauri/src/backup/dump.rs (`dump_collection`)
- **Estado:** pendiente

## Problema
`file_stem` solo rechaza caracteres prohibidos. En MongoDB `users` y `Users` son colecciones distintas, pero en NTFS (Windows) y APFS (macOS por defecto) `users.bson` y `Users.bson` son el mismo archivo: `fs::rename` sobrescribe el `.bson` y `fs::write` el `.metadata.json` de la primera.

## Escenario de fallo
Backup de una BD completa con `users` y `Users`: el resultado informa 2 colecciones guardadas, pero en la carpeta solo hay una, con los datos de la segunda. Al restaurar "completa", `users` no vuelve (o vuelve con los datos de `Users`), aunque el usuario cree tener un backup íntegro.

## Recomendación
Antes de volcar, detectar colisiones sin distinguir mayúsculas dentro de cada BD y abortar con un error claro, o codificar el nombre del archivo (p. ej. escapar mayúsculas como hace mongodump con `%`) y decodificarlo en el restore.
