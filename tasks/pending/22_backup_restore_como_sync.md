# 22 · Backup y restore con el mismo flujo que el sync

**Estado:** ⬜ Pendiente
**Fase:** 9 Operaciones de BD
**Depende de:** 21
**Doc:** D9 en [00_README.md](../00_README.md) · R29, R41

## Objetivo

Backup y restore dejan de ser diálogos dentro de la ventana principal y pasan a ser **sub-ventanas con las mismas piezas que el sync**:
- Un selector multi-BD (`DatabasePicker`).
- Origen → destino.
- Continuar.
- Confirmación en sub-ventana con `confirmo` en las tres operaciones (también el backup, decisión del usuario 2026-10-30).
- El trabajo en el panel de operaciones.

Las tres operaciones solo se diferencian en los extremos:

| Operación | Origen | Destino | Confirmación |
|---|---|---|---|
| Sync | conexión | conexión | sí |
| Backup | conexión | carpeta | sí: "Se va a GUARDAR en {carpeta}" |
| Restore | carpeta | conexión | sí |

## Pasos

### Paso 1: Piezas compartidas
- [ ] Mover a `src/shared/` lo que ahora es del sync y van a usar las tres:
  - De `syncPlan.ts` a `shared/domain/selection.ts`: `Selection`, `DatabaseCatalog`, `toggleDatabase`, `toggleCollection`, `selectEverything` y `filterCollections`.
  - A `shared/ui/`: `DatabasePicker.tsx` y `DatabaseRow.tsx`.
  - Los tests se mueven con su código.
- [ ] Reproducir el fallo actual de backup y restore (se abren como diálogo superpuesto en la ventana principal; ver captura del usuario), anotar la causa en la Bitácora y borrar `BackupDialog.tsx` y `RestoreDialog.tsx` cuando los sustituyan las ventanas nuevas.

### Paso 2: Backend multi-BD con formato `mongodump`
- [ ] `backup/dump.rs` y `commands.rs`:
  - `backup_databases(job, {sid, dir, databases: [{db, collections}]})` escribe `<carpeta>/<bd>/<colección>.bson|.metadata.json`, el mismo formato que `mongodump --out`.
  - Progreso con la etiqueta `bd.colección`, como el sync.
- [ ] `backup/folder.rs`: `read_backup_catalog(dir)` devuelve el mismo `DatabaseCatalog[]` que el sync. Si la carpeta tiene `.bson` en la raíz, se lee como una sola BD (formato de la tarea 14) con el nombre de la carpeta; si no, cada subcarpeta es una BD.
- [ ] `backup/restore.rs`: `restore_databases(job, {dir, targetSid, databases})`.
  - Cada BD va a la de su mismo nombre en el destino. Se reutiliza el staging y el `renameCollection` del sync.
  - Se aplican las mismas comprobaciones que en el sync: protegida/producción, safe mode y origen ≠ destino no aplica.
- [ ] Tests Rust: lectura del catálogo en los dos formatos de carpeta, y rechazo de un destino de producción. El test real (**solo Mongo local**) hace backup de 2 BDs y luego restore, y comprueba que los conteos coinciden.

### Paso 3: Sub-ventanas
- [ ] `BackupWindow.tsx` (nuevo):
  - Origen: conexión registrada (se conecta si está cerrada) y `DatabasePicker`.
  - Destino: carpeta con `FolderField`.
  - **Continuar** abre `DangerConfirmWindow` (21) con el plan (BDs y colecciones elegidas) y la carpeta de destino; con `confirmo` y **Hacer backup** sale la operación.
  - El banner de `DangerConfirmWindow` es configurable: "Se va a GUARDAR en {carpeta}" para el backup y "Se va a MODIFICAR" para sync y restore.
- [ ] `RestoreWindow.tsx` (nuevo):
  - Origen: carpeta, que se lee al elegirla, y `DatabasePicker` con su catálogo.
  - Destino: conexión registrada; nunca producción o protegida.
  - **Continuar** abre `DangerConfirmWindow` (21) con el plan y `confirmo`, y de ahí sale la operación.
- [ ] `Workspace.tsx`, `useQuickOpen.ts` y `WorkspaceToolbar.tsx`:
  - Backup y Restore abren las ventanas nuevas.
  - Si se abren desde una BD o una colección del árbol, viene preseleccionada (`originSelection`), igual que el sync.
  - Las acciones rápidas ya no necesitan BD.

### Paso 4: Verificación
- [ ] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`, los tests reales (**solo local**) y `npm run build` en verde.
- [ ] Prueba manual **solo local y QA**:
  - Backup de 2 BDs de QA (una completa y colecciones sueltas de otra) a una carpeta, pasando por la confirmación con `confirmo`.
  - La carpeta se restaura con `mongorestore` en local y da los mismos conteos.
  - Restore de esa carpeta en local desde la app, con `confirmo`.
  - Restore de una carpeta antigua de una sola BD (tarea 14).
  - La conexión de producción no aparece como destino.
- [ ] Commit: `feat(backup): backup y restore multi-BD en sub-ventanas con el flujo del sync` (propuesto, pendiente del usuario)

## Criterios de aceptación

- [ ] Backup, restore y sync se ven y se usan igual: sub-ventana, origen → destino, selector multi-BD y progreso en el panel.
- [ ] Un backup de varias BDs se puede restaurar con `mongorestore`, y las carpetas de la tarea 14 se siguen restaurando.
- [ ] Backup y restore permiten elegir varias BDs y colecciones sueltas de cada una.
- [ ] Backup y restore exigen escribir `confirmo` en su sub-ventana de confirmación; el restore nunca ofrece ni acepta un destino de producción/protegido.

## Bitácora

_(fecha: nota)_
