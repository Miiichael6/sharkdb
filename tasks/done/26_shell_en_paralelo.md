# 26 · Dos consultas del shell en paralelo (pestaña dividida)

**Estado:** ✅ Terminada
**Fase:** 13 Shell en paralelo · **Depende de:** 04, 05 · **Doc:** R49, R50 · **Referencia:** file-manager (`src/features/tabs/application/useTabActions.ts` → `splitWithTab` / `separateTab`; zonas `mi-split-drop` en `src/app/App/App.tsx`)

## Objetivo
Como en file-manager: una pestaña del shell se puede **dividir en dos paneles lado a lado**, cada uno con su editor y sus resultados, para escribir y ejecutar dos consultas a la vez (p. ej. `AccesosSistema` a la izquierda y `Estados_ope_logistica` a la derecha). Se divide **arrastrando** una pestaña sobre el área del shell y se separa desde el menú de la pestaña.

## Pasos

### Paso 1: Pestaña dividida (dominio puro)
- [x] `src/features/shell/domain/splitTabs.ts` (nuevo, puro): una entrada de la barra es una pestaña o una **pestaña dividida** `{ panes: [izq, der], activePane, ratio }`; `splitWithTab(state, arrastrada, lado)` pone la arrastrada en ese lado y lo que se veía en el otro (si la arrastrada ya estaba dividida, su otro panel queda como pestaña suelta en su sitio), `separateTab(state, id)` deja el panel activo y abre el otro como pestaña nueva justo detrás, `focusPane(state, lado)` (R49, R50)
- [x] `src/features/shell/domain/tabs.ts`: cerrar un panel de una dividida la deja como pestaña normal; `closeSessionTabs` y `duplicateTab` funcionan con divididas (R49)

### Paso 2: Vista
- [x] `src/features/shell/ui/useShellTabs.ts`: usa `splitTabs`; expone `splitWithTab`, `separateTab`, `focusPane`; `active` es el panel activo de la pestaña activa, así los atajos (Ctrl+Enter, Ctrl+T/W/O/S) actúan sobre él (R49)
- [x] `src/features/shell/ui/ShellTabs.tsx` + `SplitShell.tsx` (nuevo): la dividida muestra sus dos `ShellTab` con un divisor arrastrable (proporción guardada en la pestaña, mínimo de ancho por panel); clic o foco en un panel lo vuelve el activo (borde de acento sutil); en ventana estrecha solo se ve el activo (como `SPLIT_MIN_WIDTH` de file-manager) (R49)
- [x] `TabBar.tsx`: la dividida se ve como **una** pestaña `A [|] B`, con el icono de columnas en el centro y los nombres pegados a él, el nombre del panel activo resaltado; menú contextual **"Separar pestaña"** (R50)

### Paso 3: Arrastrar para dividir
- [x] `src/features/shell/ui/SplitDropZones.tsx` (nuevo): mientras se arrastra una pestaña (que no sea la activa) sobre el área del shell, capa con dos zonas según la proporción real del divisor; una vista previa se desliza al lado bajo el cursor con el aviso "Abrir «X» a la izquierda / a la derecha"; al soltar → `splitWithTab` (R50)
- [x] `useTabDrag.ts`: hoy reordena con eventos de puntero (no HTML5 drag & drop); extenderlo para que, al salir de la barra hacia el área del shell, avise a `SplitDropZones` en vez de reordenar (R50)
- [x] Arrastrar una **colección** del explorador al área del shell (pedido del usuario): sin pestaña visible se abre en una pestaña nueva (zona completa); con una, al lado; sobre una dividida reemplaza el lado elegido y el panel desplazado queda como pestaña suelta (`openBeside` en `splitTabs.ts`, `useCollectionDrag.ts` en el explorador)
- [x] Confirmar que dos ejecuciones simultáneas no se bloquean: cada pestaña tiene su propio runtime (`TabShells` en `src-tauri/src/shell/commands.rs`); los paneles mantienen su id de pestaña para seguir así (R49)

### Paso 4: Tests
- [x] `splitTabs.test.ts`: dividir a cada lado, dividir con una que ya estaba dividida, separar, cerrar un panel, cerrar sesión con una dividida, duplicar una dividida

### Paso 5: Verificación
- [x] Prueba real (MongoDB local, hecha por el usuario): abrir `AccesosSistema` y `Estados_ope_logistica`, arrastrar una sobre el área → se ven lado a lado; lanzar una consulta lenta en cada panel → corren a la vez; Ctrl+Enter ejecuta solo el panel activo; "Separar pestaña" devuelve las dos pestañas
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `cargo check` pasan
- [x] Commit: `feat(shell): dividir una pestaña del shell en dos paneles`
- [x] **Cierre de Fase 13**: `npm run tauri dev` arranca

## Criterios de aceptación
- [x] Arrastrar una pestaña sobre el área del shell muestra la vista previa del lado y, al soltar, las dos consultas quedan lado a lado con divisor arrastrable
- [x] Dos consultas lanzadas a la vez en paneles distintos se ejecutan en paralelo, cada una con sus resultados
- [x] La pestaña dividida se ve como una sola en la barra (`A | B`) y "Separar pestaña" las vuelve a separar sin perder código ni resultados
- [x] Los atajos del shell actúan sobre el panel activo

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Modelo tomado de file-manager (pestaña dividida, no dos barras de pestañas), a petición del usuario.
- 2026-10-31: Sin `SplitShell.tsx`: todas las pestañas siguen montadas en una lista plana y la dividida se coloca con `order` de flex (`useSplitLayout` + `SplitDivider`), así dividir/separar no pierde editor ni resultados; `focusPane` quedó cubierto por `activateTab`.
- 2026-10-31: Icono de MongoDB movido a `src/assets/mongodb.webp` (`MongoLogo`): sustituye el "Mg" del avatar de conexión, el icono de servidor del explorador y el selector de driver.
- 2026-10-31: Verificado: 302 tests, typecheck, `cargo check` y `npm run tauri dev` arranca; prueba manual con MongoDB local hecha por el usuario.
- 2026-10-31: Las zonas de destino (`SplitDropZones`) resuelven ellas el soltar (pointerup en captura), así pestañas y colecciones comparten un solo camino.
