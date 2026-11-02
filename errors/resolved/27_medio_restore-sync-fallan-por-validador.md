# 27. Restore sync fallan por validador

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/backup/writer.rs (creación de la colección provisional), src-tauri/src/backup/staging.rs, src-tauri/src/sync/copy.rs
- **Estado:** resuelto — `BatchWriter::flush` inserta con `bypassDocumentValidation: true` (y `ordered: false`), usado por restore y sync; la colección conserva su validador. Cubierto por `live_sync_copies_documents_older_than_the_validator`.

## Problema
La colección provisional se crea con el validador antes de insertar, y los inserts no usan `bypassDocumentValidation`. Solo se tolera el error 11000.

## Escenario de fallo
Colección `moderate` con documentos antiguos que no cumplen el esquema: al restaurar o sincronizar, esos inserts fallan y el trabajo entero aborta. No se pierden datos (staging), pero no se puede copiar.

## Recomendación
Insertar con `bypassDocumentValidation: true`, o crear la colección sin validador y aplicarlo con `collMod` antes del renombre final.
