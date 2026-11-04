# 20. Numberint desborda

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/bson_types/bson_types.js (`NumberInt` usa `n|0`)
- **Estado:** resuelto — `NumberInt` lanza `RangeError` si el valor no cabe en Int32 (también `Infinity`); los decimales se siguen truncando como en mongosh. Tests: `shell/tests/convert.rs` (`invalid_constructor_arguments_throw`, límites en `js_numbers_become_int32_or_double_like_mongosh`).

## Problema
Los valores fuera de rango desbordan sin avisar.

## Escenario de fallo
`NumberInt(3000000000)` se guarda como un número negativo.

## Recomendación
Dar error si el valor está fuera del rango de Int32.
