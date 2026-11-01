# 34 · Vista Consola: resultados como en la consola del navegador, y errores marcados en el editor

**Estado:** ✅ Terminada
**Fase:** 19 Consola · **Depende de:** 33 · **Doc:** R65, R66, R67, R68

## Objetivo
Cuarta vista de resultados, **Consola** (junto a Árbol / Tabla / Texto): todos los resultados del script en una sola lista, en orden y con su `L#`, cada uno pintado según su **tipo real**, como la consola de DevTools (`▶ Array(n) […]`, `▶ {…}`, `"texto"`, `120`, `null`). Además, el error de un script se marca en su línea del editor, en todas las vistas.

## Cómo llega cada resultado hoy (investigado, base de esta tarea)
El backend (`prelude.js` → `describe`, `prelude/mod.rs`, `convert/to_bson.rs`) ya distingue el tipo; **la consola nunca adivina por la cantidad de documentos**:

| Sentencia | Llega como | En la consola |
|---|---|---|
| `find()`, `aggregate()` (también vacío, o con un solo doc), cursor guardado en variable | `kind: "cursor"`, primer lote + `exhausted` | `Array(n)`; si sigue abierto, `Array(n+)` + «más…» |
| `.toArray()`, `.map()`, `distinct()`, `getCollectionNames()` | `kind: "value"`, EJSON **array** | `Array(n)`, aunque `n` sea 1 |
| `findOne()`, `cursor.next()`, `findOneAndUpdate/Delete/Replace()`, `runCommand()`, `stats()`, objeto literal | `kind: "value"`, EJSON **documento** | objeto `{…}` |
| `findOne()` sin coincidencia | `kind: "value"`, `null` | `null` |
| `insertOne/Many`, `updateOne/Many`, `replaceOne`, `deleteOne/Many`, `remove`, `insert` | `kind: "write"` (clase `WriteResult`) | objeto con etiqueta `WriteResult {acknowledged: true, …}` |
| `countDocuments()`, `count()`, `itcount()`, números JS | `kind: "value"`, **siempre Double** (`to_bson` pasa todo número JS a Double) | `120`, no `120.0` |
| `db`, `db.coleccion` sueltos | `kind: "value"`, string con el nombre | el nombre, sin comillas |
| `print` / `printjson` | `kind: "print"` | texto tal cual |
| `undefined`, `forEach`, asignaciones con `var` | no deja resultado | nada |

Trampas detectadas:
- Los wrappers EJSON (`{$oid}`, `{$date}`, `{$numberLong}`…) **no son objetos**: se muestran `ObjectId('…')`, `ISODate('…')`, `NumberLong(…)` con `bsonValue`/`bsonFormat`, igual que en el resto de la app.
- Un literal string en la **primera** línea (`"hola"`) es una *directiva* para el parser (como `"use strict"`), no una expresión, así que hoy no da resultado.
- Al ejecutar **una selección**, las líneas llegan relativas a la selección, no al editor. Ya afecta a los `L#` de la tarea 33 y rompería el clic-a-línea y la marca de error.
- Los errores `timeout` / `cancelled` / `outOfMemory` no traen línea, así que no se marcan en el editor.

## Pasos

### Paso 1: Dominio puro
- [x] → ver 34.2

### Paso 2: UI de la consola
- [x] → ver 34.2

### Paso 3: Líneas reales y error en el editor
- [x] → ver 34.1

### Paso 4: Tests
- [x] → ver 34.1 (líneas, directiva Rust) y 34.2 (consoleEntry, consolePreview)

### Paso 5: Verificación
- [x] Prueba real **solo en MongoDB local** (BD desechable, se borra al final), con un script que tenga:
  - `find` de 1 y de muchos documentos;
  - `aggregate` y `toArray`;
  - `findOne` con y sin coincidencia;
  - `insertOne`, `deleteMany` y `countDocuments`;
  - `print` y un error en medio.

  Cada sentencia debe mostrarse con su tipo y su `L#` correcto, también ejecutando solo una selección. La marca de error debe aparecer en el editor y borrarse al editar.
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`
- [x] Commit: `feat(shell): vista consola y error marcado en el editor`
- **Cierre de Fase 19**

## Subtareas
- [x] [34.1 · Líneas reales y error marcado en el editor](../done/34.1_lineas_reales_y_error_editor.md): ✅ Terminada
- [x] [34.2 · Vista Consola: dominio y UI](../done/34.2_vista_consola_ui.md): ✅ Terminada

## Criterios de aceptación
- [x] En Consola, cada resultado se muestra según su tipo real: un cursor o un array son `Array` aunque traigan 1 documento, y solo un documento confirmado es objeto
- [x] Cada entrada lleva el `L#` de su línea en el editor, también al ejecutar una selección, y al hacer clic se salta a esa línea
- [x] Un error se ve en rojo en la consola y queda marcado en su línea del editor en cualquier vista
- [x] Los cursores largos no congelan la consola: se cargan por páginas con «más…»

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: El usuario pidió clasificar por tipo real y no asumir objeto por traer 1 documento; la tabla de «Cómo llega cada resultado» sale de revisar `prelude.js`, `prelude/mod.rs` y `to_bson.rs`.
- 2026-11-01: Subdividida en 34.1 (líneas y error) y 34.2 (consola) porque no cabía en una sesión; el detalle de los pasos 1–4 vive en las hijas.
