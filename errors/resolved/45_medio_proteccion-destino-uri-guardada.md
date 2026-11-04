# 45. La protección del destino usa la URI guardada, no la de la sesión abierta

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/mongo.rs (`hold_detached`), src-tauri/src/sync/commands.rs, src-tauri/src/backup/commands.rs, src-tauri/src/store.rs (`is_protected`), src/app/App.tsx ("Guardar" solo hace `upsert`)
- **Estado:** resuelto — editar una conexión abierta obliga a desconectarla antes (`edit` en App.tsx), y un cliente abierto aparte (`Detached`) recuerda a qué URI/servidor SSH se abrió: si la conexión se editó mientras otra operación lo usa, `hold_detached` no lo reutiliza y falla con "La conexión cambió mientras otra operación la usa…". Así la protección y la escritura siempre miran el mismo servidor.
- **Relacionado:** 15 (protección por connection id)

## Problema
`is_protected(target_sid)` calcula las direcciones con la URI guardada en disco, pero el cliente de `Sessions` (y el que reutiliza `hold_detached`) se abrió con la URI de cuando se conectó.

## Escenario de fallo
1. "Work" está abierta contra producción y protegida por compartir dirección con la conexión de producción.
2. Se edita para apuntar a QA y se pulsa "Guardar" sin reconectar.
3. Ya se ve como QA y se acepta como destino de sync/restore.
4. La escritura va a producción por la sesión vieja.

## Recomendación
Guardar en `OpenClient` las direcciones (o la URI) con las que se abrió y evaluar la protección con ellas, o reconectar/cerrar la sesión al guardar una conexión abierta cuyo endpoint cambió. Comparar `setName`/`clusterId` de `hello` cerraría además el residuo de la 15.
