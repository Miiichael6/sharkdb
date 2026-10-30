# 18 · Confirmaciones en ventanas modales

**Estado:** ✅ Terminada
**Fase:** 8 Barra de herramientas · **Depende de:** 12 · **Doc:** R36

## Objetivo
Toda confirmación (eliminar colección, BD, índice, usuario, función, documentos, conexión; cerrar pestaña sin guardar; desactivar safe mode) se abre como sub-ventana del sistema, solo con X, y la ventana principal no se puede tocar hasta cerrarla.

## Pasos

### Paso 1: Ventana de confirmación
- [x] `src/shared/ui/modalWindow.ts`: opción `resizable` en `openModalWindow` (R36)
- [x] `src/shared/ui/confirmInWindow.ts`: `confirmInWindow({ title, message, confirmLabel })` → `Promise<boolean>`; alto según el largo del mensaje (`confirmWindowHeight`, lógica pura) (R36)
- [x] `src/shared/ui/ConfirmWindow.tsx` (vista, Enter confirma, Escape cancela, nombres largos se parten sin scroll horizontal) y registro en `src/app/ModalWindow.tsx`

### Paso 2: Sustituir los diálogos en línea
- [x] `useExplorerActions.ts`/`ExplorerDialogs.tsx`, `DocumentActionsProvider.tsx`, `Welcome.tsx`, `ShellTabs.tsx`, `WorkspaceToolbar.tsx` usan `confirmInWindow`; se borra `ConfirmDialog` (R36)

### Paso 3: Verificación
- [x] Test de `confirmWindowHeight`; `npm test`, `tsc`, build
- [ ] Prueba real en `npm run tauri dev` (pendiente del usuario, ver bitácora): eliminar colección abre sub-ventana, la principal queda bloqueada, X cancela
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] Commit: `feat(ui): confirmaciones en ventanas modales`

## Criterios de aceptación
- [x] Ninguna confirmación se dibuja dentro de la ventana principal
- [x] La sub-ventana solo tiene X; cerrarla equivale a Cancelar
- [ ] Con la sub-ventana abierta, la principal no responde a clics ni teclado
- [ ] Un nombre largo se parte en varias líneas, sin barra horizontal

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: El opener se llama `confirmInWindow.ts` y no `confirmWindow.ts`: en Windows choca por mayúsculas con la vista `ConfirmWindow.tsx`.
- 2026-10-30: El bloqueo de la principal lo da `openModalWindow` (`setEnabled(false)` hasta cerrar la hija, ya probado en la tarea 12); la prueba manual en la app queda pendiente del usuario porque esta sesión no maneja la GUI.
