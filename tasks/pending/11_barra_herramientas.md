# 11 · Barra de herramientas del workspace

**Estado:** ⬜ Pendiente
**Fase:** 8 Barra de herramientas · **Depende de:** 04 · **Doc:** R21, R22, R23, R24, R34

## Objetivo
El `ws-header` actual se sustituye por una barra de herramientas estilo TablePlus con botones para ocultar/mostrar el explorador, menú de la app, ver conexiones, ver bases de datos, refrescar el workspace y abrir `mongosh` en una terminal externa.

## Pasos

### Paso 1: Componente de barra y acciones de layout
- [ ] `src/features/workspace/domain/toolbarActions.ts`: constantes de acciones (id, etiqueta, atajo, icono), fuente única para la barra, el menú y la paleta de 12 (R21)
- [ ] `src/features/workspace/ui/Toolbar.tsx` + `ToolbarButton.tsx` (`role="toolbar"`, navegación con flechas, `aria-pressed` en toggles); `Workspace.tsx` la usa en lugar de `ws-header`. Distribución en grupos como la referencia de TablePlus: [panel BDs · menú · conexiones] [safe mode · show databases · abrir shell] [píldora de estado] [notificaciones · refrescar · acciones rápidas] [panel de logs] (R21)
- [ ] `src/features/workspace/ui/StatusPill.tsx` + `domain/statusLabel.ts` (con test): píldora central `ETIQUETA | MongoDB <versión> : <conexión> : <BD> : <colección>` de la pestaña activa, coloreada con el color de la etiqueta de la conexión (reutiliza `TagBadge`/colores existentes) para distinguir LOCAL / QA / PROD de un vistazo (R34)
- [ ] Toggle del panel de bases de datos (explorador) con `Ctrl+B`: `SplitPane` acepta `sideHidden`; estado persistido en `localStorage` vía hook `usePanelLayout.ts` (R22)

### Paso 2: Menú, conexiones, bases de datos y refrescar
- [ ] Botón **Menú**: desplegable reutilizando `src/shared/ui/ContextMenu.tsx` con Nueva conexión, Abrir script, Guardar script, Logs, Acerca de (R21)
- [ ] **Show connections** (abre `Welcome`, ya existe) y **Show databases**: popover `DatabaseSwitcher.tsx` con las BDs de la sesión activa; elegir una la selecciona en el árbol y la despliega (R23)
- [ ] **Refresh workspace** (`Ctrl+R` / `F5` fuera del editor): `useTree` expone `refreshAll()` que recarga BDs y colecciones de todas las sesiones conservando los nodos expandidos (R23)

### Paso 3: Abrir mongosh
- [ ] `src-tauri/src/terminal.rs`: lógica pura `mongosh_command(uri, db)` (testeable) + comando fino `open_mongosh(sid, db)` que lanza la terminal del sistema (Windows Terminal, con `cmd` como fallback) con `mongosh "<uri>"`; error claro si `mongosh` no está en el PATH (R24)
- [ ] Puerto `TerminalGateway` en `src/features/workspace/application/ports.ts`, adaptador `tauriTerminalGateway.ts`, inyectado en `src/app/services.tsx`; botón en la barra y entrada "Abrir en mongosh" en el menú de BD del árbol (R24)

### Paso 4: Verificación
- [ ] Prueba real: ocultar/mostrar explorador (botón y Ctrl+B, persiste al reiniciar); cambiar de BD desde el popover; crear una colección desde otro cliente y refrescar; abrir mongosh conectado a la BD seleccionada
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(workspace): barra de herramientas, cambio de BD, refrescar y mongosh`

## Criterios de aceptación
- [ ] Todas las acciones de la barra funcionan con ratón y con su atajo, y son navegables por teclado
- [ ] Refrescar no colapsa el árbol ni cierra pestañas
- [ ] mongosh se abre conectado a la URI de la sesión (o se muestra un error comprensible si no está instalado)

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
