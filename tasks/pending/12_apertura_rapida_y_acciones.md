# 12 · Apertura rápida y acciones rápidas de base de datos

**Estado:** ⬜ Pendiente
**Fase:** 8 Barra de herramientas · **Depende de:** 11 · **Doc:** R25, R26

## Objetivo
Una paleta para abrir una conexión o una base de datos escribiendo su nombre, y un menú de acciones rápidas sobre la BD activa (nuevo shell, nueva colección, estadísticas, backup, restore, sync, mongosh).

## Pasos

### Paso 1: Lógica de búsqueda
- [ ] `src/features/workspace/domain/quickOpen.ts`: construir candidatos (conexiones guardadas, BDs de sesiones abiertas, acciones de `toolbarActions.ts`) y `fuzzyRank(query, items)` + tests (coincidencia parcial, orden, consulta vacía) (R25)

### Paso 2: Paleta y acciones
- [ ] `src/shared/ui/CommandPalette.tsx` genérico (input + lista con `role="listbox"`, flechas/Enter/Esc) y `src/features/workspace/ui/QuickOpen.tsx` que lo usa en tres modos: **Open connection** (`Ctrl+Shift+K`, conecta si no está abierta), **Open database** (`Ctrl+K`, la selecciona y abre un shell) y **Quick database actions** (`Ctrl+.`) (R25, R26)
- [ ] Botones de la barra (11) para los tres modos; backup/restore/sync aparecen deshabilitadas con tooltip hasta que existan 14 y 15 (R26)

### Paso 3: Verificación
- [ ] Prueba real: con 3 conexiones y varias BDs, abrir cada una solo con teclado; lanzar "Nueva colección" y "Abrir en mongosh" desde acciones rápidas
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build` pasan
- [ ] Commit: `feat(workspace): paleta de apertura rápida y acciones de BD`

## Criterios de aceptación
- [ ] Se abre cualquier conexión o BD sin usar el ratón
- [ ] Las acciones rápidas ejecutan lo mismo que su equivalente del árbol (sin código duplicado)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
