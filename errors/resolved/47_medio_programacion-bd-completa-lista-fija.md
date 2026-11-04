# 47. Una programación de "BD completa" guarda una lista fija de colecciones

- **Severidad:** MEDIO
- **Dónde:** src/features/backup/domain/schedule.ts (`backup: BackupRequest`), src/features/backup/domain/runFolders.ts (`runRequest`), src-tauri/src/backup/source.rs
- **Estado:** resuelto — cada BD elegida entera se guarda con `complete: true`; cada ejecución conecta primero y pide `database_catalog`, así que las colecciones nuevas entran solas y la ventana las muestra marcadas al reabrirla. Lo elegido que ya no existe se salta con aviso (en la app y del sistema); solo falla si no queda nada. La ficha dice «1 base de datos completa». Las programaciones anteriores conservan su lista fija hasta volver a guardarlas.

## Problema
La programación guarda `databases[].collections` explícito y no recuerda que se eligió la BD entera.

## Escenario de fallo
- Las colecciones creadas después nunca se respaldan y nadie avisa.
- Si una colección se borra o renombra, cada ejecución falla con "La colección no existe", lo que alimenta la 46.

## Recomendación
Guardar `complete: true` por BD y resolver las colecciones con `database_catalog` en cada ejecución. En selecciones parciales, saltar con aviso las colecciones que ya no existen en vez de abortar.
