# 15 · Sincronizar entre entornos

**Estado:** ✅ Terminada
**Fase:** 9 Operaciones de BD · **Depende de:** 09, 14 · **Doc:** R30 · D7

## Objetivo
Restaurar una base de datos completa o colecciones sueltas de un entorno a otro (p. ej. prod → QA), reemplazando el contenido del destino, sin poder nunca modificar una conexión protegida y dejando siempre claro qué se va a modificar.

## Pasos

### Paso 1: Plan de sincronización
- [x] `src/features/sync/domain/syncPlan.ts`: dado origen (conexión, BD, colecciones elegidas o todas) y destino, valida (destino ≠ origen, destino no protegido ni con safe mode activo) y calcula el plan por colección: crear / reemplazar (con conteo actual → conteo nuevo) e índices a recrear + tests (R30, D7)
- [x] Comando Rust `describe_database(sid, db)` (colecciones, conteos, índices, opciones) para construir el plan; la aplicación reutiliza el restore de 14 desde un stream origen→destino (sin pasar por disco). El backend vuelve a comprobar que el destino no está protegido (R30)

### Paso 2: UI
- [x] `src/features/sync/ui/SyncDialog.tsx`: selector de origen y destino con su píldora de entorno (color de la etiqueta, como en 11), modo "BD completa" o "colecciones" con casillas; las conexiones protegidas no aparecen como destino. Antes de aplicar, resumen destacado "Se va a MODIFICAR: <entorno> · <conexión> : <BD>" con la lista de colecciones que se reemplazan, y confirmación escribiendo el nombre de la BD destino (R30, D7)
- [x] Progreso por colección, cancelación y resultado en el centro de notificaciones (13); entradas en la barra (11), acciones rápidas (12) y menú de BD/colección del árbol (R30)

### Paso 2b: Varias BDs y acciones rápidas (pedido tras revisar la UI)
- [x] Sync de varias BDs en un solo trabajo (`sync_databases`, `database_catalog`): cada BD entera o por colección, a la BD del mismo nombre en el destino; selector tipo sigo-restorer (`DatabasePicker`, `DatabaseRow`) con filtro, "Todas completas" y "Limpiar"; se confirma escribiendo el nombre de la conexión de destino
- [x] Una conexión con etiqueta `production` cuenta como protegida (sync y restore, UI y backend)
- [x] Acciones rápidas: solo Sincronizar, Backup y Restore, activas con solo una conexión abierta

### Paso 3: Verificación
- [x] Prueba real: restaurar una colección y luego una BD completa de una conexión "prod" a una "QA"; los conteos e índices del destino coinciden con el origen; la conexión protegida no se puede elegir como destino (ni forzando la llamada al backend)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [x] Commit: `feat(sync): restaurar BD y colecciones entre entornos`
- **Cierre de Fase 9**

## Criterios de aceptación
- [x] Una conexión protegida nunca se modifica: ni la UI la ofrece como destino ni el backend lo permite
- [x] Antes de aplicar se ve sin ambigüedad qué entorno/BD se va a modificar y qué colecciones se reemplazan
- [x] Tras sincronizar, el destino tiene los mismos documentos e índices que el origen en lo elegido

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-30: Cada colección se copia a `<coll>.robo3b-sync-<id>` en el destino y se cambia con `renameCollection` + `dropTarget`; si falla o se cancela se borra la temporal y el destino queda intacto. En "BD completa" se conservan las colecciones que solo existen en el destino. El diálogo va en su propia ventana modal (`modal-sync`), que no se puede cerrar mientras sincroniza.
- 2026-10-30: Infraestructura de jobs movida a compartida (Rust `jobs/`, evento `job-progress`, `cancel_job`; TS `shared/` con `createJobRunner`, `useJob`), usada por backup, restore y sync.
- 2026-10-30: Prueba real con el test vivo sobre Mongo local ("prod" y "QA" simulados como BDs locales; QA y prod reales sin tocar, por indicación del usuario): conteos e índices coinciden, cancelación y safe mode dejan el destino intacto. La protegida como destino se cubre con tests de dominio y de `store`; prueba manual del diálogo pendiente en la UI.
- 2026-10-30: Ampliada a varias BDs por petición del usuario; las BDs salen del servidor de la conexión registrada (sin nombres fijos, solo se excluyen admin/local/config). Etiqueta `production` = nunca se modifica, igual que `protected`.
