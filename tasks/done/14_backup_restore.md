# 14 · Backup y restore de base de datos

**Estado:** ✅ Terminada
**Fase:** 9 Operaciones de BD · **Depende de:** 12, 13 · **Doc:** R29

## Objetivo
Hacer copia de seguridad de una base de datos (todas o algunas colecciones) a disco y restaurarla en la misma u otra conexión, con progreso y cancelación.

## Pasos

### Paso 1: Motor de backup/restore (Rust)
- [x] `src-tauri/src/backup/` nativo (D6): exportar cada colección por lotes a `<colección>.bson` (documentos BSON concatenados) + `<colección>.metadata.json` (índices y opciones) con el mismo formato que `mongodump`; restaurar leyendo esos archivos con `insert_many` por lotes y recreando índices; lectura/escritura del formato en módulo propio testeado con ida y vuelta (R29)
- [x] Comandos finos `backup_database` / `restore_database` con progreso por evento Tauri y cancelación (mismo patrón que la cancelación de 03) (R29)

### Paso 2: UI
- [x] `src/features/backup/` hexagonal: `domain/backupSpec.ts` + tests, `application/backupService.ts`, `infrastructure/tauriBackupGateway.ts`, `ui/BackupDialog.tsx` y `ui/RestoreDialog.tsx` (elegir colecciones, carpeta, opción "eliminar antes de restaurar", conexión/BD destino) (R29)
- [x] Entradas en el menú de BD del árbol, la barra (11) y acciones rápidas (12); restaurar nunca se permite sobre una conexión protegida o con safe mode activo (13, comprobado también en el backend), el diálogo destaca el entorno destino que se va a modificar, y el resultado llega al centro de notificaciones (R29)

### Paso 3: Verificación
- [x] Prueba real: backup de una BD con varias colecciones e índices; restaurar en otra BD y en otra conexión; comparar conteos e índices; cancelar a mitad
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(backup): backup y restore de bases de datos` (propuesto, pendiente del usuario)

## Criterios de aceptación
- [x] Un backup restaurado conserva documentos (mismos conteos), tipos BSON e índices
- [x] El progreso es visible, la interfaz no se congela y se puede cancelar

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Formato compatible verificado en ambos sentidos con mongodump/mongorestore 4.2 y restore cruzado 4.2 → 7 (Docker): conteos, índices, capped y tipos BSON iguales; las vistas no se copian.
- 2026-10-30: Sin eliminar antes, los `_id` repetidos se saltan y se cuentan (como mongorestore); el `.bson` se escribe como `.partial` y se renombra, así un backup cancelado no pisa el anterior.
- 2026-10-30: «Restaurar…» no se desactiva por safe mode del nodo origen: el destino se elige en el diálogo, que bloquea conexiones protegidas o en safe mode (y el backend lo vuelve a comprobar leyendo `connections.json`). La UI no se probó a mano aquí; cubierta con tests, `tsc` y build.
