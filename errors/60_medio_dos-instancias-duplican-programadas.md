# 60. Sin instancia única: dos instancias duplican los backups programados y la retención de una borra la copia en curso de la otra

- **Severidad:** MEDIO
- **Tipo:** implícito, en segundo plano
- **Dónde:** src-tauri/Cargo.toml / tauri.conf.json (sin `tauri-plugin-single-instance` ni lock), src/features/backup/ui/useBackupSchedules.ts (`runDue`: `firstDue` → `save(afterScheduledRun)` → `execute`, con estado en memoria por instancia), src/features/backup/domain/runFolders.ts (`runName`, `runsToDelete`), src-tauri/src/schedule/runs.rs (`remove_runs` → `remove_dir_all`), src-tauri/src/backup/folder.rs (`mark_incomplete`/`mark_complete`)
- **Estado:** pendiente
- **Relacionado:** #46 (resuelto: su supuesto "una más nueva puede seguir en curso" solo vale con un único ejecutor), #48, #44 (ya reconoce que cada ventana de SharkDB es un proceso aparte)

## Problema
- Cada instancia tiene su propio ticker, su copia en memoria de las programaciones y su `runningRef`; `save(afterScheduledRun)` escribe el store, pero la otra instancia no lo relee, así que las dos lanzan la misma programación.
- `runName` evita colisiones solo con lo que ya existe en disco: si las dos listan antes de crear la carpeta, escriben en la misma `AAAA-MM-DD_HHMM` a la vez y la primera en terminar quita el marcador de incompleta mientras la otra sigue escribiendo.
- Si se llaman `X` y `X_2` y `X_2` termina antes, su retención ve `X` como incompleta anterior a la completa más nueva y la borra (`remove_dir_all`) mientras la otra instancia la escribe.

## Escenario de fallo
El usuario abre SharkDB otra vez desde el menú Inicio, con una copia programada a las 02:00 de la BD de producción: doble volcado completo (doble carga sobre producción) y, según el orden, una carpeta mezclada que parece completa o la copia de la primera instancia borrada a medias. Las dos instancias también se pisan el store de programaciones.

## Recomendación
Añadir `tauri-plugin-single-instance` (o un lock de archivo para el scheduler). Como defensa extra: crear la carpeta de la ejecución en exclusiva (`create_dir`, que falla si existe, y reintentar con `_n`) y que la retención no borre incompletas recientes.
