# 15. Proteccion por connection id

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/sync/commands.rs:313, src-tauri/src/backup/commands.rs:83, src-tauri/src/store.rs
- **Estado:** pendiente

## Problema
Que el destino esté protegido depende de cómo esté registrada la conexión, no del servidor al que apunta.

## Escenario de fallo
Una segunda conexión no marcada que apunte al servidor de producción se acepta como destino del sync o del restore. El UUID solo evita escribir sobre la misma colección que el origen.

## Recomendación
Marcar como protegidas también las demás conexiones al mismo host o URI, o comparar el id del clúster o replica set.
