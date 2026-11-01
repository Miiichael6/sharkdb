# 33 · Un resultado por sentencia: apilados hasta 2, pestañas desde 3

**Estado:** ✅ Terminada
**Fase:** 18 Resultados múltiples · **Depende de:** 05, 26 · **Doc:** R63, R64

## Objetivo
Al ejecutar un script con varias sentencias (`find()`, `print`, valores), cada sentencia que devuelve algo da su propio resultado, como en Robo 3T: con 1 o 2 resultados se muestran apilados en el panel y con 3 o más se reparten en sub-pestañas. Hoy solo se ve el valor de la última sentencia.

## Pasos

### Paso 1: Backend, un resultado por sentencia
- [x] `src-tauri/src/shell/statements.rs` (nuevo): parte el script en sentencias de primer nivel con un parser JS (p. ej. `oxc_parser`), cada una con su línea inicial, y marca cuáles son expresiones. Va después de `syntax::rewrite` para que `use`/`show` sigan funcionando
- [x] `engine.rs` → `run()`: evalúa las sentencias una a una en el mismo contexto global. Las variables `let`, `const` y `var` deben pasar de una sentencia a la siguiente, y los errores deben dar la línea del script original (se rellena con saltos de línea). Se para en la primera sentencia que falle. Cada expresión que devuelva algo distinto de `undefined` pasa por `final_result` y deja un resultado
- [x] `outcome.rs`: cada `ScriptResult` lleva `line` y `source` (el texto de la sentencia, recortado). Límite `MAX_RESULTS` por ejecución, con aviso si se supera. Se cierran los cursores de la ejecución anterior, como ya se hace hoy

### Paso 2: Frontend, apilados o en pestañas
- [x] `src/features/shell/domain/outcome.ts`: añadir `line` y `source` a los tipos. `domain/resultLayout.ts` (nuevo): `resultLayout(results)` → `"single" | "stacked" | "tabs"` (constante `MAX_STACKED = 2`) y `resultTitle(result)`, que da `L3 · Liquidadas_Claro.find` sin el `db.getCollection(` delante. Los `print` seguidos se agrupan con la sentencia a la que pertenecen
- [x] `ui/results/StackedResults.tsx` y `ui/results/ResultTabs.tsx` (nuevos): apilados, cada uno con una cabecera (título, n.º de documentos, paginador) y altura repartida. En pestañas, rol `tablist` y Ctrl+Tab para moverse. `ResultsPanel.tsx` solo decide cuál de los dos usar. La barra de vista (árbol/tabla/texto) se comparte
- [x] Un error aparece como un resultado más, en su posición y en rojo, después de los que sí se ejecutaron. Con un solo resultado, el panel queda igual que hoy

### Paso 3: Tests
- [x] Rust (`src-tauri/src/shell/tests/`): 3 `find` → 3 cursores con su línea; `const x = 1` y luego `x` en otra sentencia; error en la línea 3 → 2 resultados y el error con línea 3; `use otra` sigue funcionando; un script de una sola expresión no cambia
- [x] vitest: `resultLayout` (0, 1, 2, 3 resultados), `resultTitle` (con `db.getCollection('x')`, `db.x` y una sentencia larga)

### Paso 4: Verificación
- [x] Prueba real **solo en MongoDB local**: las 3 líneas de `find({})` de la captura → 3 pestañas `L1/L2/L3`, cada una paginando por separado; con 2 líneas → apilados; con 1 → igual que antes; un error en medio → resultados previos + error
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`
- [x] Commit: `feat(shell): un resultado por sentencia, apilados o en pestañas`
- **Cierre de Fase 18**

## Criterios de aceptación
- [x] Cada sentencia que devuelve algo tiene su propio resultado, rotulado con la línea y la sentencia que lo produjo
- [x] 1 o 2 resultados se ven apilados; 3 o más, en pestañas
- [x] Las variables definidas en una sentencia se pueden usar en las siguientes, y los errores siguen dando la línea correcta
- [x] Cada cursor pagina por separado sin afectar a los demás

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: El usuario eligió replicar Robo 3T (2 apilados, 3+ en pestañas) en lugar de bloques plegables o resúmenes dentro del editor.
- 2026-11-01: `oxc_parser` parte en sentencias de primer nivel y cada una se evalúa en el mismo contexto global, rellenada con saltos/espacios para conservar línea y columna; solo se adelantan las `function` (un `var` usado antes de declararse ya no se eleva) y si oxc no parsea, el script corre entero como antes.
- 2026-11-01: Prueba real por CDP en una segunda instancia de `tauri dev` (con `WEBVIEW2_USER_DATA_FOLDER` propio) sobre la BD desechable `robo3b_test33`, ya borrada; los tests vivos de TLS/SSH fallan solo por faltar sus variables de entorno.
- 2026-11-01: Relanzar un script con `const`/`let` de primer nivel da "redeclaration" en la misma sesión; ya pasaba con la evaluación global anterior, queda fuera de esta tarea.
