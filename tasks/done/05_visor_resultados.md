# 05 · Visor de resultados: árbol, tabla y texto

**Estado:** ✅ Terminada
**Fase:** 3 Shell · **Depende de:** 04 · **Doc:** R10, R7

## Objetivo
Debajo del editor, los resultados se ven en tres modos intercambiables (árbol `Key/Value/Type`, tabla, texto) con la barra de paginación de Robo 3T. **Prioridad del usuario:** la vista árbol debe comportarse como la de Robo 3T (ver captura de referencia en la bitácora).

## Pasos

### Paso 1: Modelo de vista
- [x] `src/features/shell/domain/resultView.ts`: aplanar documentos a filas de árbol (clave, valor resumido, tipo BSON, hijos) y a columnas de tabla (unión de claves de primer nivel, rutas con punto) + tests (R10)
- [x] `src/features/shell/domain/bsonFormat.ts`: Extended JSON canónico (lo que devuelve 03) → texto en el formato de D2 con indentación, más resumen corto para la columna Value (`{ 10 fields }`, `[ 3 elements ]`) + tests (R6)
- [x] `src/features/shell/domain/paging.ts`: estado skip/limit, avanzar/retroceder, rango "1 – 50" + tests (R7)

### Paso 2: Componentes
- [x] `src/features/shell/ui/results/TreeView.tsx` (virtualizado, expandir/contraer, icono por tipo): fila raíz `(n) ObjectId("…")` numerada desde el skip, Value `{ N fields }` / `[ N elements ]`, columna Type (Double, String, Object, ObjectId…), **primer documento expandido al cargar** (R17)
- [x] Fechas en **UTC o en hora local**: interruptor en la barra de resultados que reformatea sin reejecutar; valor guardado temporalmente en estado y persistido luego por 08 (R17), `TableView.tsx` (columnas redimensionables), `TextView.tsx` (formato de `bsonFormat.ts`) (R10)
- [x] `ResultsPanel.tsx`: salida de `print` como bloque de texto entre resultados, selector de modo, paginación (◀ skip ▶ limit), cuenta de resultados, varios resultados apilados si el script tuvo varias sentencias, y menú contextual "Copiar valor / Copiar documento / Copiar ruta" (R10)

### Paso 3: Verificación
- [x] Prueba real: colección con documentos anidados y arrays de 10k docs; cambiar de modo, paginar, copiar documento; el scroll se mantiene fluido
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test` y `npm run build` pasan
- [x] Commit: `feat(shell): visor de resultados en árbol, tabla y texto`
- **Cierre de Fase 3**

## Criterios de aceptación
- [x] Los tres modos muestran el mismo resultado y se cambia entre ellos sin reejecutar
- [x] La paginación pide el siguiente lote al cursor (03) y muestra el rango correcto
- [x] Los tipos BSON se distinguen visualmente (ObjectId, fecha, número, etc.)
- [x] Al ejecutar `db.getCollection('X').find({})` el árbol se ve como en Robo 3T: filas numeradas, `{ N fields }`, columna Type y el primer documento ya expandido
- [x] El interruptor UTC/local cambia todas las fechas mostradas sin reejecutar la consulta

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Referencia visual aportada por el usuario: captura de Robo 3T 1.4 con `DivisionGeografica` (árbol Key/Value/Type, paginación `0 | 50`, tiempo `0.009 sec.`). Prioridad máxima del usuario entre las mejoras pedidas.
- 2026-10-30: D2 → estilo shell. La tabla aplana subdocumentos en columnas con punto (`dir.geo.lat`); arrays en una sola columna. Lista virtual, menú contextual y cabecera redimensionable quedan en `src/shared/ui/` para reutilizarlos.
- 2026-10-30: Probado en la app real vía CDP con 10k docs anidados: árbol/tabla ~16 ms por frame al hacer scroll; cambiar a Texto con limit 10000 tarda ~1,5 s (6,4 MB de texto), aceptable. El portapapeles se comprobó interceptando `writeText` (leerlo pide permiso a WebView2).
