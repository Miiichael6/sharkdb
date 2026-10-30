# 13 · Safe mode y centro de notificaciones

**Estado:** ⬜ Pendiente
**Fase:** 8 Barra de herramientas · **Depende de:** 06, 11 · **Doc:** R27, R28 · D5, D7

## Objetivo
Un interruptor de **solo lectura** por sesión: activo, ninguna escritura llega a la BD, venga de un script o de una acción manual. Las conexiones marcadas **protegidas** (prod) abren con él activo. Además, un centro de notificaciones que guarda el historial de avisos.

## Pasos

### Paso 1: Política de solo lectura
- [ ] `src/features/connections/domain/safeMode.ts`: `isWriteOperation(command)` que clasifica comandos y métodos (insert, update, delete, findAndModify, drop, rename, create, createIndex/dropIndex, createUser…, aggregate con `$out`/`$merge`) + tests (casos de lectura, escritura y agregaciones) (R27, D5)
- [ ] `MongoConnection` gana `protected: boolean` (casilla "Conexión protegida: nunca modificar" en `ConnectionForm`); al conectar, la sesión arranca con safe mode = `protected`. Botón candado en la barra (11) que alterna el interruptor de la sesión activa, con aviso visual claro cuando está activo (R27, D7)
- [ ] **Doble barrera**: en Rust, `run_command` y el motor JS (`src-tauri/src/shell/`) rechazan toda escritura si la sesión tiene safe mode (lo pide la propia sesión, no la UI), con error "Safe mode activo: solo lectura"; en la UI, `explorerService` y el CRUD de 06 deshabilitan las acciones de escritura del árbol y del visor (R27, D5)

### Paso 2: Notificaciones
- [ ] `src/shared/ui/useNotifications.tsx`: evolución de `useNotice`/`NoticeToast` a una cola con historial (nivel, texto, hora, leída); los toasts actuales pasan por aquí (R28)
- [ ] `NotificationCenter.tsx`: botón campana con contador de no leídas en la barra y panel con historial, "marcar todo como leído" y limpiar (R28)

### Paso 3: Verificación
- [ ] Prueba real: con safe mode activo, `db.x.insertOne`, `db.x.drop()`, `aggregate` con `$out`, borrar/editar un documento y eliminar una colección desde el árbol: todo se rechaza y la BD no cambia; `find`, `count` y `aggregate` normales funcionan; una conexión protegida abre ya en safe mode
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(safety): safe mode de solo lectura, conexiones protegidas y notificaciones`
- **Cierre de Fase 8**

## Criterios de aceptación
- [ ] Con safe mode activo ninguna ruta (shell, árbol, CRUD, restore, sync) modifica la BD; el bloqueo vive en el backend
- [ ] El estado del safe mode se ve siempre en la barra; las conexiones protegidas arrancan con él activo
- [ ] Las notificaciones se conservan durante la sesión y se pueden revisar después

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
