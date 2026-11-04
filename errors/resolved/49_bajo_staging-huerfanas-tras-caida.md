# 49. Colecciones provisionales huérfanas si la app se cae a mitad

- **Severidad:** BAJO
- **Dónde:** src-tauri/src/backup/staging.rs, src-tauri/src/sync/catalog.rs (`syncable_collections`), backup `read_catalog`, src/features/explorer/application/explorerService.ts (`copyCollection`, provisional `sharkdb-copy-<id>`)
- **Estado:** resuelto — parte 1: los catálogos ya no ofrecen las provisionales; parte 2: al conectar se ofrece borrar las abandonadas (detalle abajo).

## Problema
Si la app se cierra o se cae durante un sync o restore, `x.sharkdb-staging-<run>` queda en el destino medio llena. No hay limpieza al arrancar y no es `system.*`, así que los catálogos la ofrecen como colección normal.

Lo mismo pasa con "Copiar colección" cuando reemplaza un destino: construye la copia en `sharkdb-copy-<id>` de la BD destino y, si la app se corta a mitad, queda ahí; no lleva el marcador `sharkdb-staging`, así que tampoco la filtraba nada.

## Escenario de fallo
Más adelante, un sync o backup "completa" desde ese entorno copia o respalda la provisional como si fueran datos reales; además ocupa espacio sin que nadie la identifique como residuo.

## Recomendación
Filtrar el marcador `sharkdb-staging` en los catálogos y ofrecer (o hacer) limpieza de provisionales huérfanas al conectar.

## Parte 1 — no ofrecerlas (hecha)
- Los catálogos (`syncable_collections` y `read_catalog`) filtran con `is_offered_collection` (`jobs::selection`), que excluye las de sistema y las provisionales (`is_staging_collection`, `backup::staging`).
- Tests: `jobs::selection` (`system_and_staging_collections_are_not_offered`) y `backup::staging`.
- `is_staging_collection` reconoce también la provisional de la copia (`sharkdb-copy-<id>`).

## Parte 2 — ofrecer borrarlas al conectar (hecha)
Problema de fondo: no se puede saber con certeza si una provisional es huérfana o de un trabajo en marcha en otra ventana o instancia. Por eso se ofrece (el usuario confirma) y solo se ofrecen las antiguas.

Diseño:
- **Antigüedad por el id.** El `<run>` de sync/restore es un `ObjectId`, que lleva la fecha de creación. El de la copia era un UUID: pasa a ser un id con la hora delante (24 hex, como un `ObjectId`). Solo cuentan como abandonadas las de más de 6 h (más de lo que dura un trabajo); una sin fecha (UUID de una versión anterior) cuenta como abandonada.
- **Backend** (`backup::leftovers`):
  - `find_leftovers(sid)`: recorre las BDs de usuario autorizadas y devuelve las provisionales abandonadas (`{ db, collection }`). Una BD que no se puede listar se salta.
  - `drop_leftovers(sid, leftovers)`: comprueba primero que todos los nombres son provisionales (el frontend no puede usarlo para borrar otra cosa); rechaza conexiones protegidas o de producción y respeta el safe mode.
- **Frontend:** al abrir una conexión que no está en safe mode (las protegidas y de producción se abren en safe mode), se buscan una vez por conexión y sesión de la app; si hay, una ventana de confirmación las lista ("Borrar" / "Ahora no"). Al borrarlas se refresca el árbol y se avisa.
- Si se borra una provisional que sí estaba en uso, ese trabajo falla y su destino queda como estaba (las provisionales se renombran solo al final), así que el error es recuperable.

Implementación:
- Backend: `backup::leftovers` (`find`, `drop_all`, `is_abandoned`, umbral `ABANDONED_AFTER` = 6 h), `backup::staging` (`staging_started`, `COPY_PREFIX`), comandos `find_leftovers` y `drop_leftovers` en `backup::commands`.
- Frontend: `copyRunId` (`explorer/domain/copySpec.ts`) da a la copia un id con la hora delante; `sync/domain/leftovers.ts` (`leftoversRequest`), `SyncGateway.findLeftovers`/`dropLeftovers` y el hook `sync/ui/useLeftoverCleanup.ts`, que usa `Workspace`.
- Tests: `backup::leftovers` (`only_old_staging_collections_are_abandoned`, `a_copy_without_a_date_is_abandoned` y, contra un mongod local, `live_finds_and_drops_only_abandoned_staging`), `backup::staging` (`copy_staging_is_a_staging_collection_too`, `a_staging_collection_started_when_its_run_was_made`), `copySpec.test.ts` (`names a copy's run with its start time first, like an ObjectId`) y `sync/domain/leftovers.test.ts`.
