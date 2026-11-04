# 58. Backup/sync de "BD completa" omite time series y vistas sin avisar

- **Severidad:** MEDIO
- **Tipo:** implícito (el usuario cree que guarda la BD entera)
- **Dónde:** src-tauri/src/sync/catalog.rs (`syncable_collections`: solo `CollectionType::Collection`), src-tauri/src/backup/source.rs (`read_metadata` rechaza lo que no es `collection`), src/features/backup/domain/backupSpec.ts (`currentDatabases`: una BD `complete` se resuelve con las colecciones del catálogo y nunca reporta `missing`)
- **Estado:** pendiente
- **Relacionado:** #47 (resuelto: "completa" = lo que existe ahora; no cubrió los tipos que el catálogo excluye), #36

## Problema
El catálogo filtra las vistas y las colecciones time series. Una BD marcada como completa se resuelve en cada ejecución con `collections: [...found.collections]`, así que esas colecciones quedan fuera sin ninguna nota: ni el formulario ni `missingNote` lo mencionan (el comentario de `syncable_collections` lo reconoce, pero el usuario no lo ve).

## Escenario de fallo
La BD `iot` tiene `devices` (normal), `readings` (time series) y la vista `daily`. Una programación diaria de "BD completa" guarda solo `devices`; todas las ejecuciones salen correctas y la retención conserva 7 copias. Tras un incidente, restaurar `iot` no recupera `readings` ni `daily`, sin ningún aviso. Con sync, el destino nunca recibe esas colecciones.

## Recomendación
Al elegir "BD completa" y en cada ejecución, listar las time series y vistas omitidas (como `missing` o un aviso equivalente). Mejor: guardarlas (vistas como metadata con `viewOn` + `pipeline`; time series con sus `options`).
