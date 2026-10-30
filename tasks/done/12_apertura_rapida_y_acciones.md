# 12 · Apertura rápida y acciones rápidas de base de datos

**Estado:** ✅ Terminada (prueba manual con 3 conexiones pendiente en la UI)
**Fase:** 8 Barra de herramientas · **Depende de:** 11 · **Doc:** R25, R26

## Objetivo
Una paleta para abrir una conexión o una base de datos escribiendo su nombre, y un menú de acciones rápidas sobre la BD activa (nuevo shell, nueva colección, estadísticas, backup, restore, sync, mongosh).

## Pasos

### Paso 1: Lógica de búsqueda
- [x] `src/features/workspace/domain/quickOpen.ts`: construir candidatos (conexiones guardadas, BDs de sesiones abiertas, acciones de `toolbarActions.ts`) y `fuzzyRank(query, items)` + tests (coincidencia parcial, orden, consulta vacía) (R25)

### Paso 2: Paleta y acciones
- [x] `src/shared/ui/CommandPalette.tsx` genérico (input + lista con `role="listbox"`, flechas/Enter/Esc) y `src/features/workspace/ui/QuickOpen.tsx` que lo usa en tres modos: **Open connection** (`Ctrl+Shift+K`, conecta si no está abierta), **Open database** (`Ctrl+K`, la selecciona y abre un shell) y **Quick database actions** (`Ctrl+.`) (R25, R26)
- [x] Botones de la barra (11) para los tres modos; backup/restore/sync aparecen deshabilitadas con tooltip hasta que existan 14 y 15 (R26)

### Paso 3: Verificación
- [ ] Prueba real: con 3 conexiones y varias BDs, abrir cada una solo con teclado; lanzar "Nueva colección" y "Abrir en mongosh" desde acciones rápidas
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build` pasan
- [x] Commit: `feat(workspace): paleta de apertura rápida y acciones de BD`

## Criterios de aceptación
- [ ] Se abre cualquier conexión o BD sin usar el ratón
- [x] Las acciones rápidas ejecutan lo mismo que su equivalente del árbol (sin código duplicado)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Las acciones rápidas llaman a `controls.runAction` (el mismo `onAction` del menú del árbol) sobre el nodo de la BD activa; sin BD activa salen todas deshabilitadas.
- 2026-10-30: Open database solo lista BDs ya cargadas en el árbol; las acciones de `toolbarActions.ts` no entran como candidatos (ya tienen botón y atajo).
- 2026-10-30: Fallo en prueba: las acciones iban siempre a la BD de la pestaña activa (LOG); ahora el contexto es lo último tocado, pestaña o árbol (`useCurrentTarget`), y la paleta muestra la BD destino.
- 2026-10-30: Fuera de alcance, a petición del usuario: menús contextuales sin scroll (se abren arriba/abajo según el sitio) y menú de resultados completo como Robo 3T (expandir/colapsar recursivo, copiar nombre/JSON, iconos).
- 2026-10-30: Revisión: los atajos válidos en el editor se capturan antes que CodeMirror (Ctrl+Shift+K borraba la línea); el contexto vuelve a la pestaña al hacer clic o enfocarla.
- 2026-10-30: Prueba manual con 3 conexiones pendiente del usuario (no hay MongoDB ni UI interactiva en este entorno); verificado con tests, `tsc` y build.
- 2026-10-30: Cerrada a petición del usuario y unida a `main` (antes `master`); la prueba manual queda pendiente en la UI, como en 06.
