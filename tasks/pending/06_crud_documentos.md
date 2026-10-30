# 06 · CRUD de documentos

**Estado:** ⬜ Pendiente
**Fase:** 4 Datos · **Depende de:** 05 · **Doc:** R11

## Objetivo
Desde el visor de resultados y el árbol se puede ver, insertar, editar y eliminar documentos con un editor de texto validado, como en Robo 3T.

## Pasos

### Paso 1: Lógica
- [ ] Comando Tauri `eval_document(sid, text)`: evalúa el texto como expresión en el motor JS de 02 y devuelve EJSON o error con línea; así se aceptan `ObjectId(...)`, `ISODate(...)` igual que en el shell (R11)
- [ ] `src/features/documents/domain/documentEdit.ts`: exigir/conservar `_id`, construir filtro por `_id` + tests (R11)
- [ ] `src/features/documents/application/documentService.ts`: `insertDocument`, `replaceDocument`, `deleteDocument(s)`, `deleteAll` sobre el `QueryGateway` de 03 (R11)

### Paso 2: UI
- [ ] `src/features/documents/ui/DocumentEditorDialog.tsx`: CodeMirror reutilizado de `QueryEditor`, botón "Validar", errores con línea; modos ver / editar / insertar (R11)
- [ ] Entradas de menú: en `ResultsPanel` ("Ver", "Editar", "Insertar", "Eliminar documento(s)…") y en el árbol de colección ("Insertar documento…", "Eliminar todos los documentos…") con `ConfirmDialog`; tras cada operación se refresca la página actual (R11)

### Paso 3: Verificación
- [ ] Prueba real: insertar doc con ObjectId/ISODate, editarlo, comprobar que los tipos se conservan (no se convierten a string), eliminarlo; probar JSON inválido
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test` y `npm run build` pasan
- [ ] Commit: `feat(documents): ver, insertar, editar y eliminar documentos`
- **Cierre de Fase 4**

## Criterios de aceptación
- [ ] Editar un documento conserva tipos BSON y el `_id`
- [ ] Un texto inválido no se envía y se marca el error en su línea
- [ ] Las eliminaciones piden confirmación y el visor se actualiza

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
