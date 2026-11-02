# 09. Cancelar no detiene escritura

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/native/mod.rs (`wait()`, tokio::select con watchdog)
- **Estado:** pendiente

## Problema
Cancelar o que salte el timeout corta la espera en la app, pero la operación sigue en el servidor (no se envía `maxTimeMS` ni `killOp`).

## Escenario de fallo
Sale 'Operación cancelada' y el `updateMany` termina igual. Un `insertMany` de varios lotes puede quedar a medias.

## Recomendación
Enviar `maxTimeMS` y/o hacer `killOp` al cancelar, y cambiar el mensaje a 'puede seguir ejecutándose en el servidor'.
