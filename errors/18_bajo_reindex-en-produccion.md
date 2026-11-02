# 18. Reindex en produccion

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/ui/useExplorerActions.ts (rebuildIndexes → `reIndex`)
- **Estado:** pendiente

## Problema
`reIndex` bloquea la colección y no se permite en replica sets.

## Escenario de fallo
Puede bloquear una colección de producción.

## Recomendación
Ocultarlo en producción o pedir confirmación escribiendo.
