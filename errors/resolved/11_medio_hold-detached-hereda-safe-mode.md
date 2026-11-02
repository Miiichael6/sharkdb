# 11. Hold detached hereda safe mode

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/mongo.rs (`hold_detached`)
- **Estado:** pendiente

## Problema
Se reutiliza el cliente apartado ya existente sin tener en cuenta el safe mode de la nueva sesión.

## Escenario de fallo
Una pestaña lo abre en modo escritura y una segunda que pide safe mode hereda la escritura (o al revés).

## Recomendación
Usar el safe mode de cada sesión, o separar los clientes por modo.
