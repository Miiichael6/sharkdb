# 38 · Edición en línea de valores primitivos

**Estado:** ✅ Terminada (prueba con clics en la GUI pendiente del usuario)
**Fase:** 23 Edición en línea · **Depende de:** 06, 18 · **Doc:** R79–R84

## Objetivo
En la vista árbol, **triple clic** sobre la celda Value de un campo primitivo (string, número, booleano) la convierte en un campo editable. Con Enter, si el valor cambió, una sub-ventana confirma documento, campo, antes y después, y solo se escribe ese campo; si el valor quedó igual, se cierra sin preguntar.

## Pasos

### Paso 1: Dominio (lógica pura + tests)
- [x] `src/features/documents/domain/inlineEdit.ts` (nuevo): `isInlineEditable(row)` solo para string, int32, int64, double, decimal y boolean (D19); nunca `_id`, null, fechas, ObjectId, object ni array; sí elementos primitivos dentro de un array ya expandido (R79, R80)
- [x] Mismo archivo: `parseInlineValue(text, originalType)` → valor EJSON **del mismo tipo** o error legible ("Se esperaba un Int32", decimal en un entero, fuera de rango…); nunca cambia el tipo (D20). `isSameValue(before, after)` compara por tipo y valor, no por texto (`5` vs `5.0`) (R81, R82)
- [x] `fieldUpdate(doc, path, before, after)` → filtro `{ _id, <ruta>: before }` + `{ $set: { "<ruta.con.puntos>": after } }`; rutas con índices de array; tests de todo lo anterior (R83)

### Paso 2: Escritura
- [x] Puerto `DocumentStore.update(target, filter, update)` y su adaptador en `infrastructure/commandDocumentStore.ts` (comando Rust existente o uno fino nuevo); respeta safe mode y conexiones protegidas (R83)
- [x] `documentService.updateField(target, doc, path, before, after)`: si el filtro no casa (alguien cambió el campo o borró el doc) falla con `DOCUMENT_CHANGED` / `DOCUMENT_GONE`, como el `replaceDocument` de 06; test con store falso (R83)

### Paso 3: UI
- [x] `src/features/shell/ui/results/useInlineEdit.ts` (nuevo): estado de la celda en edición; abre con `e.detail === 3` sobre la celda Value (sin seleccionar el texto de la fila); Enter → si `isSameValue` cierra en silencio, si no confirma; Esc cancela y deja el valor original (R79, R81, R82)
- [x] Clic fuera mientras se edita (otro documento, explorador, otra pestaña, fuera de la ventana): sub-ventana "Estás editando el campo `<ruta>`" con **Seguir editando** (por defecto, devuelve el foco al campo) y **Descartar cambios**; el clic que la provocó no se aplica (D22, R84)
- [x] `InlineValueEditor.tsx` (nuevo): `<input>` para texto y números, con el texto tal cual se ve en el árbol (strings **sin comillas**: lo escrito es el valor literal, `123` sigue siendo String), selector `true`/`false` para booleanos; error de parseo marcado sin cerrar el editor (R80)
- [x] Confirmación como sub-ventana (flujo de 18): `_id` del documento, colección, campo (ruta completa), **Antes → Después** con su tipo (strings **con comillas** para que se vean `""` y espacios al final; números y booleanos sin comillas); al aceptar se actualiza la fila en sitio (`pager.replace`, como en 06) y se avisa en el log (R82)
- [x] `TreeView.tsx`: solo engancha el hook y el editor; el doble clic sigue expandiendo/plegando. Solo vista árbol, no tabla (D21) (R79)

### Paso 4: Verificación
- [x] Prueba real en Mongo local: editar un string anidado (`EECC.RUC`), un Int32, un Double, un booleano y un elemento de array; tipos conservados en la BD
- [ ] Triple clic + escribir + dejarlo igual + Enter → no pregunta; Esc → no escribe; número inválido o de otro tipo → error sin cerrar
- [x] Null, fecha y ObjectId no se abren en línea; el editor de documentos (06) sigue permitiendo cambiar tipos
- [ ] Clic en otro documento, en el explorador y fuera de la ventana mientras se edita → sub-ventana; "Seguir editando" devuelve el foco
- [x] Con safe mode o conexión protegida no se puede editar; campo cambiado por otro proceso → aviso, no se pisa
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck, `vite build` y `cargo check` pasan
- [x] Commit: `feat(documents): editar en línea valores primitivos desde la vista árbol`
- **Cierre de Fase 23**

## Criterios de aceptación
- [ ] Triple clic sobre un valor primitivo lo edita en la propia fila; objetos, arrays y `_id` no son editables
- [ ] Enter con el valor cambiado pide confirmación mostrando documento, campo, antes y después; con el valor igual no pregunta
- [x] Solo se escribe ese campo (`$set`) y el tipo BSON original se conserva
- [x] Si el campo cambió en el servidor desde que se leyó, no se sobrescribe y se avisa
- [ ] Salir de la celda sin Enter ni Esc nunca descarta en silencio: pregunta antes

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario: editar en línea con 3 clics solo primitivos, confirmar con antes/después y no preguntar si quedó igual.
- 2026-11-04: `fieldUpdate`/`withField` van en `fieldUpdate.ts`, aparte de `inlineEdit.ts`; la confirmación reutiliza `ConfirmWindow` (18) con `details`, `table` (antes/después en tabla, pedido por el usuario), `safe` y `focusDismiss` nuevos.
- 2026-11-04: Tras guardar, `useTreeRows` conserva lo expandido si la página vuelve con los mismos `_id` (`isSamePage`); si no, el árbol se plegaba entero (también al guardar desde el editor de 06).
- 2026-11-04: Escritura verificada contra Mongo local con `cargo test live_inline_edit -- --ignored` (mismo `update` que arma el TS, tipos, campo cambiado y safe mode). Falta la prueba con clics en la GUI: no se pudo abrir otra instancia (puerto 1420 ocupado por un `tauri dev` ya abierto).
- 2026-11-04: Revisión: los strings con saltos de línea no se editan en línea (un `<input>` los borraría al teclear) y tampoco las claves vacías; Tab no saca el foco del editor.
- 2026-11-04: Cerrada y unida a main a pedido del usuario; las líneas de prueba con clics (y sus criterios 1, 2 y 5) quedan sin marcar hasta probarlas en la app.
