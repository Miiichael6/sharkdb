# 53. Partir el script en sentencias deja ejecuciones a medias

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/shell/statements.rs, src-tauri/src/shell/statement_run.rs
- **Estado:** pendiente

## Problema
oxc_parser no detecta redeclaraciones de `let`/`const` (es análisis semántico), así que el script se ejecuta sentencia a sentencia y falla a mitad. Evaluado entero, QuickJS lo rechazaría antes de ejecutar nada. Lo mismo ocurre al volver a ejecutar un script con `let`/`const` (las globales léxicas persisten entre ejecuciones).

## Escenario de fallo
`const f = {...}; db.c.updateMany(f, ...); const f = {...}; db.c.deleteMany(f)` ejecuta el `updateMany` y luego falla: queda una escritura a medias que el usuario no esperaba.

## Recomendación
Compilar el script completo (solo compilar) o pasar oxc_semantic antes de ejecutar, y abortar si hay errores tempranos.
