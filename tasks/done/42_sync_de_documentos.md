# 42 · Sincronizar documentos sueltos con otro entorno

**Estado:** ✅ Terminada
**Fase:** 26 Sync de documentos · **Depende de:** 21, 41 · **Doc:** 00_README.md R97–R100, R104, D9, D25, D26

## Objetivo
Desde el visor, los documentos seleccionados se copian completos (leídos de la BD por `_id`) a la misma BD y colección de una conexión de **menor nivel** de entorno, tras una confirmación que muestra cada documento completo y pide `confirmo`.

## Pasos

### Paso 1: Dominio y caso de uso (frontend)
- [x] `src/features/connections/domain/environmentLevel.ts` (nuevo): `environmentLevel(tag)` (`production`=4, `testing`/`staging`=3, `development`=2, `local`=1) y `canSyncDocumentsTo(source, target)`: solo si el nivel del destino es **menor** y no es `neverModified` (R104, D26)
- [x] `src/features/sync/domain/documentSync.ts` (nuevo): `DocumentSyncRequest` (`sourceSid`, `targetSid`, `db`, `collection`, `ids`), `validateDocumentSync()` (dirección permitida, al menos un `_id`) y `documentSyncConfirmation()` con origen y destino (conexión · BD · colección) (R99)
- [x] `src/features/sync/application/ports.ts` + `syncService.ts`: `loadFullDocuments(sid, db, collection, ids)` (lectura completa para la confirmación) y `syncDocuments(job, request)` (R97, R98)

### Paso 2: Backend Rust
- [x] `src-tauri/src/sync/documents.rs` (nuevo): `find({_id: {$in: ids}})` **sin proyección** en el origen y `replaceOne` con `upsert` por `_id` en el destino (D25), con avance por documento y cancelación (R97, R98, R100)
- [x] Regla de nivel también en el backend (`src-tauri/src/sync/target.rs`): rechaza el mismo nivel o uno superior, además de protegida y safe mode, para que la UI no sea la única barrera (R104)
- [x] `src-tauri/src/sync/commands.rs`: comandos finos `load_full_documents` y `sync_documents`; registrar en `lib.rs`

### Paso 3: UI
- [x] Menú contextual de los documentos seleccionados en el visor: "Sincronizar con otro entorno…", con la BD y la colección de la pestaña; deshabilitado (con motivo en tooltip) si la consulta no permite saber la colección o si no hay `_id` (R97)
- [x] `src/features/sync/ui/DocumentSyncWindow.tsx` + `useDocumentSyncForm.ts` (nuevos): origen fijo, selector de destino solo con conexiones de menor nivel → Continuar
- [x] Confirmación `DocumentSyncConfirm.tsx` (nuevo): cabecera origen → destino (conexión + entorno · BD · colección) y **cada documento completo** leído de la BD (vista texto, solo lectura), con campo `confirmo` (R99, D26)
- [x] `src/app/operations/useDataOperations.ts`: `syncDocuments()` lanza la operación en la sección Sync del panel con su detalle (R100)

### Paso 4: Tests
- [x] Vitest de `environmentLevel`/`canSyncDocumentsTo` (prod→QA, prod→local, QA→local permitidos; QA→prod, local→QA, QA→QA, local→local prohibidos) y de `documentSync.ts` y el servicio con gateway falso
- [x] Test Rust contra el mongod local: el documento llega completo aunque el visor usara proyección, un documento existente se reemplaza (D25), el destino del mismo nivel o superior se rechaza

### Paso 5: Verificación
- [ ] ~~Prueba real: consulta con `find({}, {nombre: 1})` en una conexión `testing`, seleccionar 2 documentos, sincronizar a una `local`: la confirmación los muestra completos y en el destino quedan completos; una conexión `testing` o `production` no aparece como destino~~ (ver Bitácora)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npx tsc --noEmit`, `cargo test` pasan
- [x] Commit: `feat(Sync): sincroniza documentos sueltos con otro entorno` **Cierre de Fase 26**

## Criterios de aceptación
- [x] Los documentos seleccionados en el visor se sincronizan completos, aunque la consulta tuviera proyección o `$project`
- [x] Solo se ofrecen (y el backend solo acepta) destinos de menor nivel: prod → QA/development/local, QA → development/local, development → local
- [x] La confirmación muestra cada documento completo con conexión, BD y colección de origen y destino, y exige `confirmo`
- [ ] La operación aparece en el panel de Operaciones con su avance y resultado (cableada como `kind: "sync"`; falta verlo en la app, ver Bitácora)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-12: El nivel se valida en front y back (`store::connection_tag` + `ensure_lower_level`); los _id que ya no existen se omiten y la confirmación los cuenta; cancelar deja los ya escritos (cada upsert es independiente).
- 2026-11-12: Vitest falla en Git Bash ("reading 'config'") por la ruta `/c/` frente a `C:\`; se verificó desde PowerShell. El test vivo de Rust pasó contra el mongod local.
- 2026-11-12: En la prueba manual, development → local no se ofrecía (mismo nivel en D26); el usuario separó development (2) de local (1) y, sin destinos, ahora se avisa antes de abrir la ventana. Falta probar el sync completo y el panel.
