# 16. Sync restore no atomico

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/sync/copy.rs, src-tauri/src/backup/restore.rs, src-tauri/src/backup/staging.rs:58
- **Estado:** pendiente

## Problema
Cada colección se reemplaza por separado, así que el trabajo completo no es 'todo o nada'.

## Escenario de fallo
Si falla la colección 3 de 5, la 1 y la 2 ya están reemplazadas y el destino queda mezclado.

## Recomendación
Avisarlo en la interfaz, o llenar todas las provisionales y renombrarlas al final.
