# 21 · Sync en dos pasos: selección y confirmación

**Estado:** ⬜ Pendiente
**Fase:** 9 Operaciones de BD
**Depende de:** 20
**Doc:** D9 en [00_README.md](../00_README.md) · R39, R40

## Objetivo

El sync pasa a ser un asistente de dos sub-ventanas:
1. **Selección:** origen, destino y qué copiar; se sigue con **Continuar**.
2. **Confirmación:** "Se va a MODIFICAR…"; hay que escribir **`confirmo`** para habilitar **Sincronizar**, o se elige **Volver** o **Cancelar**.

Al confirmar, el trabajo corre en segundo plano en el panel de la tarea 20.

Origen y destino se eligen entre **todas las conexiones registradas en el gestor de la app**, no solo las abiertas. Todas son MongoDB, así que el sync es siempre MongoDB → MongoDB. Una conexión cerrada se conecta cuando hace falta.

La conexión elegida en un selector **no aparece en el otro**, así que origen y destino nunca pueden ser la misma.

## Pasos

### Paso 1: Dominio
- [ ] `src/features/sync/domain/syncPlan.ts`:
  - `syncSources` y `syncTargets` reciben las **conexiones registradas** (más las sesiones abiertas para saber cuáles están conectadas). Cada una devuelve `{id, name, tag, connected}`.
  - Los destinos excluyen siempre las protegidas o de producción (`neverModified`).
  - **Exclusión mutua**: `syncTargets(…, sourceId)` quita la conexión de origen y `syncSources(…, targetId)` quita la de destino. La opción no se deshabilita: desaparece del select.
  - `pickTarget(targets, current)`: si el destino elegido deja de estar disponible porque pasó a ser el origen, se elige otro disponible o queda vacío con el aviso "No hay otra conexión que se pueda modificar".
  - El backend sigue rechazando origen = destino (`ensure_distinct_connections`, ya existe) como última barrera.
- [ ] `CONFIRM_WORD = "confirmo"` y `confirmationMatches(typed)`, que ignora mayúsculas y espacios en los extremos. Sustituye a la confirmación por nombre de conexión.
- [ ] Tests en `syncPlan.test.ts`:
  - Una conexión cerrada aparece como destino.
  - Una de producción nunca aparece, esté abierta o cerrada.
  - La de origen no aparece como destino, y la de destino no aparece como origen.
  - Al cambiar el origen a la conexión que era destino, el destino pasa a otra disponible o queda vacío.
  - "Confirmo " y "CONFIRMO" valen; "confirmar" no.

### Paso 2: Sub-ventana de selección
- [ ] `SyncDialog.tsx` → `SyncSelectWindow.tsx`:
  - Contenido: origen → destino, `DatabasePicker`, `SyncPlanSummary` en versión corta y pie con `planLabel`.
  - El botón **Continuar** devuelve el `SyncRequest` con `finishModalWindow`; no ejecuta nada.
  - Se quitan de aquí la confirmación y la barra de progreso.
- [ ] Al elegir un destino cerrado, se conecta con el `connect` de la ventana principal, por un evento a la principal, para que el árbol lo muestre igual que una conexión abierta a mano. Mientras tanto se ve "Conectando…" y luego sus BDs, para marcar *reemplaza* o *nueva*. Si falla, el error queda junto al selector.
- [ ] Si la conexión de origen está cerrada, también se conecta al elegirla, y el catálogo carga después.

### Paso 3: Sub-ventana de confirmación y arranque
- [ ] `src/shared/ui/DangerConfirmWindow.tsx` (nuevo, genérico, también lo usa el restore en 22):
  - Banner "Se va a MODIFICAR" con `TagBadge` del destino, la lista del plan (`SyncPlanSummary`) y el campo "Escribe **confirmo** para continuar".
  - Botones **Volver**, **Cancelar** y **Sincronizar**. Este último es rojo y está deshabilitado hasta que la palabra coincide.
- [ ] `Workspace.tsx` → `openSync` orquesta los pasos:
  - Abre la selección y, con su request, la confirmación.
  - **Volver** reabre la selección con lo elegido (se le pasa el request como estado inicial).
  - **Sincronizar** llama a `operations.start("sync", request)` (20).
  - Si el destino ya está ocupado, el aviso sale en la confirmación y no se arranca.
- [ ] `SyncWindow.tsx`, `ModalWindow.tsx` y `App.css`: registrar las dos vistas, ajustar los tamaños y quitar los estilos que ya no se usen.

### Paso 4: Verificación
- [ ] `npx tsc --noEmit`, `npx vitest run`, `cargo test`, el test de sync real (**solo Mongo local**) y `npm run build` en verde.
- [ ] Prueba manual **solo local y QA**:
  - Sync QA → local, con una BD completa y colecciones sueltas de otra BD.
  - Continuar, escribir `confirmo` y Sincronizar.
  - El progreso sale en el panel y los conteos coinciden.
  - Volver conserva la selección.
  - Destino cerrado: se conecta solo.
  - La conexión de producción no aparece en el desplegable de destino.
  - La conexión elegida en un desplegable no aparece en el otro.
- [ ] Commit: `feat(sync): sync en dos pasos con confirmación y conexiones registradas` (propuesto, pendiente del usuario)

## Criterios de aceptación

- [ ] El destino ofrece todas las conexiones registradas excepto producción/protegidas; las cerradas se conectan al elegirlas.
- [ ] Origen y destino nunca coinciden: la conexión elegida en un select no aparece en el otro.
- [ ] Nada se modifica hasta escribir `confirmo` en la segunda sub-ventana y pulsar Sincronizar.
- [ ] Volver conserva la selección; Cancelar no deja nada en marcha.
- [ ] El trabajo corre en el panel de operaciones y la ventana principal queda libre.

## Bitácora

_(fecha: nota)_
