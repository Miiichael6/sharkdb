# 31 · Backups programados: lista y formulario como TablePlus

**Estado:** ✅ Terminada
**Fase:** 17 Backups programados · **Depende de:** 22 · **Doc:** R58, R59, R60 · D16, D17 en [00_README.md](../00_README.md)

## Objetivo
La ventana de bienvenida tiene, arriba a la izquierda, dos iconos: **Conexiones** (la lista de hoy) y **Backups** (lista de backups programados), copiando el "Backup schedule" de TablePlus. Cada programación se crea, edita, activa/desactiva y se puede **ejecutar ya** (▶) reutilizando el backup multi-BD de la tarea 22; la ejecución automática diaria es la tarea 32.

## Pasos

### Paso 1: Dominio y servicio
- [x] `src/features/backup/domain/schedule.ts` (nuevo): `BackupSchedule` (`id`, `name`, `enabled`, `repeat: "daily"`, `time` en cuartos de hora, `notify`, `backup: BackupRequest | null`), `newSchedule`, `withDefaults`, `duplicateSchedule`, `quarterHour`, `runFolder(dir, nombre, fecha)` → `<dir>/<nombre>/<AAAA-MM-DD_HHMM>` (D16) y `runRequest` (R58, R59)
- [x] `application/scheduleService.ts` + puerto `ScheduleStore` en `ports.ts`: listar (con valores por defecto) y guardar; `runNow` vive en `ui/useBackupSchedules.ts` porque reutiliza `data.backup` del panel de Operaciones (R60)
- [x] Tests vitest: `schedule.test.ts` (horas, carpetas Windows/POSIX, nombres seguros) y `scheduleService.test.ts`

### Paso 2: Persistencia
- [x] `src-tauri/src/store.rs`: `load_backup_schedules` / `save_backup_schedules` (`backup-schedules.json` junto a las conexiones); `infrastructure/tauriScheduleStore.ts` lo implementa y se inyecta en `src/app/services.tsx`

### Paso 3: UI en la bienvenida
- [x] `Welcome.tsx`: los dos iconos (Conexiones / Backups, con `aria-pressed`) en la barra; con Backups, el `+` / Ctrl+N crea una programación y la búsqueda filtra programaciones
- [x] `src/features/backup/ui/ScheduleList.tsx` (nuevo): fila con nombre, hora, interruptor activo y ▶; menú contextual Ejecutar / Duplicar / Eliminar (rojo sin escribir, D12)
- [x] `src/features/backup/ui/ScheduleForm.tsx` (nuevo), a la derecha: **Nombre**, **Repetir**, **Avisar al terminar**, **Origen** y **Destino**; se guarda solo al editar. "Elegir qué y dónde…" abre las ventanas del backup de la 22 (`chooseBackup`) y pide `confirmo` una sola vez; ▶ ya no lo pide (D17)
- [x] **Repetir** sin desplegables: Diario / Semanal (días L–D) / Cada hora / Una vez (fecha) / Mensual (día 1–31) / Manual con `SegmentedControl` y `NumberStepper` (nuevos en `src/shared/ui/`, también usados por `ScreenSwitch`); hora 1–12 + a. m./p. m. con icono sol / atardecer / luna (`TimeField`, `DayPeriodIcon`) y frase resumen (`repeatSummary`, `repeatShort` en la lista)

### Paso 4: Verificación
- [x] Prueba real **solo local/QA**: crear una programación de 2 BDs de local, guardarla, reiniciar la app (sigue ahí), ▶ deja una carpeta fechada restaurable con `mongorestore` (hecha por el usuario)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npx tsc --noEmit`, `npx vitest run`, `cargo clippy`, `cargo test`, `npm run build`
- [x] Commit: `feat(backup): programaciones de backup en la bienvenida`

## Criterios de aceptación
- [x] La bienvenida alterna entre Conexiones y Backups con los iconos de arriba a la izquierda
- [x] Las programaciones persisten entre reinicios y se editan en el formulario de la derecha
- [x] ▶ hace el backup en `<carpeta>/<nombre>/<fecha>` con progreso en el panel de Operaciones, en el formato de la tarea 22

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Horas solo en cuartos de hora (00/15/30/45) a pedido del usuario; lo guardado fuera de cuarto se redondea al cargar.
- 2026-10-31: Qué guardar, carpeta y `confirmo` se eligen en las mismas ventanas de la 22 (`chooseBackup` extraído de `useBackupFlow`), no en el formulario; `RETAINED_RUNS` y la retención de 7 pasan a la 32 para no dejar código sin uso.
- 2026-10-31: El usuario pidió más frecuencias y reloj de 12 h: se guarda igual en 24 h (`time`), con `weekdays`/`dayOfMonth`/`date` nuevos; Manual no se puede activar (solo ▶). Su ejecución automática queda en la 32.
- 2026-10-31: Validaciones en el dominio (`runBlocker` para ▶, `enableBlocker` para el interruptor): conexión borrada, fecha de "Una vez" real y desde hoy, nombre que no repita carpeta con otro destino igual (la retención de 7 borraría copias ajenas) y nombres reservados de Windows con `_` delante. La 32 debe usar `enableBlocker`.
- 2026-10-31: Un solo backup a la vez (`BACKUP_BUSY`); el que corre sube a "Ejecutando", sin interruptor y con Cancelar, que reutiliza la cancelación del panel de Operaciones (no estaba en la 32).
- 2026-10-31: tsc, vitest (379), clippy, cargo test y build en verde; prueba manual hecha por el usuario. Queda para la 32: dos ▶ en el mismo minuto comparten carpeta (propuesto sufijo `_2`).
