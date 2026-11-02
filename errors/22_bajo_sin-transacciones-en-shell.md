# 22. Sin transacciones en shell

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/prelude/database.js, shell.js
- **Estado:** pendiente

## Problema
No hay sesiones ni transacciones (`startSession`, `withTransaction`).

## Escenario de fallo
Un script con varias escrituras que falla a la mitad deja los datos a medias.

## Recomendación
Documentarlo o implementar sesiones y transacciones.
