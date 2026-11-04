# 44. Resultados abiertos escriben en otro servidor tras reconectar

- **Severidad:** MEDIO
- **Dónde:** src/app/App.tsx (`openSession`, `onConnect` del formulario), src-tauri/src/mongo.rs (`connect`), CursorResult.tsx (`targetOfNamespace`)
- **Estado:** resuelto — una conexión abierta no se puede editar sin desconectarla; al pulsar «Editar» se avisa en una subventana de que se cerrarán sus pestañas (nombrando las que tienen cambios sin guardar). Desconectar o eliminar una conexión con pestañas sin guardar también pide confirmación.

## Problema
El destino de Editar/Eliminar/Insertar es `{sid, db, coll}` y `sid` es el id de la conexión guardada, no de un cliente concreto. `connect` reemplaza el cliente con el mismo id y solo cierra los shells; `openSession` no cierra las pestañas de resultados (solo `disconnect` lo hace).

## Escenario de fallo
Resultado de `shop.orders` en STAGING (copia de PROD). Se edita la conexión para apuntar a PROD y se pulsa Conectar. "Eliminar documento" sobre el resultado viejo borra por `_id` en PROD; "Editar" reemplaza en PROD si el documento es idéntico (lo normal en una copia). Solo lo mitiga que la confirmación muestra el servidor nuevo.

## Recomendación
En `openSession`, si ya había una sesión con ese id, cerrar o invalidar sus resultados (`tabs.closeSession`). Alternativa: un número de generación de sesión que acompañe al destino y se compruebe en cada escritura.

## Solución
En lugar de invalidar resultados al reconectar, no se deja llegar a ese estado: `edit` (App.tsx) pide confirmación con `editOpenConnectionRequest` (shell/domain/sessionTabs.ts) y desconecta antes de abrir el formulario, y `disconnect` ya cierra las pestañas de la conexión. Así ninguna pestaña puede mostrar datos de un servidor y escribir en otro. Como `closeSession` cierra las pestañas sin preguntar, desconectar (explorador) y eliminar (lista de conexiones) piden confirmación con `unsavedSessionTabsRequest` cuando alguna tiene cambios sin guardar.

Cada ventana de SharkDB es un proceso aparte: editar la conexión en una no afecta a las sesiones abiertas en otra.
