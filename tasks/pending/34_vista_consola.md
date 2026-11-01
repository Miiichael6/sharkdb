# 34 · Vista Consola: resultados como en la consola del navegador, y errores marcados en el editor

**Estado:** ⬜ Pendiente
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

### Paso 1: Dominio puro (`src/features/shell/domain/`)
- [ ] `consoleEntry.ts` (nuevo): `consoleEntries(outcome)` → lista en orden con `{ line, kind: "print" | "cursor" | "array" | "object" | "write" | "scalar" | "error", … }`, clasificada **por `kind` del backend y tipo `bsonValue`**, nunca por cantidad (tabla de arriba). El error va al final, con su línea si la trae.
- [ ] `consolePreview.ts` (nuevo): vista previa de una línea estilo DevTools, recortada a `MAX_PREVIEW_CHARS`: `{_id: ObjectId('…'), estado: "OK", …}`, `[{…}, {…}, …]`, `Array(3)`. Los wrappers EJSON salen con su literal de shell; los números de primer nivel como en JS (`120`), y dentro de documentos según su tipo BSON, como en Árbol.
- [ ] `ViewMode` en `resultView.ts`: añadir `"console"` a `VIEW_MODES` con la etiqueta «Consola».

### Paso 2: UI de la consola (`src/features/shell/ui/results/`)
- [ ] `ConsoleView.tsx` (nuevo): una sola lista que se desplaza, sin pestañas ni apilado. Cada entrada muestra su `L#`; al hacer clic en `L#` el editor salta a esa línea. `ResultsPanel` usa esta vista cuando `mode === "console"`, en lugar de `LaidOutResults`.
- [ ] `ConsoleValue.tsx` (nuevo): ▶ plegable por niveles. Los hijos se calculan solo al desplegar y los arrays largos se agrupan en tramos `[0 … 99]`, como DevTools. `WriteResult` va etiquetado y los errores en rojo con su línea.
- [ ] Cursores: usan el `CursorPager` existente (`run.pagers`). «más…» trae la siguiente página y la añade al mismo `Array`; el cursor se cierra igual que hoy al reejecutar.

### Paso 3: Líneas reales y error en el editor
- [ ] Ejecutar una selección: `QueryEditor` pasa la línea donde empieza la selección junto con el código, y el frontend la suma a `line` de resultados y errores. Arregla los `L#` de la tarea 33 y aplica a todas las vistas.
- [ ] `statements.rs`: las directivas de string del programa (`"hola"` en la primera línea) cuentan como expresión y dan su valor.
- [ ] `QueryEditor`: extensión CodeMirror (`errorMark.ts`, nueva) que subraya la línea del error y pone un icono en el margen con el mensaje en el tooltip, **en todas las vistas**. Se borra al editar el texto o al volver a ejecutar; sin línea, no se marca nada.

### Paso 4: Tests
- [ ] vitest `consoleEntry`:
  - `find` con 1 doc → `cursor`;
  - `toArray` con 1 doc → `array`;
  - `findOne` → `object`, y `null` sin coincidencia;
  - `insertOne` / `deleteMany` → `write`;
  - `countDocuments` → `scalar` (`120`);
  - `distinct` → `array`;
  - un documento con `$oid`/`$date` es `object` y sus campos son wrappers;
  - un `{ $oid }` suelto es `scalar`;
  - `print`;
  - error con y sin línea.
- [ ] vitest `consolePreview`: recorte, anidados, wrappers, array vacío, objeto vacío. Desplazamiento de líneas al ejecutar una selección.
- [ ] Rust: la directiva `"hola"` en la primera línea da su valor, y `"use strict"` seguido de código no rompe nada.

### Paso 5: Verificación
- [ ] Prueba real **solo en MongoDB local** (BD desechable, se borra al final), con un script que tenga:
  - `find` de 1 y de muchos documentos;
  - `aggregate` y `toArray`;
  - `findOne` con y sin coincidencia;
  - `insertOne`, `deleteMany` y `countDocuments`;
  - `print` y un error en medio.

  Cada sentencia debe mostrarse con su tipo y su `L#` correcto, también ejecutando solo una selección. La marca de error debe aparecer en el editor y borrarse al editar.
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`
- [ ] Commit: `feat(shell): vista consola y error marcado en el editor`
- **Cierre de Fase 19**

## Criterios de aceptación
- [ ] En Consola, cada resultado se muestra según su tipo real: un cursor o un array son `Array` aunque traigan 1 documento, y solo un documento confirmado es objeto
- [ ] Cada entrada lleva el `L#` de su línea en el editor, también al ejecutar una selección, y al hacer clic se salta a esa línea
- [ ] Un error se ve en rojo en la consola y queda marcado en su línea del editor en cualquier vista
- [ ] Los cursores largos no congelan la consola: se cargan por páginas con «más…»

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: El usuario pidió clasificar por tipo real y no asumir objeto por traer 1 documento; la tabla de «Cómo llega cada resultado» sale de revisar `prelude.js`, `prelude/mod.rs` y `to_bson.rs`.
