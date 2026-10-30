# 09 · Administración: usuarios y copia de colecciones

**Estado:** ⬜ Pendiente
**Fase:** 7 Administración · **Depende de:** 01 · **Doc:** R18, R19

## Objetivo
Desde el árbol se pueden crear y editar usuarios con sus roles, y copiar una colección a otra base de datos (del mismo servidor o de otra conexión abierta), como en Robo 3T.

## Pasos

### Paso 1: Usuarios
- [ ] `src/features/explorer/domain/userSpec.ts`: tipo de formulario (usuario, contraseña, roles `{role, db}`), validación y traducción a `createUser` / `updateUser` + tests; lista de roles integrados (`read`, `readWrite`, `dbAdmin`, `userAdmin`, `root`…) como constante (R18)
- [ ] `commandMongoAdmin.ts`: `createUser`, `updateUser`; `src/features/explorer/ui/UserDialog.tsx` (archivo propio, no dentro de `dialogs.tsx`); entradas "Añadir usuario…" en la carpeta Users y "Editar usuario…" en cada usuario (`Explorer.tsx`, `useExplorerActions.ts`) (R18)

### Paso 2: Copiar colección
- [ ] Mismo servidor: `aggregate([{ $match: {} }, { $out: { db, coll } }])` en `explorerService.copyCollection`; entre conexiones distintas: comando Rust `copy_collection(src_sid, dst_sid, …)` en `src-tauri/src/copy.rs` que lee por lotes e inserta con `insert_many`, emitiendo progreso como evento Tauri (R19)
- [ ] `src/features/explorer/ui/CopyCollectionDialog.tsx`: elegir conexión destino, BD y nombre (por defecto el mismo), opción "copiar también índices"; entrada "Copiar colección a base de datos…" en el menú de colección (R19)

### Paso 3: Verificación
- [ ] Prueba real: crear usuario con `readWrite` en una BD, conectarse con él, editar sus roles; copiar una colección de 50k docs a otra BD del mismo servidor y a otra conexión, comprobar conteo e índices
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(explorer): crear/editar usuarios y copiar colecciones`
- **Cierre de Fase 7**

## Criterios de aceptación
- [ ] Se crea y edita un usuario desde el árbol y los roles quedan aplicados en el servidor
- [ ] La copia de colección conserva documentos (mismo conteo) y, si se marca, los índices
- [ ] La copia entre conexiones muestra progreso y no congela la interfaz

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
