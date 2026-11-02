# 19. Delete statement limit sobrescribible

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/prelude/bulk.js (`deleteStatement`)
- **Estado:** pendiente

## Problema
`compact({q, limit, ...rest})`: las opciones extra (`rest`) pueden sobrescribir `limit`.

## Escenario de fallo
Un `deleteOne` al que se le pasa `limit: 0` en las opciones borra varios documentos.

## Recomendación
Aplicar `limit` después de `rest`.
