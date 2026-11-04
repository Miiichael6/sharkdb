# 18. Reindex en produccion

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/ui/useExplorerActions.ts (rebuildIndexes → `reIndex`)
- **Estado:** resuelto — descartado: ya pide confirmación, el safe mode lo bloquea y desde MongoDB 6.0 `reIndex` solo se permite en servidores standalone (los replica sets de producción lo rechazan)

## Problema
`reIndex` bloquea la colección y no se permite en replica sets.

## Escenario de fallo
Puede bloquear una colección de producción.

## Recomendación
Ocultarlo en producción o pedir confirmación escribiendo.
