# 01 · Base de tests y orden del Workspace

**Estado:** ✅ Terminada
**Fase:** 1 Base · **Depende de:** – · **Doc:** R4

## Objetivo
Dejar el proyecto listo para crecer: tests unitarios en TS y Rust funcionando, y `Workspace.tsx` dividido para que las pestañas de shell (04) quepan sin inflarlo más.

## Pasos

### Paso 1: Infraestructura de tests
- [x] Añadir `vitest` como devDependency y script `"test": "vitest run"` en `package.json`; config mínima en `vite.config.ts` (R4)
- [x] Tests de lógica pura existente: `connection.test.ts` (`buildUri`, `parseUri`, `fieldsFromUri`, `maskUri`), `tree.test.ts` (`childKey`/`parentKey`), `indexSpec.test.ts` (`creatableSpec`)
- [x] `src-tauri/src/mongo.rs`: módulo `#[cfg(test)]` con un test de la conversión BSON ↔ JSON que ya use `run_command`; `cargo test` en verde

### Paso 2: Separar Workspace
- [x] Extraer de `src/features/explorer/ui/Workspace.tsx` el manejo de acciones del menú a `useExplorerActions.ts` (hook: acción + nodo → diálogo/servicio) y las notificaciones a `shared/ui/useNotice.ts`
- [x] Extraer el panel redimensionable a `shared/ui/SplitPane.tsx`; `Workspace.tsx` queda como composición (< 150 líneas)

### Paso 3: Verificación
- [x] Prueba real: `npm run tauri dev`, conectar a un Mongo local, crear/renombrar/eliminar colección, añadir/editar índice: todo se comporta igual que antes
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build` (tsc) y `cargo test` pasan
- [x] Commit: `chore(base): vitest, tests de dominio y división de Workspace`
- **Cierre de Fase 1**

## Criterios de aceptación
- [x] `npm test` ejecuta al menos 3 archivos de test en verde
- [x] `cargo test` pasa en `src-tauri`
- [x] `Workspace.tsx` no supera ~150 líneas y no hay regresiones en el explorador

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Además de lo previsto salieron `ExplorerDialogs.tsx` y `NoticeToast.tsx` (Workspace 333 → 81 líneas); CSS del panel dividido renombrado a `split-*` para que `SplitPane` sea genérico.
- 2026-10-30: `mongo.rs`: conversión extraída a `command_from_json`/`reply_to_json` para testearla sin servidor.
- 2026-10-30: Prueba real automatizada por CDP (WebView2 `--remote-debugging-port`) contra Mongo local con BD desechable `robo3b_test`: BD, colecciones, índices, estadísticas, errores, aviso y splitter OK.
