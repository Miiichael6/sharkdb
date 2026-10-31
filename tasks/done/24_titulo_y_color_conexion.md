# 24 · Título de ventana y color de la conexión activa

**Estado:** ⬜ Pendiente
**Fase:** 11 Bases fijadas · **Depende de:** 23 · **Doc:** R45, R46

## Objetivo
Siempre se ve a qué conexión y entorno se apunta: el título de la ventana lo dice y la barra de herramientas toma el color de la etiqueta de la conexión. Los selectores de sync/backup/restore ponen las favoritas primero.

## Pasos

### Paso 1: Título y color
- [ ] `src/features/workspace/domain/windowTitle.ts` (nuevo, puro): `windowTitle(conn?)` → `robo3B · <conexión> · <ETIQUETA>` (local, desarrollo, producción…), solo `robo3B` sin conexión activa (R45)
- [ ] Adaptador que llama a `getCurrentWindow().setTitle(...)` (inyectado en `src/app/services.tsx`) para que se vea también en la barra de tareas y en Alt+Tab (R45)
- [ ] `src/app/WorkspaceToolbar.tsx` / `App.css`: la barra usa el color de la etiqueta de la conexión activa (variable CSS), con contraste del texto legible; safe mode **no** cambia su valor por defecto (R45)

### Paso 2: Favoritas en las operaciones de datos
- [ ] Selectores de base en `SyncSelectWindow.tsx` y en las ventanas de backup/restore: favoritas primero y el resto debajo (reutiliza el orden de `pinnedDatabases.ts`), sin ocultar ninguna (R46)

### Paso 3: Tests
- [ ] `windowTitle.test.ts`: con y sin conexión, cada etiqueta

### Paso 4: Verificación
- [ ] Prueba real: cambiar entre una conexión local y una de QA → título y color de la barra cambian; en Alt+Tab se ve la conexión
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck y lint pasan
- [ ] Commit: `feat(workspace): título y color según la conexión activa`
- [ ] **Cierre de Fase 11**: `npm run tauri dev` arranca

## Criterios de aceptación
- [ ] El título de la ventana muestra conexión y etiqueta de entorno
- [ ] La barra de herramientas tiene el color de la etiqueta de la conexión activa
- [ ] En sync/backup/restore las favoritas aparecen primero

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
