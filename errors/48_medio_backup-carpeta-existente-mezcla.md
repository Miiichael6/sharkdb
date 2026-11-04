# 48. Backup manual en carpeta existente mezcla ejecuciones

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/backup/dump.rs (`dump_databases`, `dump_collection`), src/features/backup/domain/backupSpec.ts (aviso "sus archivos se sobrescriben")
- **Estado:** pendiente

## Problema
- Solo se sobrescriben los archivos de las colecciones elegidas; los de colecciones de un backup anterior en `<dir>/<bd>` se quedan, y un restore "completa" las trae de vuelta aunque sean de otra fecha o ya no existan.
- `.metadata.json` se escribe de forma no atómica y antes de leer los datos: si el volcado falla o se cancela, queda el metadata nuevo junto al `.bson` viejo.

## Escenario de fallo
Al restaurar se aplican índices o validador nuevos sobre datos viejos (fallos de índices únicos, o una mezcla inconsistente), o reaparecen colecciones antiguas.

## Recomendación
Volcar cada BD a `<bd>.partial/` y reemplazarla entera al terminar (o vaciar `<dir>/<bd>` antes de empezar). Escribir el metadata como `.partial` y renombrarlo después del `.bson`.
