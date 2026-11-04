# 46. La retención borra backups buenos y conserva ejecuciones fallidas

- **Severidad:** MEDIO
- **Dónde:** src/features/backup/domain/runFolders.ts (`runsToDelete`), src-tauri/src/backup/dump.rs, src-tauri/src/backup/folder.rs, src-tauri/src/schedule/runs.rs
- **Estado:** resuelto — `dump_databases` crea `BACKUP_INCOMPLETO.txt` en la carpeta del backup al empezar y lo borra solo si termina bien (folder.rs `mark_incomplete`/`mark_complete`). `list_runs` dice qué ejecuciones están completas; `runsToDelete` conserva las 7 últimas completas y borra las sin terminar más viejas que la última completa (una más nueva puede seguir en curso). El restore (`backup_databases`) rechaza una carpeta marcada, también si se elige la de una de sus BDs. Los backups de antes del cambio no tienen marca y siguen contando como completos.
- **Relacionado:** 47

## Problema
`dump_databases` crea `<run>/<bd>` y escribe colecciones antes de fallar; si falla o se cancela, la carpeta queda a medias sin marca. `prune` cuenta como una de las N a conservar cualquier carpeta con nombre de ejecución, también las fallidas. El restore también las ofrece como válidas.

## Escenario de fallo
Una colección programada se borra (ver 47) y los 6 backups diarios siguientes fallan a mitad. Se arregla la programación, la siguiente sale bien y `prune` conserva la nueva + las 6 parciales: borra todos los backups completos.

## Recomendación
Escribir la ejecución como `<stamp>.partial` (o con marcador `.incomplete`) y renombrarla al terminar bien; `runsToDelete` y el restore solo deben contar las completas; ante fallo, borrar o marcar la carpeta.
