# 25 · Confirmación roja con `confirmo` para borrados manuales

**Estado:** ✅ Terminada
**Fase:** 12 Operaciones destructivas · **Depende de:** 18, 21 · **Doc:** R47, R48

## Objetivo
Las acciones manuales que borran datos en el servidor se confirman en una sub-ventana **entera en rojo**, que muestra conexión y entorno y exige escribir **`confirmo`**, igual que el sync. Las de menor riesgo quedan en rojo pero con confirmación simple (lista en D12). **No afecta a los scripts del shell** (`db.x.drop()`, `deleteMany`…): ahí la protección sigue siendo el safe mode (D5).

## Pasos

### Paso 1: Dominio
- [x] `src/shared/domain/destructiveActions.ts` (nuevo, puro): catálogo `DestructiveAction` → nivel (`typed` = rojo + `confirmo`, `simple` = rojo sin escribir) según D12, más `destructiveRequest(action, target)` que arma el `DangerConfirmRequest` con encabezado `Se va a ELIMINAR`, conexión + etiqueta y qué se pierde (R47)
- [x] Reutiliza `CONFIRM_WORD` / `confirmationMatches` de `confirmation.ts`; sin texto duplicado en cada llamada (R47)

### Paso 2: Sub-ventana roja
- [x] `src/shared/ui/DangerConfirmWindow.tsx` / `App.css`: variante "eliminar" con toda la ventana en rojo (cabecera con icono de alerta ⚠ + `Se va a ELIMINAR`, borde, fondo tenue, botón); conexión y entorno visibles; qué se pierde en renglón aparte; el botón queda deshabilitado hasta escribir `confirmo` en el nivel `typed`. La variante `simple` comparte el estilo rojo, sin campo (R47)
- [x] Escape y Cancelar nunca confirman; el foco inicial va al campo, no al botón rojo (R47)

### Paso 3: Conectar las acciones
- [x] `useExplorerActions.ts`: eliminar base de datos, colección, índice y usuario pasan por `destructiveRequest` (R48)
- [x] `DocumentActionsProvider.tsx`: eliminar todos los documentos y eliminar documentos seleccionados, con el nivel de D12 (R48)
- [x] `Welcome.tsx`: eliminar conexión registrada, nivel de D12 (no borra nada en el servidor) (R48)
- [x] Tecla **Supr** en los resultados del shell (árbol y tabla) elimina el documento seleccionado con la misma ventana; el menú muestra el atajo; respeta safe mode (pedido del usuario, solo en documentos)
- [x] Selección de varios documentos en árbol y tabla (clic, Ctrl/Shift+clic, arrastrar con el ratón, Shift+flechas en el árbol, Ctrl+A); Supr y el menú ("Eliminar N documentos…") los borran juntos con una sola ventana (pedido del usuario)
- [x] Sin parpadeo en las ventanas modales: se crean ocultas con el fondo del tema, se muestran al pintar la vista y se ocultan antes de cerrarse (pedido del usuario; afecta a todas)

### Paso 4: Tests
- [x] `destructiveActions.test.ts`: nivel de cada acción, request con conexión/etiqueta, texto de lo que se pierde
- [x] Test de la ventana: botón deshabilitado hasta `confirmo` (mayúsculas y espacios ignorados), Escape cancela → cubierto por `canConfirmDeletion` en `destructiveActions.test.ts`; Escape, en la prueba real

### Paso 5: Verificación
- [x] Prueba real en MongoDB local (hecha por el usuario): eliminar una BD y una colección de prueba → ventana roja, no deja confirmar sin `confirmo`; Cancelar no borra nada
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y lint pasan
- [x] Commit: `feat(confirm): confirmación roja con confirmo para borrados`
- [x] **Cierre de Fase 12**: `npm run tauri dev` arranca

## Criterios de aceptación
- [x] Toda acción `typed` de D12 muestra la sub-ventana en rojo con icono de alerta, conexión y entorno, y solo procede tras escribir `confirmo`
- [x] Las acciones `simple` se ven en rojo y piden un clic de confirmación
- [x] Ninguna acción destructiva puede confirmarse con Enter o Escape por accidente

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: D12 aprobada tal cual; el usuario pide además icono de alerta en la cabecera (también en la variante `simple`).
- 2026-10-31: Ventana propia `DeleteConfirmWindow` (vista `delete-confirm`) en vez de variante de `DangerConfirmWindow`, que lleva lista de cambios y "Volver"; ambas comparten `ConfirmWordField`. "Eliminar función" (no está en D12) va como `simple`.
- 2026-10-31: Sin entorno DOM en vitest (solo `*.test.ts`) ni config de ESLint: la lógica de la ventana se testea en `canConfirmDeletion`; lint = typecheck. `tauri dev` no arrancó por el puerto 1420 ocupado (instancia del usuario abierta): se verificó con `vite build`.
- 2026-10-31: Prueba manual y revisión hechas por el usuario; criterios confirmados.
