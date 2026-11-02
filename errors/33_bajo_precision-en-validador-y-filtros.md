# 33. Precision en validador y filtros

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/mongo.rs (`reply_to_json`, Extended JSON relajado), src/features/explorer/domain/validation.ts, src/features/explorer/domain/indexSpec.ts
- **Estado:** pendiente

## Problema
El validador y los `partialFilterExpression` se leen en Extended JSON relajado: Int64 grandes y Doubles pierden tipo o precisión al pasar por números JS, y se guardan así.

## Escenario de fallo
Un validador con `{ minimum: NumberLong("9007199254740993") }` o un filtro parcial con `{ v: { $gt: 5.0 } }` vuelve al servidor alterado tras abrirlo y guardarlo.

## Recomendación
Leer y escribir estas piezas en Extended JSON canónico.
