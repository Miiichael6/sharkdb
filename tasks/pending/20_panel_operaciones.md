# 20 · Panel de operaciones en segundo plano

**Estado:** ⬜ Pendiente
**Fase:** 9 Operaciones de BD
**Depende de:** 15
**Doc:** D9 en [00_README.md](../00_README.md) · R38

## Objetivo

Los trabajos largos (sync, backup, restore) dejan de vivir dentro de su ventana. Los arranca y vigila la **ventana principal**, y se ven en un **panel lateral derecho "Operaciones"**. Ese panel muestra el porcentaje y permite cancelar. Mientras, se sigue trabajando en la app.

## Pasos

### Paso 1: Dominio y servicio de operaciones
- [ ] `src/shared/domain/operations.ts` (nuevo):
  - Tipos `Operation {id, kind: "sync"|"backup"|"restore", title, source, target, status: "running"|"done"|"failed"|"cancelled", progress, results, error, startedAt, endedAt}`.
  - Reducer puro `operationsReducer`, con los eventos `started`, `progress`, `finished`, `failed`, `cancelled` y `cleared`.
  - `runningOn(ops, targetSid)` (regla: **un solo trabajo que escribe por conexión de destino**).
  - Textos `OPERATION_BUSY_TARGET` = "Ya hay una operación escribiendo en {destino}" y `operationSummary`.
- [ ] `src/shared/application/operationsService.ts` (nuevo): `start(kind, request)` lanza el trabajo con `createJobRunner` de 15 y emite eventos al reducer; `cancel(id)` usa `cancel_job`. Rechaza con `OPERATION_BUSY_TARGET` un segundo trabajo de escritura sobre el mismo destino. Los backups no escriben en Mongo y pueden ir en paralelo.
- [ ] Tests: `operations.test.ts` (transiciones, %, la regla del mismo destino, limpiar las terminadas) y `operationsService.test.ts` con gateway falso.

### Paso 2: Panel lateral en la ventana principal
- [ ] Crear `src/app/operations/useOperations.tsx` (nuevo): proveedor y hook sobre el servicio, montado en la ventana principal. El progreso llega por el evento global `job-progress`, que ya escuchan todas las ventanas.
- [ ] Crear `src/app/operations/OperationsPanel.tsx` y `OperationRow.tsx` (nuevos), que juntos forman el panel derecho:
  - **Secciones por tipo: Sync, Backup y Restore**, cada una con su contador de operaciones en curso y plegable. Una sección vacía muestra "Sin operaciones".
  - Una fila por operación: `origen → destino` con `TagBadge`, barra de % (`JobProgressBar`), colección actual `bd.colección (3 de 35)` y botón **Cancelar**.
  - **Cancelar pide confirmación en una sub-ventana** (`ConfirmWindow` de 18): "¿Cancelar la sincronización QA → local? Las colecciones ya copiadas se conservan; la que está a medias no se toca". Solo se cancela si se confirma.
  - Las terminadas muestran el resumen o el error y la duración.
  - Botón "Limpiar terminadas".
  - El panel se abre solo al empezar una operación. Cerrarlo **no** cancela nada.
- [ ] `WorkspaceToolbar.tsx`: botón "Operaciones" con contador de las que están en curso y el % de la más antigua; abre y cierra el panel. Al terminar, aviso en el centro de notificaciones (13), con éxito o error.
- [ ] Al cerrar la app con operaciones en curso se pide confirmación con `ConfirmWindow`: "Hay N operaciones en curso; se cancelarán".

### Paso 3: Verificación
- [ ] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy` y `cargo test` en verde.
- [ ] Prueba manual **solo con local y QA**, con un trabajo de prueba lanzado sobre local:
  - El panel se abre y el % avanza.
  - Se puede navegar el árbol mientras corre.
  - La operación sale en su sección (Sync, Backup o Restore).
  - Cancelar abre la sub-ventana de confirmación. Si se responde que no, la operación sigue; si se responde que sí, se detiene y el destino queda intacto.
  - Un segundo trabajo sobre el mismo destino se rechaza.
- [ ] Commit: `feat(operations): panel de operaciones en segundo plano` (propuesto, pendiente del usuario)

## Criterios de aceptación

- [ ] Una operación en curso no bloquea la ventana principal: se sigue usando el árbol y el shell.
- [ ] El panel derecho agrupa las operaciones en secciones Sync, Backup y Restore, y cada una muestra el % real y la colección actual.
- [ ] Cancelar siempre pide confirmación en una sub-ventana y, si se confirma, detiene el trabajo sin dejar colecciones a medias (staging de 15).
- [ ] No pueden correr dos operaciones que escriban en la misma conexión de destino.
- [ ] Al terminar llega una notificación con el resumen, aunque el panel esté cerrado.

## Bitácora

_(fecha: nota)_
