# 26 · Dos consultas del shell en paralelo (pestaña dividida)

**Estado:** ⛔ Bloqueada (D13)
**Fase:** 13 Shell en paralelo · **Depende de:** 04, 05 · **Doc:** R49, R50 · **Referencia:** file-manager (`src/features/tabs/application/useTabActions.ts` → `splitWithTab` / `separateTab`; zonas `mi-split-drop` en `src/app/App/App.tsx`)

## Objetivo
Como en file-manager: una pestaña del shell se puede **dividir en dos paneles lado a lado**, cada uno con su editor y sus resultados, para escribir y ejecutar dos consultas a la vez (p. ej. `AccesosSistema` a la izquierda y `Estados_ope_logistica` a la derecha). Se divide **arrastrando** una pestaña sobre el área del shell y se separa desde el menú de la pestaña.

## Pasos

### Paso 1: Pestaña dividida (dominio puro)
- [ ] `src/features/shell/domain/splitTabs.ts` (nuevo, puro): una entrada de la barra es una pestaña o una **pestaña dividida** `{ panes: [izq, der], activePane, ratio }`; `splitWithTab(state, arrastrada, lado)` pone la arrastrada en ese lado y lo que se veía en el otro (si la arrastrada ya estaba dividida, su otro panel queda como pestaña suelta en su sitio), `separateTab(state, id)` deja el panel activo y abre el otro como pestaña nueva justo detrás, `focusPane(state, lado)` (R49, R50)
- [ ] `src/features/shell/domain/tabs.ts`: cerrar un panel de una dividida la deja como pestaña normal; `closeSessionTabs` y `duplicateTab` funcionan con divididas (R49)

### Paso 2: Vista
- [ ] `src/features/shell/ui/useShellTabs.ts`: usa `splitTabs`; expone `splitWithTab`, `separateTab`, `focusPane`; `active` es el panel activo de la pestaña activa, así los atajos (Ctrl+Enter, Ctrl+T/W/O/S) actúan sobre él (R49)
- [ ] `src/features/shell/ui/ShellTabs.tsx` + `SplitShell.tsx` (nuevo): la dividida muestra sus dos `ShellTab` con un divisor arrastrable (proporción guardada en la pestaña, mínimo de ancho por panel); clic o foco en un panel lo vuelve el activo (borde de acento sutil); en ventana estrecha solo se ve el activo (como `SPLIT_MIN_WIDTH` de file-manager) (R49)
- [ ] `TabBar.tsx`: la dividida se ve como **una** pestaña con icono de columnas y `A | B`, el nombre del panel activo resaltado; menú contextual **"Separar pestaña"** (R50)

### Paso 3: Arrastrar para dividir
- [ ] `src/features/shell/ui/SplitDropZones.tsx` (nuevo): mientras se arrastra una pestaña (que no sea la activa) sobre el área del shell, capa con dos zonas según la proporción real del divisor; una vista previa se desliza al lado bajo el cursor con el aviso "Abrir «X» a la izquierda / a la derecha"; al soltar → `splitWithTab` (R50)
- [ ] `useTabDrag.ts`: hoy reordena con eventos de puntero (no HTML5 drag & drop); extenderlo para que, al salir de la barra hacia el área del shell, avise a `SplitDropZones` en vez de reordenar (R50)
- [ ] Confirmar que dos ejecuciones simultáneas no se bloquean: cada pestaña tiene su propio runtime (`TabShells` en `src-tauri/src/shell/commands.rs`); los paneles mantienen su id de pestaña para seguir así (R49)

### Paso 4: Tests
- [ ] `splitTabs.test.ts`: dividir a cada lado, dividir con una que ya estaba dividida, separar, cerrar un panel, cerrar sesión con una dividida, duplicar una dividida

### Paso 5: Verificación
- [ ] Prueba real (MongoDB local): abrir `AccesosSistema` y `Estados_ope_logistica`, arrastrar una sobre el área → se ven lado a lado; lanzar una consulta lenta en cada panel → corren a la vez; Ctrl+Enter ejecuta solo el panel activo; "Separar pestaña" devuelve las dos pestañas
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck y `cargo check` pasan
- [ ] Commit: `feat(shell): dividir una pestaña del shell en dos paneles`
- [ ] **Cierre de Fase 13**: `npm run tauri dev` arranca

## Criterios de aceptación
- [ ] Arrastrar una pestaña sobre el área del shell muestra la vista previa del lado y, al soltar, las dos consultas quedan lado a lado con divisor arrastrable
- [ ] Dos consultas lanzadas a la vez en paneles distintos se ejecutan en paralelo, cada una con sus resultados
- [ ] La pestaña dividida se ve como una sola en la barra (`A | B`) y "Separar pestaña" las vuelve a separar sin perder código ni resultados
- [ ] Los atajos del shell actúan sobre el panel activo

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Modelo tomado de file-manager (pestaña dividida, no dos barras de pestañas), a petición del usuario.
