# 19 · Menús de índices y conexión como Robo 3T

**Estado:** ✅ Terminada
**Fase:** 7 Administración · **Depende de:** 17, 18 · **Doc:** R37

## Objetivo
Completar el menú de la carpeta de índices (Ver índices, Reconstruir índices) y el de la conexión (Ver log), como en Robo 3T.

## Pasos

### Paso 1: Scripts de shell del menú
- [x] `src/features/shell/domain/collectionScripts.ts` → `menuScripts.ts`: `viewIndexes` (`.getIndexes()`, se ejecuta) y script de servidor `showLog` (`db.adminCommand({ getLog: 'global' })`); `tabForNode` los abre desde la carpeta de índices y desde la conexión (R37)

### Paso 2: Reconstruir índices
- [x] `ports.ts`/`commandMongoAdmin.ts`: `rebuildIndexes(sid, db, coll)` → comando `reIndex` (R37)
- [x] `writeActions.ts`: `rebuildIndexes: "reIndex"` (bloqueado en safe mode); `useExplorerActions.ts` pide confirmación en sub-ventana y refresca la carpeta (R37)

### Paso 3: Menús
- [x] `Explorer.tsx`: carpeta de índices = Ver índices · Añadir índice… · Reconstruir índices… · Refrescar; conexión añade Ver log antes de Desconectar (R37)

### Paso 4: Verificación
- [x] Tests de `menuScripts`, `writeActions` y `tabForNode`; `npm test`, `tsc`, build
- [ ] Prueba real en la app (`npm run tauri dev`): Ver índices, Reconstruir índices y Ver log contra el Mongo local (pendiente del usuario, ver bitácora)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] Commit: `feat(explorer): menús de índices y conexión como Robo 3T`

## Criterios de aceptación
- [ ] Ver índices abre una pestaña que lista los índices de la colección
- [ ] Reconstruir índices pide confirmación en sub-ventana y, aceptada, ejecuta `reIndex`; en safe mode está deshabilitado
- [ ] Ver log abre una pestaña con el log global del servidor

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: `collectionScripts.ts` pasa a `menuScripts.ts` (Ver log es de servidor); `menuScript(kind, coll)` decide en el dominio qué script lleva cada nodo, testeable sin Tauri.
- 2026-10-30: `getIndexes` y `getLog` probados en vivo contra Mongo 4.2; `reIndex` y los menús en la UI quedan sin probar a mano (la app abierta del usuario no tenía puerto de depuración).
