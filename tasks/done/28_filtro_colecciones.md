# 28 · Filtrar colecciones del árbol escribiendo

**Estado:** ✅ Terminada
**Fase:** 15 Explorador · **Depende de:** 23 · **Doc:** R53

## Objetivo
Con muchas colecciones (p. ej. 158 en `MDL_ADMINISTRACION`) se encuentra una escribiendo parte de su nombre, sin bajar con el scroll. El filtro es por base de datos, dentro de su carpeta `Collections`.

## Pasos

### Paso 1: Lógica del filtro
- [x] `src/features/explorer/domain/collectionFilter.ts` (nuevo): coincidencia sin mayúsculas ni tildes, varias palabras = todas deben estar (`al02 pre` → `ALEMANIA_AL02_Pre…`), rangos a resaltar y umbral `FILTER_MIN_COLLECTIONS` (~15) para mostrar la caja + tests (R53)

### Paso 2: UI en el árbol
- [x] `src/features/explorer/ui/CollectionFilter.tsx` (nuevo): caja "Filtrar colecciones…" como primera fila dentro de `Collections` abierta, solo si supera el umbral; Escape la vacía, ↓ baja a la lista, Enter abre la colección si queda una (R53)
- [x] `useTree.ts` / `Explorer.tsx`: texto del filtro por carpeta (se mantiene al refrescar), hijos filtrados, nombre con la parte que coincide resaltada y contador `Collections (12 de 158)`; Ctrl+F con el árbol enfocado va a la caja de la base seleccionada (R53)

### Paso 3: Verificación
- [x] Prueba real en local con una base de muchas colecciones: filtrar, varias palabras, Escape, Enter con una sola, refrescar sin perder el filtro
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `vite build` pasan
- [ ] Commit: `feat(explorer): filtrar colecciones escribiendo` (propuesto, pendiente del usuario)

## Criterios de aceptación
- [x] Escribir parte del nombre deja solo las colecciones que coinciden, con la coincidencia resaltada
- [x] El contador dice cuántas se ven de cuántas hay
- [x] Bases con pocas colecciones no muestran la caja

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Propuesta aceptada por el usuario: filtro dentro de cada `Collections`, no un buscador global (mezclaría conexiones y obligaría a cargar bases cerradas).
- 2026-10-31: El filtro vive en `useTree` (por clave de carpeta, sobrevive a los refrescos) y la navegación con flechas recorre solo lo filtrado; mientras se filtra se oculta la carpeta System. El teclado del árbol pasó a `useTreeKeyboard.ts` y `ancestor` a `useTree` para no duplicarlo.
- 2026-10-31: tsc, vitest (346) y build en verde; prueba en la UI y criterios confirmados por el usuario al pedir el cierre.
- 2026-10-31: Ajustes pedidos tras el cierre, en esta rama: el diálogo "Bases de datos" marca lo que ya muestra el explorador (favoritas fijas, Abrir aplica la lista, Desmarcar), logs bajo el área principal a media altura y redimensionables, paneles redondeados y contador del panel igual al del árbol.
