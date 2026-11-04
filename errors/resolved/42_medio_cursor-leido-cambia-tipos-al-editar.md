# 42. Cursor leído en parte por el script cambia tipos al editar

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/cursor.js (`_take`), src-tauri/src/shell/prelude/cursor_result.rs, src-tauri/src/shell/convert/to_js.rs, src-tauri/src/shell/convert/to_bson.rs (`number`)
- **Estado:** resuelto — el puente guarda en BSON el último lote que leyó el script de cada cursor (`MongoNatives::script_batches`); `Cursor._take` dice de qué cursor salió el buffer (`bufferFrom`, que sigue valiendo cuando `_id` pasa a null) y `cursor_result.rs` toma de ese lote los documentos que quedaban (`MongoBridge::buffered`), sin pasarlos por JS. `next()` no cambia de coste. El lote se suelta al cerrar el cursor o al acabar la ejecución; sin lote guardado (puente falso) se convierte desde JS como antes. Test: `tests/live.rs` (`live_cursor_read_by_the_script_keeps_bson_types`: Double, Symbol y Undefined; cursor agotado, tras `next()` y cola del segundo lote más lo leído del servidor).
- **Relacionado:** 21 (tipos que no sobreviven a la edición)

## Problema
Con un `find()` normal el primer lote llega en BSON desde Rust y está bien. Pero si el script ya empezó a leer el cursor, los documentos de `_buffer` hacen BSON → JS → BSON: un Double entero (`5.0`) pasa a Int32, Symbol a String y Undefined a Null. El resultado sigue marcado `editable`.

## Escenario de fallo
`var c = db.x.find(); c.hasNext(); c` con `{_id:1, precio: 5.0}`. La vista muestra `precio: 5` (Int32). Al guardar, la comparación con lo leído no coincide y aparece "otro proceso modificó el documento" en cada intento; el usuario pulsa "Sobrescribir" y todos los Double enteros del documento quedan como Int32 (un validador `bsonType: 'double'` lo rechazaría).

## Recomendación
Conservar los BSON originales del buffer en el lado nativo, o marcar `editable: false` cuando haya documentos que pasaron por JS.
