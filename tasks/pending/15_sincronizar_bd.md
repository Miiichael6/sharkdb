# 15 · Sincronizar entre entornos

**Estado:** ⬜ Pendiente
**Fase:** 9 Operaciones de BD · **Depende de:** 09, 14 · **Doc:** R30 · D7

## Objetivo
Restaurar una base de datos completa o colecciones sueltas de un entorno a otro (p. ej. prod → QA), reemplazando el contenido del destino, sin poder nunca modificar una conexión protegida y dejando siempre claro qué se va a modificar.

## Pasos

### Paso 1: Plan de sincronización
- [ ] `src/features/sync/domain/syncPlan.ts`: dado origen (conexión, BD, colecciones elegidas o todas) y destino, valida (destino ≠ origen, destino no protegido ni con safe mode activo) y calcula el plan por colección: crear / reemplazar (con conteo actual → conteo nuevo) e índices a recrear + tests (R30, D7)
- [ ] Comando Rust `describe_database(sid, db)` (colecciones, conteos, índices, opciones) para construir el plan; la aplicación reutiliza el restore de 14 desde un stream origen→destino (sin pasar por disco). El backend vuelve a comprobar que el destino no está protegido (R30)

### Paso 2: UI
- [ ] `src/features/sync/ui/SyncDialog.tsx`: selector de origen y destino con su píldora de entorno (color de la etiqueta, como en 11), modo "BD completa" o "colecciones" con casillas; las conexiones protegidas no aparecen como destino. Antes de aplicar, resumen destacado "Se va a MODIFICAR: <entorno> · <conexión> : <BD>" con la lista de colecciones que se reemplazan, y confirmación escribiendo el nombre de la BD destino (R30, D7)
- [ ] Progreso por colección, cancelación y resultado en el centro de notificaciones (13); entradas en la barra (11), acciones rápidas (12) y menú de BD/colección del árbol (R30)

### Paso 3: Verificación
- [ ] Prueba real: restaurar una colección y luego una BD completa de una conexión "prod" a una "QA"; los conteos e índices del destino coinciden con el origen; la conexión protegida no se puede elegir como destino (ni forzando la llamada al backend)
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(sync): restaurar BD y colecciones entre entornos`
- **Cierre de Fase 9**

## Criterios de aceptación
- [ ] Una conexión protegida nunca se modifica: ni la UI la ofrece como destino ni el backend lo permite
- [ ] Antes de aplicar se ve sin ambigüedad qué entorno/BD se va a modificar y qué colecciones se reemplazan
- [ ] Tras sincronizar, el destino tiene los mismos documentos e índices que el origen en lo elegido

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
