# 60. Sin instancia única: dos instancias duplican los backups programados y la retención de una borra la copia en curso de la otra

- **Severidad:** MEDIO
- **Tipo:** implícito, en segundo plano
- **Dónde:** src-tauri/Cargo.toml / tauri.conf.json (sin `tauri-plugin-single-instance` ni lock), src/features/backup/ui/useBackupSchedules.ts (`runDue`: `firstDue` → `save(afterScheduledRun)` → `execute`, con estado en memoria por instancia), src/features/backup/domain/runFolders.ts (`runName`, `runsToDelete`), src-tauri/src/schedule/runs.rs (`remove_runs` → `remove_dir_all`), src-tauri/src/backup/folder.rs (`mark_incomplete`/`mark_complete`)
- **Estado:** resuelto — turno compartido entre ventanas para las programadas (releyendo el store), bloqueo de backup/sync/restore mientras otra ventana tiene uno en curso, carpeta de ejecución creada en exclusiva y retención que respeta las incompletas recientes.
- **Relacionado:** #46 (resuelto: su supuesto "una más nueva puede seguir en curso" solo vale con un único ejecutor), #48, #44 (ya reconoce que cada ventana de SharkDB es un proceso aparte)

## Problema
- Cada instancia tiene su propio ticker, su copia en memoria de las programaciones y su `runningRef`; `save(afterScheduledRun)` escribe el store, pero la otra instancia no lo relee, así que las dos lanzan la misma programación.
- `runName` evita colisiones solo con lo que ya existe en disco: si las dos listan antes de crear la carpeta, escriben en la misma `AAAA-MM-DD_HHMM` a la vez y la primera en terminar quita el marcador de incompleta mientras la otra sigue escribiendo.
- Si se llaman `X` y `X_2` y `X_2` termina antes, su retención ve `X` como incompleta anterior a la completa más nueva y la borra (`remove_dir_all`) mientras la otra instancia la escribe.

## Escenario de fallo
El usuario abre SharkDB otra vez desde el menú Inicio, con una copia programada a las 02:00 de la BD de producción: doble volcado completo (doble carga sobre producción) y, según el orden, una carpeta mezclada que parece completa o la copia de la primera instancia borrada a medias. Las dos instancias también se pisan el store de programaciones.

## Recomendación
~~Añadir `tauri-plugin-single-instance`~~ — descartado: se quieren varias ventanas abiertas a la vez.

## Solución acordada
1. **Turno compartido entre instancias para las programadas:** lock de archivo común (en el directorio de datos de la app) que toma la instancia que lanza una programada; las demás lo ven y no la lanzan. Antes de ejecutar, releer el store de programaciones para ver si otra instancia ya la hizo. El lock caduca solo (latido/marca de tiempo) si la instancia que lo tenía se cae.
2. **Bloquear, no solo avisar:** si otra ventana tiene en curso una operación pesada (backup, sync, restore), la ventana B lo indica ("… en curso en otra ventana") y **no permite lanzar la operación** hasta que la de la ventana A termine (no es un "¿seguir de todos modos?").
3. **Defensas extra:**
   - Crear la carpeta de la ejecución en exclusiva (`create_dir`, que falla si existe, y reintentar con `_n`), para que dos copias nunca escriban en la misma carpeta.
   - Que la retención no borre incompletas recientes (pueden seguir en curso en otra instancia).

## Solución
- **Registro común entre instancias** (src-tauri/src/jobs/shared.rs): cada trabajo pesado se anota como `<config>/en-curso/<pid>-<trabajo>.en-curso` (contenido: «un backup», «un sync»…). Comprobar y anotar se hace bajo un cerrojo exclusivo (`.registro.lock`, `create_new`), así que dos instancias nunca se ven libres a la vez. Un hilo de latido (`jobs::events::start_heartbeat`) renueva cada 5 s los archivos propios; uno sin renovar en 30 s es de una instancia caída y se borra al verlo. Un cerrojo de más de 5 s también se considera abandonado.
- **Bloqueo** (punto 2): `Jobs::start` (backup, restore, sync) anota el trabajo y lo rechaza con «Hay … en curso en otra ventana de SharkDB: espera a que termine» si otra instancia tiene algo en marcha; dentro de una misma ventana todo sigue como antes. El backend es quien manda; además, el frontend consulta `busy_elsewhere` cada 3 s (`OtherWindows`, `operationsService.checkElsewhere`) para mostrarlo antes de lanzar: `busyReason` de las operaciones, el botón de confirmar del backup deshabilitado (`blocked`) y ▶ de las programadas.
- **Turno de las programadas** (punto 1): `runDue` (useBackupSchedules.ts) pide `take_schedule_turn` antes de nada; con el turno relee las programaciones del disco y solo ejecuta si la programación sigue vencida, guardando `afterScheduledRun` antes de lanzar. El turno se mantiene hasta que la ejecución termina y entonces se suelta (`release_schedule_turn`); mientras otra instancia lo tiene, o tiene cualquier trabajo pesado, esta espera al siguiente tic.
- **Carpeta en exclusiva** (punto 3a): `create_backup_run` (schedule/runs.rs `create_run`) crea la carpeta con `create_dir` —que falla si existe— probando `AAAA-MM-DD_HHMM`, `_2`, `_3`… y la marca incompleta al crearla; el frontend usa el nombre que devuelve (`runFolder`). Se quitó `runName`.
- **Retención** (punto 3b): `runsToDelete(folders, now)` nunca borra una ejecución incompleta que empezó hace menos de `RECENT_UNFINISHED_MS` (24 h).
