# 61. Una sesión abierta no pasa a safe mode cuando se protege otra conexión al mismo servidor

- **Severidad:** MEDIO
- **Tipo:** explícito, pero la salvaguarda se elude sin que el usuario lo sepa
- **Dónde:** src/features/connections/application/connectionService.ts (`open`/`borrow`: `protectedAmong` se evalúa solo al conectar), src/app/App.tsx (`openForm` → `upsert` sin recalcular las sesiones abiertas), src/features/connections/ui/useReadOnly.tsx (`isReadOnly` solo mira `session.safeMode`), src-tauri/src/safe_mode/mod.rs (`ensure_writable` solo mira el flag de la sesión)
- **Estado:** pendiente
- **Relacionado:** #15, #45 (resueltos: protección por servidor en sync/restore)

## Problema
La regla del gemelo protegido (`protectedAmong = conn.protected || protectedTwin(conn, all)`) solo se aplica al abrir la sesión. Además, `protectedTwin` solo mira `.protected`: un gemelo con la etiqueta "production" (sin `protected`) nunca activa safe mode, ni siquiera al conectar. Editar una conexión obliga a desconectar *esa* conexión, pero no las demás abiertas al mismo servidor. Sync y restore sí la ven al instante (`store.rs` `is_protected` relee el archivo), mientras que explorador, shell y editor de documentos usan el flag de la sesión, que sigue en `false`. La propia barra (`WorkspaceToolbar`) ya trata la sesión como protegida, pero como no está en safe mode no hay nada que confirmar.

## Escenario de fallo
"Cluster X" está abierta en modo escritura. El usuario crea "Cluster X PROD" con el mismo host y `protected: true` (o marca como protegida otra conexión cerrada al mismo host) y vuelve al workspace. "Cluster X" sigue escribiendo: eliminar BD/colección, borrar documentos o `db.x.deleteMany({...})` en el shell se ejecutan contra el servidor recién declarado protegido.

## Recomendación
Tras `upsert`/`persist`, recalcular `protectedAmong` para cada sesión abierta y activar `setSafeMode(sid, true)` en las que pasen a protegidas (avisando). Alternativa: que el backend consulte `is_protected` en `ensure_writable`, como ya hacen sync y restore.
