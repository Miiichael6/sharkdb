# 13 · Safe mode y centro de notificaciones

**Estado:** ✅ Terminada (prueba manual pendiente en la UI)
**Fase:** 8 Barra de herramientas · **Depende de:** 06, 11 · **Doc:** R27, R28 · D5, D7

## Objetivo
Un interruptor de **solo lectura** por sesión: activo, ninguna escritura llega a la BD, venga de un script o de una acción manual. Las conexiones marcadas **protegidas** (prod) abren con él activo. Además, un centro de notificaciones que guarda el historial de avisos.

## Pasos

### Paso 1: Política de solo lectura
- [x] `src/features/connections/domain/safeMode.ts`: `isWriteOperation(command)` que clasifica comandos y métodos (insert, update, delete, findAndModify, drop, rename, create, createIndex/dropIndex, createUser…, aggregate con `$out`/`$merge`) + tests (casos de lectura, escritura y agregaciones) (R27, D5)
- [x] `MongoConnection` gana `protected: boolean` (casilla "Conexión protegida: nunca modificar" en `ConnectionForm`); al conectar, la sesión arranca con safe mode = `protected`. Botón candado en la barra (11) que alterna el interruptor de la sesión activa, con aviso visual claro cuando está activo (R27, D7)
- [x] **Doble barrera**: en Rust, `run_command` y el motor JS (`src-tauri/src/shell/`) rechazan toda escritura si la sesión tiene safe mode (lo pide la propia sesión, no la UI), con error "Safe mode activo: solo lectura"; en la UI, `explorerService` y el CRUD de 06 deshabilitan las acciones de escritura del árbol y del visor (R27, D5)

### Paso 2: Notificaciones
- [x] `src/shared/ui/useNotifications.tsx`: evolución de `useNotice`/`NoticeToast` a una cola con historial (nivel, texto, hora, leída); los toasts actuales pasan por aquí (R28)
- [x] `NotificationCenter.tsx`: botón campana con contador de no leídas en la barra y panel con historial, "marcar todo como leído" y limpiar (R28)

### Paso 3: Verificación
- [ ] Prueba real (pendiente: sin MongoDB ni UI en este entorno, ver bitácora): con safe mode activo, `db.x.insertOne`, `db.x.drop()`, `aggregate` con `$out`, borrar/editar un documento y eliminar una colección desde el árbol: todo se rechaza y la BD no cambia; `find`, `count` y `aggregate` normales funcionan; una conexión protegida abre ya en safe mode
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [x] Commit: `feat(safety): safe mode de solo lectura, conexiones protegidas y notificaciones`
- **Cierre de Fase 8** (arranque con `npm run tauri dev` pendiente junto con la prueba manual)

## Criterios de aceptación
- [x] Con safe mode activo ninguna ruta (shell, árbol, CRUD, restore, sync) modifica la BD; el bloqueo vive en el backend
- [x] El estado del safe mode se ve siempre en la barra; las conexiones protegidas arrancan con él activo
- [x] Las notificaciones se conservan durante la sesión y se pueden revisar después

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: El `SafeMode` es un `Arc<AtomicBool>` compartido por la sesión y sus shells, así el candado afecta al instante a runtimes ya abiertos; `mongo::writable_session` es la entrada para copy (09), restore (14) y sync (15), que aún no existen.
- 2026-10-30: mongosh externo también se bloquea en safe mode (backend y UI) porque escribe sin pasar por la app; desactivar el candado en una conexión protegida pide confirmación.
- 2026-10-30: Sin MongoDB ni UI interactiva aquí: la prueba real y el arranque del Cierre de Fase 8 quedan pendientes; hay un test Rust `live_safe_mode_rejects_writes` (ignorado) que la cubre contra 127.0.0.1:27017.
