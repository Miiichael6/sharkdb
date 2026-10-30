# 04 · Pestañas de shell con editor y autocompletado

**Estado:** ✅ Terminada
**Fase:** 3 Shell · **Depende de:** 03 · **Doc:** R8, R9

## Objetivo
El área derecha pasa a tener pestañas de shell como Robo 3T: doble clic en una colección abre `db.getCollection('x').find({})`, se ejecuta con Ctrl+Enter/F5 y el editor autocompleta e recuerda el historial.

## Pasos

### Paso 1: Pestañas
- [x] `src/features/shell/domain/tabs.ts`: estado puro de pestañas (abrir, cerrar, duplicar, renombrar, activa) + tests (R8)
- [x] `src/features/shell/ui/ShellTabs.tsx` y `ShellTab.tsx`: barra de pestañas y cabecera (servidor · BD · tiempo de ejecución); integrar en `Workspace.tsx` junto a `DetailPanel`; acción "Abrir shell" y doble clic en el árbol (`Explorer.tsx`) (R8)

### Paso 2: Editor
- [x] Añadir CodeMirror 6 (`@codemirror/lang-javascript`); `src/features/shell/ui/QueryEditor.tsx` con atajos Ctrl+Enter/F5 (ejecutar todo o la selección), Ctrl+Shift+F (formatear) (R8)
- [x] `src/features/shell/domain/completion.ts`: sugerencias puras según contexto (`db.` → colecciones, `.` tras colección → métodos, dentro de filtro → campos muestreados y operadores `$`) + tests; adaptador CodeMirror en `ui/completionSource.ts` (R9)

### Paso 3: Historial
- [x] `src/features/shell/domain/history.ts` (lista acotada, sin duplicados consecutivos) + persistencia por conexión vía `store.rs` (nuevo comando `save_history`/`load_history`); panel o atajo Ctrl+↑ para recuperarlo (R9)
- [x] Abrir/guardar scripts `.js` (Ctrl+O / Ctrl+S) con `tauri-plugin-dialog` + `tauri-plugin-fs`; la pestaña muestra el nombre del archivo y marca cambios sin guardar (R15)
- [x] Atajos de pestañas Ctrl+T (nueva, sobre la BD seleccionada) y Ctrl+W (cerrar) en `src/features/shell/ui/useTabShortcuts.ts` (R16)
- [x] Panel de logs (View → Logs): `src/shared/domain/log.ts` (buffer acotado de entradas con nivel y hora) + `src/shared/ui/LogPanel.tsx` plegable; registrar conexiones, scripts ejecutados con su tiempo y errores (R16)

### Paso 4: Verificación
- [x] Prueba real: abrir 3 pestañas sobre colecciones distintas, ejecutar consultas con selección parcial, autocompletar nombre de campo, reiniciar la app y recuperar historial
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test` y `npm run build` pasan
- [x] Commit: `feat(shell): pestañas, editor CodeMirror, autocompletado e historial`

## Criterios de aceptación
- [x] Doble clic en una colección abre una pestaña con la consulta por defecto lista para ejecutar
- [x] Ctrl+Enter ejecuta la selección (o todo) y muestra el tiempo de ejecución
- [x] El autocompletado sugiere colecciones, métodos y campos reales
- [x] El historial persiste entre reinicios
- [x] Ctrl+T / Ctrl+W abren y cierran pestañas; el panel de logs muestra cada ejecución y error

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Un runtime de shell por pestaña (`ShellRef {sid, tab}`); scripts .js con comandos Rust `read_script`/`write_script` en vez de plugin-fs; `CommandRunner` pasa a `shared`.
- 2026-10-30: Las pestañas viven en `App` y el explorador expone slots (`renderMain`, `onOpenShell`) para no importar UI de shell. Prueba real vía CDP de WebView2 (`--remote-debugging-port`).
- 2026-10-30: Bug heredado de 03: `db.x.drop()` sobre colección inexistente lanza "ns not found" con línea del preludio; `countDocuments` se muestra como `$numberDouble` (lo resolverá el formato de D2 en 05).
