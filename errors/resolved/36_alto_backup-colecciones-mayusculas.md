# 36. Backup pierde colecciones que solo difieren en mayúsculas

- **Severidad:** ALTO
- **Dónde:** src-tauri/src/backup/format.rs (`file_stem`), src-tauri/src/backup/dump.rs (`dump_collection`), src-tauri/src/backup/folder.rs, src-tauri/src/backup/restore.rs
- **Estado:** resuelto — al guardar, `format::unique_stems` da a cada colección (y a cada carpeta de BD) un nombre de archivo que no choca sin distinguir mayúsculas (`Users~1.bson`); el nombre real se lee del `collectionName` del `.metadata.json` y, para la BD, de `NOMBRE_BD.txt` (sin ellos, el del archivo o carpeta: los backups anteriores y los de `mongodump` se leen igual). El catálogo y el restore usan ese nombre real; dos archivos de la misma colección o BD dan un error claro en vez de restaurar una sobre otra. Tests: `format.rs` (`names_that_differ_only_in_case_get_different_files`, `the_real_name_comes_from_the_metadata`), `folder.rs` (`collections_are_listed_with_the_name_their_metadata_gives`, `two_files_of_the_same_collection_are_an_error`, `databases_are_listed_with_the_name_noted_in_their_folder`) y el live `live_backup_and_restore_of_several_databases` con `users` y `Users`.

## Problema
`file_stem` solo rechaza caracteres prohibidos. En MongoDB `users` y `Users` son colecciones distintas, pero en NTFS (Windows) y APFS (macOS por defecto) `users.bson` y `Users.bson` son el mismo archivo: `fs::rename` sobrescribe el `.bson` y `fs::write` el `.metadata.json` de la primera.

## Escenario de fallo
Backup de una BD completa con `users` y `Users`: el resultado informa 2 colecciones guardadas, pero en la carpeta solo hay una, con los datos de la segunda. Al restaurar "completa", `users` no vuelve (o vuelve con los datos de `Users`), aunque el usuario cree tener un backup íntegro.

## Recomendación
Antes de volcar, detectar colisiones sin distinguir mayúsculas dentro de cada BD y abortar con un error claro, o codificar el nombre del archivo (p. ej. escapar mayúsculas como hace mongodump con `%`) y decodificarlo en el restore.
