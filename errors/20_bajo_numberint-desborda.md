# 20. Numberint desborda

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/bson_types/bson_types.js (`NumberInt` usa `n|0`)
- **Estado:** pendiente

## Problema
Los valores fuera de rango desbordan sin avisar.

## Escenario de fallo
`NumberInt(3000000000)` se guarda como un número negativo.

## Recomendación
Dar error si el valor está fuera del rango de Int32.
