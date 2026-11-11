# 43 · Reintentar operaciones fallidas desde el panel

**Estado:** ⬜ Pendiente
**Fase:** 27 Reintentar operaciones · **Depende de:** 20, 41 · **Doc:** 00_README.md R101–R103, D17, D23, D27

## Objetivo
Una operación fallida (o cancelada, según D27) del panel de Operaciones muestra un botón ⟳ **Reintentar** que la vuelve a lanzar con la misma configuración, sin rehacer la selección de origen, destino y colecciones.

## Pasos

### Paso 1: Guardar cómo relanzar cada operación
- [ ] `src/shared/domain/operations.ts`: la `Operation` guarda su petición original (`SyncRequest`, `BackupRequest`, `RestoreRequest` y `DocumentSyncRequest` de 42 si ya existe) y `canRetry(op)`: solo fallidas o canceladas (D27) (R101)
- [ ] `src/shared/application/operationsService.ts`: `retry(id)` crea una operación nueva con la misma petición y el mismo `launch`; la fallida queda en el historial marcada como reintentada (R102)

### Paso 2: UI del panel
- [ ] `src/app/operations/OperationRow.tsx` y `OperationDetail.tsx`: botón ⟳ con `aria-label="Reintentar"` en las filas que lo permitan; sub-ventana corta "Reintentar origen → destino" sin `confirmo` (R101, R103, D27)
- [ ] `src/app/operations/useOperations.tsx`: expone `retry(op)`; antes de lanzar se vuelve a comprobar safe mode / conexión protegida del destino y se conectan las conexiones cerradas (R103)

### Paso 3: Tests
- [ ] Vitest de `canRetry` (fallida, cancelada, terminada, en curso) y de `retry` con adaptadores falsos (misma petición, operación nueva)

### Paso 4: Verificación
- [ ] Prueba real: provocar un sync fallido (p. ej. detener el mongod de destino), volver a levantarlo y pulsar ⟳: termina sin volver a elegir nada
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npx tsc --noEmit` pasan
- [ ] Commit: `feat(Operaciones): reintenta operaciones fallidas desde el panel` **Cierre de Fase 27**

## Criterios de aceptación
- [ ] Una operación fallida muestra ⟳ y al pulsarlo se relanza con el mismo origen, destino y colecciones
- [ ] Las operaciones terminadas o en curso no muestran ⟳
- [ ] Un destino que entretanto pasó a protegido o a safe mode no se escribe al reintentar

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
