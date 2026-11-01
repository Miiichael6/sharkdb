# 32 · Ejecución automática de los backups programados

**Estado:** ⬜ Pendiente
**Fase:** 17 Backups programados · **Depende de:** 31 · **Doc:** R61, R62 · D15, D16 en [00_README.md](../00_README.md)

## Objetivo
Cada programación activa se ejecuta sola según su frecuencia (diaria, semanal, cada hora, una vez o mensual; Manual nunca), sin confirmación (ya se confirmó al guardarla), avisa al terminar si se pidió, y borra las ejecuciones viejas según D16.

## Pasos

### Paso 1: Planificador
- [ ] `src/features/backup/domain/schedule.ts`: `nextRun(schedule, ahora)` y `isDue(schedule, ahora)` para cada `repeat` (incluye la ejecución perdida si la app estaba cerrada a la hora, D15) y `runsToDelete(carpetas, retención)` (D16); tests con fechas fijas (cambio de día, hora ya pasada, desactivada, semana, mes de 30 días con día 31 → el último, "Una vez" pasada)
- [ ] "Una vez" se desactiva sola tras ejecutarse; "Manual" nunca entra en el planificador
- [ ] Dos ejecuciones en el mismo minuto no comparten carpeta: la segunda lleva sufijo `_2` (pendiente de la 31)
- [ ] `src-tauri/src/schedule/` (nuevo): bucle de Tokio que cada minuto lee las programaciones y emite `backup-schedule-due`; el front lanza `runNow` y guarda `lastRun`. La conexión se abre aparte (`open_detached`, 22) y se cierra al terminar (R61)

### Paso 2: Avisos y arranque
- [ ] Al terminar: notificación del centro de notificaciones (13) y, si `notify`, notificación del sistema; un fallo siempre avisa (R62)
- [ ] Según D15: solo con la app abierta; al arrancar, las programaciones cuya hora de hoy ya pasó sin `lastRun` de hoy se ejecutan entonces (sin casilla de arranque automático)

### Paso 3: Verificación
- [ ] Prueba real **solo local**: programación a dentro de 2 minutos → se ejecuta sola, avisa y deja su carpeta; con la app cerrada a esa hora → se ejecuta al abrirla (D15); la retención borra la más vieja
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`
- [ ] Commit: `feat(backup): ejecución diaria de los backups programados`
- **Cierre de Fase 17**

## Criterios de aceptación
- [ ] Una programación activa se ejecuta en cada momento que marca su frecuencia, nunca dos veces el mismo
- [ ] Una conexión protegida (producción) se puede respaldar, porque el backup solo lee
- [ ] Cada ejecución avisa de su resultado y la carpeta conserva solo las últimas según D16

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
