# 10 · Crear y editar funciones guardadas (opcional)

**Estado:** ⬜ Pendiente (opcional)
**Fase:** 7 Administración · **Depende de:** 04 · **Doc:** R20

## Objetivo
Desde la carpeta Functions del árbol se pueden crear funciones nuevas y editar el código de las existentes en `system.js`. Hoy ya se listan, se ven y se eliminan. Es opcional: solo se hace si alguna base de datos en uso tiene funciones guardadas que se quieran mantener desde la app.

## Pasos

### Paso 1: Lógica y servicio
- [ ] `src/features/explorer/domain/functionSpec.ts`: validar nombre (no vacío, sin duplicar) y construir el documento `{ _id, value: Code }` + tests (R20)
- [ ] `commandMongoAdmin.ts`: `saveFunction(sid, db, name, code)` con `update` + `upsert` sobre `system.js` (el código se guarda como tipo BSON Code, no como string); al renombrar se elimina la anterior (R20)

### Paso 2: UI
- [ ] `src/features/explorer/ui/FunctionDialog.tsx`: nombre + editor CodeMirror reutilizado de `QueryEditor` (04), validación de sintaxis con el motor JS de 02 antes de guardar (R20)
- [ ] Entradas "Añadir función…" en la carpeta Functions y "Editar función…" en cada función (`Explorer.tsx`, `useExplorerActions.ts`); refrescar la carpeta al guardar (R20)

### Paso 3: Verificación
- [ ] Prueba real: crear una función, editarla, renombrarla; comprobar en el servidor que `value` es de tipo Code (`db.system.js.find()` en el shell de la app)
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test` y `npm run build` pasan
- [ ] Commit: `feat(explorer): crear y editar funciones guardadas`

## Criterios de aceptación
- [ ] Se crea y edita una función desde el árbol y queda guardada como tipo Code
- [ ] Un código con error de sintaxis no se guarda y se indica la línea

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Marcada opcional por el usuario: `system.js` es legado (sin `db.eval` desde MongoDB 4.2); hacerla solo si hay funciones guardadas en uso.
