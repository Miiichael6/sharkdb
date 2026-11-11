# 42 · Sincronizar documentos sueltos con otro entorno

**Estado:** ⬜ Pendiente
**Fase:** 26 Sync de documentos · **Depende de:** 21, 41 · **Doc:** 00_README.md R97–R100, R104, D9, D25, D26

## Objetivo
Desde el visor, los documentos seleccionados se copian completos (leídos de la BD por `_id`) a la misma BD y colección de una conexión de **menor nivel** de entorno, tras una confirmación que muestra cada documento completo y pide `confirmo`.

## Pasos

### Paso 1: Dominio y caso de uso (frontend)
- [ ] `src/features/connections/domain/environmentLevel.ts` (nuevo): `environmentLevel(tag)` (`production`=3, `testing`/`staging`=2, `local`/`development`=1) y `canSyncDocumentsTo(source, target)`: solo si el nivel del destino es **menor** y no es `neverModified` (R104, D26)
- [ ] `src/features/sync/domain/documentSync.ts` (nuevo): `DocumentSyncRequest` (`sourceSid`, `targetSid`, `db`, `collection`, `ids`), `validateDocumentSync()` (dirección permitida, al menos un `_id`) y `documentSyncConfirmation()` con origen y destino (conexión · BD · colección) (R99)
- [ ] `src/features/sync/application/ports.ts` + `syncService.ts`: `loadFullDocuments(sid, db, collection, ids)` (lectura completa para la confirmación) y `syncDocuments(job, request)` (R97, R98)

### Paso 2: Backend Rust
- [ ] `src-tauri/src/sync/documents.rs` (nuevo): `find({_id: {$in: ids}})` **sin proyección** en el origen y `replaceOne` con `upsert` por `_id` en el destino (D25), con avance por documento y cancelación (R97, R98, R100)
- [ ] Regla de nivel también en el backend (`src-tauri/src/sync/target.rs`): rechaza el mismo nivel o uno superior, además de protegida y safe mode, para que la UI no sea la única barrera (R104)
- [ ] `src-tauri/src/sync/commands.rs`: comandos finos `load_full_documents` y `sync_documents`; registrar en `lib.rs`

### Paso 3: UI
- [ ] Menú contextual de los documentos seleccionados en el visor: "Sincronizar con otro entorno…", con la BD y la colección de la pestaña; deshabilitado (con motivo en tooltip) si la consulta no permite saber la colección o si no hay `_id` (R97)
- [ ] `src/features/sync/ui/DocumentSyncWindow.tsx` + `useDocumentSyncForm.ts` (nuevos): origen fijo, selector de destino solo con conexiones de menor nivel → Continuar
- [ ] Confirmación `DocumentSyncConfirm.tsx` (nuevo): cabecera origen → destino (conexión + entorno · BD · colección) y **cada documento completo** leído de la BD (vista texto, solo lectura), con campo `confirmo` (R99, D26)
- [ ] `src/app/operations/useDataOperations.ts`: `syncDocuments()` lanza la operación en la sección Sync del panel con su detalle (R100)

### Paso 4: Tests
- [ ] Vitest de `environmentLevel`/`canSyncDocumentsTo` (prod→QA, prod→local, QA→local permitidos; QA→prod, local→QA, QA→QA, local→local prohibidos) y de `documentSync.ts` y el servicio con gateway falso
- [ ] Test Rust contra el mongod local: el documento llega completo aunque el visor usara proyección, un documento existente se reemplaza (D25), el destino del mismo nivel o superior se rechaza

### Paso 5: Verificación
- [ ] Prueba real: consulta con `find({}, {nombre: 1})` en una conexión `testing`, seleccionar 2 documentos, sincronizar a una `local`: la confirmación los muestra completos y en el destino quedan completos; una conexión `testing` o `production` no aparece como destino
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npx tsc --noEmit`, `cargo test` pasan
- [ ] Commit: `feat(Sync): sincroniza documentos sueltos con otro entorno` **Cierre de Fase 26**

## Criterios de aceptación
- [ ] Los documentos seleccionados en el visor se sincronizan completos, aunque la consulta tuviera proyección o `$project`
- [ ] Solo se ofrecen (y el backend solo acepta) destinos de menor nivel: prod → QA/local, QA → local
- [ ] La confirmación muestra cada documento completo con conexión, BD y colección de origen y destino, y exige `confirmo`
- [ ] La operación aparece en el panel de Operaciones con su avance y resultado

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
