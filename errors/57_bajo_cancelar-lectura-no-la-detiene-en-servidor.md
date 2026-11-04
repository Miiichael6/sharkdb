# 57. Cancelar o agotar el tiempo de una lectura no la detiene explícitamente en el servidor

- **Severidad:** BAJO (era MEDIO; rebajado tras revisar el driver)
- **Tipo:** implícito (la operación puede seguir en el servidor tras "Detener")
- **Dónde:** src-tauri/src/shell/native/mod.rs (`open` para `find`/`aggregate` de lectura; `query`/`wait` para `runCommand` de lectura), src-tauri/src/shell/native/cursors.rs (abort de la tarea en el drop de `Opening`)
- **Estado:** pendiente
- **Relacionado:** #09 (resuelto, solo cubre escrituras)

## Problema
Solo las escrituras se matan explícitamente al cancelar (`killSessions`, o `killOp` por `comment` para `$out`/`$merge`, error 09). Para lecturas la cancelación es del lado del cliente: se aborta la tarea tokio o el `select!` contra `watchdog.interrupted()`, sin `maxTimeMS` ni `killOp`.

Mitigación existente: el driver (mongodb 2.8.2, `cmap/worker.rs` `check_in`) cierra la conexión si se suelta a mitad de un comando (`ConnectionClosedReason::Dropped`), y mongod 4.2+ mata `find`/`aggregate`/`count`/`distinct` al detectar la desconexión. Queda abierto: servidores anteriores a 4.2, comandos de lectura que no comprueban interrupción, y cursores abiertos en el servidor hasta su timeout de inactividad.

## Escenario de fallo
Contra un servidor < 4.2, un `aggregate` pesado cancelado y relanzado varias veces deja las operaciones originales en `currentOp` hasta terminar.

## Recomendación
Pasar a `find`, `aggregate` y `runCommand` de lectura un `maxTimeMS` derivado del timeout del shell (si el usuario no puso uno).
