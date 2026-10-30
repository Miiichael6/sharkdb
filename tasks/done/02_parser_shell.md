# 02 · Motor JavaScript embebido y tipos BSON

**Estado:** ✅ Terminada
**Fase:** 2 Motor · **Depende de:** 01 · **Doc:** R5, R6

## Objetivo
El backend Rust puede evaluar JavaScript arbitrario (variables, bucles, funciones, `print`) en un motor embebido, con los constructores BSON del shell de Mongo (`ObjectId`, `ISODate`…) y conversión exacta JS ↔ BSON. Todavía sin acceso a la base de datos (eso es 03).

## Pasos

### Paso 1: Runtime
- [x] Añadir `rquickjs` (features `classes`, `properties`) a `src-tauri/Cargo.toml`; nuevo módulo `src-tauri/src/shell/` con `mod.rs` y `runtime.rs`: un runtime por sesión en su propio hilo (`std::thread`), que recibe scripts por canal y devuelve un `ScriptOutcome` (R5)
- [x] `runtime.rs`: límite de memoria, `set_interrupt_handler` con bandera atómica para cancelar y timeout configurable; `print`/`printjson` acumulan salida de texto en el `ScriptOutcome` (R5)

### Paso 2: Tipos BSON en JS
- [x] `src-tauri/src/shell/bson_types.rs`: clases JS `ObjectId`, `ISODate`/`Date`, `NumberLong`, `NumberInt`, `NumberDecimal`, `UUID`, `BinData`, `Timestamp`, `MinKey`/`MaxKey`, regex nativo; cada una con `toString()`/`tojson()` estilo shell (R6)
- [x] `src-tauri/src/shell/convert.rs`: `js_to_bson(Value) -> Bson` y `bson_to_js(Bson) -> Value` sin pérdida de tipos (Double vs Int32 vs Int64, fechas, binarios) (R6)

### Paso 3: Tests
- [x] `cargo test`: ida y vuelta JS ↔ BSON por cada tipo, documentos anidados y arrays, número JS → Double (como el shell), script con bucle y `print`, error de sintaxis con línea/columna, script infinito cortado por timeout

### Paso 4: Verificación
- [x] Prueba real: comando Tauri temporal `eval_script` invocado desde devtools con `var x = []; for (let i=0;i<3;i++) x.push(ObjectId()); printjson(x)`; quitarlo al cerrar la tarea (lo sustituye 03)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `cargo test` y `npm run build` pasan
- [x] Commit: `feat(shell): motor JS embebido (QuickJS) y tipos BSON`

## Criterios de aceptación
- [x] Se ejecuta JS arbitrario con variables, funciones y bucles; `print` devuelve salida
- [x] Todos los tipos BSON soportados sobreviven ida y vuelta JS ↔ BSON
- [x] Un bucle infinito se corta por timeout o cancelación sin colgar la app

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: D1 resuelto: motor JS embebido en vez de parser propio, para ejecutar scripts como Robo 3T. Motor elegido: QuickJS (`rquickjs`), ligero y sin dependencias externas; `boa` (Rust puro, más lento) y `deno_core` (V8, binario muy pesado) descartados.
- 2026-10-30: Tipos BSON definidos en JS (`bson_types.js`, marca `_bsontype`) con helpers nativos, sin las features `classes` de rquickjs; Symbol se convierte a string y DbPointer no se soporta (tipos obsoletos).
- 2026-10-30: Al agotar memoria QuickJS lanza `null` y las globales retienen el heap: se detecta por uso ≥90 % del límite y se reinicia el motor entero (perder solo el contexto crasheaba). Prueba real por CDP con `eval_script` OK, comando ya retirado.
