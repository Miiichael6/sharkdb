# 49. Colecciones provisionales huérfanas si la app se cae a mitad

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/backup/staging.rs, src-tauri/src/sync/catalog.rs (`syncable_collections`), backup `read_catalog`
- **Estado:** pendiente

## Problema
Si la app se cierra o se cae durante un sync o restore, `x.sharkdb-staging-<run>` queda en el destino medio llena. No hay limpieza al arrancar y no es `system.*`, así que los catálogos la ofrecen como colección normal.

## Escenario de fallo
Más adelante, un sync o backup "completa" desde ese entorno copia o respalda la provisional como si fueran datos reales; además ocupa espacio sin que nadie la identifique como residuo.

## Recomendación
Filtrar el marcador `sharkdb-staging` en los catálogos y ofrecer (o hacer) limpieza de provisionales huérfanas al conectar.
