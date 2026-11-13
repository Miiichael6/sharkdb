# 43 · Reintentar operaciones fallidas desde el panel

**Estado:** 🔄 En progreso
**Fase:** 27 Reintentar operaciones · **Depende de:** 20, 41 · **Doc:** 00_README.md R101–R103, D17, D23, D27

## Objetivo
Una operación fallida (o cancelada, según D27) del panel de Operaciones muestra un botón ⟳ **Reintentar** que la vuelve a lanzar con la misma configuración, sin rehacer la selección de origen, destino y colecciones.

## Pasos

### Paso 1: Guardar cómo relanzar cada operación
- [x] `src/shared/domain/operations.ts`: la `Operation` guarda su petición original (`SyncRequest`, `BackupRequest`, `RestoreRequest` y `DocumentSyncRequest` de 42 si ya existe) y `canRetry(op)`: solo fallidas o canceladas (D27) (R101)
- [x] `src/shared/application/operationsService.ts`: `retry(id)` crea una operación nueva con la misma petición y el mismo `launch`; la fallida queda en el historial marcada como reintentada (R102)

### Paso 2: UI del panel
- [x] `src/app/operations/OperationRow.tsx` y `OperationDetail.tsx`: botón ⟳ con `aria-label="Reintentar"` en las filas que lo permitan; sub-ventana corta "Reintentar origen → destino" sin `confirmo` (R101, R103, D27)
- [x] `src/app/operations/useOperations.tsx`: expone `retry(op)`; antes de lanzar se vuelve a comprobar safe mode / conexión protegida del destino y se conectan las conexiones cerradas (R103)

### Paso 3: Tests
- [x] Vitest de `canRetry` (fallida, cancelada, terminada, en curso) y de `retry` con adaptadores falsos (misma petición, operación nueva)

### Paso 4: Verificación
- [ ] Prueba real: provocar un sync fallido (p. ej. detener el mongod de destino), volver a levantarlo y pulsar ⟳: termina sin volver a elegir nada
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npx tsc --noEmit` pasan
- [x] Commit: `feat(Operaciones): reintenta operaciones fallidas desde el panel` **Cierre de Fase 27**

## Criterios de aceptación
- [ ] Una operación fallida muestra ⟳ y al pulsarlo se relanza con el mismo origen, destino y colecciones
- [x] Las operaciones terminadas o en curso no muestran ⟳
- [x] Un destino que entretanto pasó a protegido o a safe mode no se escribe al reintentar

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-12: `retry(id, relaunch)` no reusa el `launch` guardado sino que se reconstruye desde la petición (`DataRequest` en `app/operations/dataRequest.ts`) con las conexiones actuales: así R103 se comprueba contra la protección y el safe mode de ahora. `shared/` guarda la petición como `unknown` para no depender de `features/`.
- 2026-11-12: El Workspace registra el relanzador (`useRelaunch`) en el contexto de operaciones; conecta las conexiones cerradas con `connectOnRequest` y las suelta al terminar. Una operación reintentada queda marcada "Reintentada" y ya no muestra ⟳.
- 2026-11-12: Tests solo pasan desde PowerShell (en Git Bash vitest 5 falla al cargar con "reading 'config'"). Falta la prueba real con mongod detenido: requiere la GUI de Tauri y parar el servicio MongoDB; queda para el usuario.
