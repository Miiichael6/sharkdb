# 24 · Título de ventana y color de la conexión activa

**Estado:** ✅ Terminada
**Fase:** 11 Bases fijadas · **Depende de:** 23 · **Doc:** R45, R46

## Objetivo
Siempre se ve a qué conexión y entorno se apunta: el título de la ventana lo dice y la barra de herramientas toma el color de la etiqueta de la conexión. Los selectores de sync/backup/restore ponen las favoritas primero.

## Pasos

### Paso 1: Título y color
- [x] `src/features/workspace/domain/windowTitle.ts` (nuevo, puro): `windowTitle(conn?)` → `robo3B · <conexión> · <ETIQUETA>` (local, desarrollo, producción…), solo `robo3B` sin conexión activa (R45)
- [x] Adaptador que llama a `getCurrentWindow().setTitle(...)` (inyectado en `src/app/services.tsx`) para que se vea también en la barra de tareas y en Alt+Tab (R45)
- [ ] ~~`src/app/WorkspaceToolbar.tsx` / `App.css`: la barra usa el color de la etiqueta de la conexión activa (variable CSS), con contraste del texto legible; safe mode **no** cambia su valor por defecto (R45)~~ (quitado a petición del usuario, ver bitácora)

### Paso 2: Favoritas en las operaciones de datos
- [x] Selectores de base en `SyncSelectWindow.tsx` y en las ventanas de backup/restore: favoritas primero y el resto debajo (reutiliza el orden de `pinnedDatabases.ts`), sin ocultar ninguna (R46)

### Paso 3: Tests
- [x] `windowTitle.test.ts`: con y sin conexión, cada etiqueta

### Paso 4: Verificación
- [ ] Prueba real (pendiente en la UI, ver bitácora): cambiar entre una conexión local y una de QA → el título cambia; en Alt+Tab se ve la conexión
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y lint pasan (el proyecto no tiene linter; `npm run build` y `cargo check` también pasan)
- [ ] Commit: `feat(workspace): título y color según la conexión activa` (propuesto, pendiente del usuario)
- [ ] **Cierre de Fase 11**: `npm run tauri dev` arranca (no comprobado: la app del usuario ya ocupaba el puerto 1420)

## Criterios de aceptación
- [x] El título de la ventana muestra conexión y etiqueta de entorno
- [ ] ~~La barra de herramientas tiene el color de la etiqueta de la conexión activa~~ (descartado por el usuario)
- [x] En sync/backup/restore las favoritas aparecen primero

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Barra coloreada con la etiqueta implementada y luego **quitada a petición del usuario** (no le gustó): el entorno se ve en el título y en la píldora. Título usa `tagLabel` (PRODUCTION…), igual que la píldora.
- 2026-10-31: En restore las favoritas son las de la conexión **destino** (la carpeta no tiene favoritas). `orderForDialog` ahora reutiliza `shared/domain/favoritesFirst.ts`. Nuevo permiso `core:window:allow-set-title`.
- 2026-10-31: Prueba real y `tauri dev` sin hacer: la app del usuario estaba abierta (puerto 1420); hay que reiniciarla para cargar el permiso nuevo y comprobar título/Alt+Tab y color al cambiar entre local y QA.
