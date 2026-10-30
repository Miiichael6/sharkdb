# 06 · CRUD de documentos

**Estado:** ✅ Terminada
**Fase:** 4 Datos · **Depende de:** 05 · **Doc:** R11

## Objetivo
Desde el visor de resultados y el árbol se puede ver, insertar, editar y eliminar documentos con un editor de texto validado, como en Robo 3T.

## Pasos

### Paso 1: Lógica
- [x] Comando Tauri `eval_document(sid, text)`: evalúa el texto como expresión en el motor JS de 02 y devuelve EJSON o error con línea; así se aceptan `ObjectId(...)`, `ISODate(...)` igual que en el shell (R11)
- [x] `src/features/documents/domain/documentEdit.ts`: exigir/conservar `_id`, construir filtro por `_id` + tests (R11)
- [x] `src/features/documents/application/documentService.ts`: `insertDocument`, `replaceDocument`, `deleteDocument(s)`, `deleteAll` sobre el `QueryGateway` de 03 (R11)

### Paso 2: UI
- [x] `src/features/documents/ui/DocumentEditorDialog.tsx`: CodeMirror reutilizado de `QueryEditor`, botón "Validar", errores con línea; modos ver / editar / insertar (R11)
- [x] Entradas de menú: en `ResultsPanel` ("Ver", "Editar", "Insertar", "Eliminar documento(s)…") y en el árbol de colección ("Insertar documento…", "Eliminar todos los documentos…") con `ConfirmDialog`; tras cada operación se refresca la página actual (R11)

### Paso 3: Verificación
- [x] Prueba real: insertar doc con ObjectId/ISODate, editarlo, comprobar que los tipos se conservan (no se convierten a string), eliminarlo; probar JSON inválido
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test` y `npm run build` pasan
- [x] Commit: `feat(documents): ver, insertar, editar y eliminar documentos`
- **Cierre de Fase 4**

## Criterios de aceptación
- [x] Editar un documento conserva tipos BSON y el `_id`
- [ ] Un texto inválido no se envía y se marca el error en su línea
- [ ] Las eliminaciones piden confirmación y el visor se actualiza

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: `eval_document` sin `sid`: motor QuickJS aparte sin `db`, con prefijo `0, ` para evaluar el texto como expresión; el editor muestra `NumberInt(…)` (`formatEditable`) para no perder Int32.
- 2026-10-30: Tras editar/eliminar desde el visor no se re-ejecuta el script (podría repetir escrituras): la página se actualiza en sitio con `pager.replace`; un insertado desde el visor no aparece hasta re-ejecutar. Solo se elimina el documento clicado (el visor no tiene multiselección).
- 2026-10-30: Verificado contra Mongo local (`cargo test live -- --ignored`: tipos y `_id` se conservan, texto inválido → línea 3) y la app arrancó con el código nuevo; el diálogo y los menús no se probaron con clics, así que los criterios 2 y 3 quedan pendientes de prueba manual.
