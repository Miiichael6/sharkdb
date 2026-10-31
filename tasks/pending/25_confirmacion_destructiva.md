# 25 · Confirmación roja con `confirmo` para borrados manuales

**Estado:** ⬜ Pendiente
**Fase:** 12 Operaciones destructivas · **Depende de:** 18, 21 · **Doc:** R47, R48

## Objetivo
Las acciones manuales que borran datos en el servidor se confirman en una sub-ventana **entera en rojo**, que muestra conexión y entorno y exige escribir **`confirmo`**, igual que el sync. Las de menor riesgo quedan en rojo pero con confirmación simple (lista en D12). **No afecta a los scripts del shell** (`db.x.drop()`, `deleteMany`…): ahí la protección sigue siendo el safe mode (D5).

## Pasos

### Paso 1: Dominio
- [ ] `src/shared/domain/destructiveActions.ts` (nuevo, puro): catálogo `DestructiveAction` → nivel (`typed` = rojo + `confirmo`, `simple` = rojo sin escribir) según D12, más `destructiveRequest(action, target)` que arma el `DangerConfirmRequest` con encabezado `Se va a ELIMINAR`, conexión + etiqueta y qué se pierde (R47)
- [ ] Reutiliza `CONFIRM_WORD` / `confirmationMatches` de `confirmation.ts`; sin texto duplicado en cada llamada (R47)

### Paso 2: Sub-ventana roja
- [ ] `src/shared/ui/DangerConfirmWindow.tsx` / `App.css`: variante "eliminar" con toda la ventana en rojo (cabecera con icono de alerta ⚠ + `Se va a ELIMINAR`, borde, fondo tenue, botón); conexión y entorno visibles; qué se pierde en renglón aparte; el botón queda deshabilitado hasta escribir `confirmo` en el nivel `typed`. La variante `simple` comparte el estilo rojo, sin campo (R47)
- [ ] Escape y Cancelar nunca confirman; el foco inicial va al campo, no al botón rojo (R47)

### Paso 3: Conectar las acciones
- [ ] `useExplorerActions.ts`: eliminar base de datos, colección, índice y usuario pasan por `destructiveRequest` (R48)
- [ ] `DocumentActionsProvider.tsx`: eliminar todos los documentos y eliminar documentos seleccionados, con el nivel de D12 (R48)
- [ ] `Welcome.tsx`: eliminar conexión registrada, nivel de D12 (no borra nada en el servidor) (R48)

### Paso 4: Tests
- [ ] `destructiveActions.test.ts`: nivel de cada acción, request con conexión/etiqueta, texto de lo que se pierde
- [ ] Test de la ventana: botón deshabilitado hasta `confirmo` (mayúsculas y espacios ignorados), Escape cancela

### Paso 5: Verificación
- [ ] Prueba real en MongoDB local: eliminar una BD y una colección de prueba → ventana roja, no deja confirmar sin `confirmo`; Cancelar no borra nada
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck y lint pasan
- [ ] Commit: `feat(confirm): confirmación roja con confirmo para borrados`
- [ ] **Cierre de Fase 12**: `npm run tauri dev` arranca

## Criterios de aceptación
- [ ] Toda acción `typed` de D12 muestra la sub-ventana en rojo con icono de alerta, conexión y entorno, y solo procede tras escribir `confirmo`
- [ ] Las acciones `simple` se ven en rojo y piden un clic de confirmación
- [ ] Ninguna acción destructiva puede confirmarse con Enter o Escape por accidente

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: D12 aprobada tal cual; el usuario pide además icono de alerta en la cabecera (también en la variante `simple`).
