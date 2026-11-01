// Escrituras: los comandos insert/update/delete partidos en lotes que el servidor acepta
// (`maxWriteBatchSize` operaciones y 16 MB por comando), con las respuestas sumadas y los errores
// con su índice global, y el resultado que el frontend muestra como escritura.
(function (native, lib) {
  'use strict';

  const { num, failWith } = lib;

  // Límites del servidor por comando de escritura (iguales desde MongoDB 3.6).
  const MAX_WRITE_BATCH_SIZE = 100000;
  const MAX_BSON_OBJECT_SIZE = 16 * 1024 * 1024;
  // Lo que ocupan en el comando, además de las operaciones, su nombre y opciones.
  const COMMAND_ENVELOPE_BYTES = 16 * 1024;
  // Lo que suma cada operación al array del comando: tipo, índice como clave y su terminador.
  const ITEM_OVERHEAD_BYTES = 16;
  const MAX_BATCH_BYTES = MAX_BSON_OBJECT_SIZE - COMMAND_ENVELOPE_BYTES;

  // Código de una escritura que el validador de la colección ($jsonSchema) rechazó.
  const DOCUMENT_VALIDATION_FAILURE = 121;

  // Campo del comando que lleva las operaciones de cada tipo.
  const OPERATIONS_FIELD = { insert: 'documents', update: 'updates', delete: 'deletes' };

  // Resultado de una escritura: el frontend lo muestra distinto de un documento cualquiera.
  class WriteResult {
    constructor(fields) {
      Object.assign(this, fields);
    }
  }

  // Tramos [inicio, fin) de `items` que caben cada uno en un comando. Una operación que sola ya
  // supera el límite va en su propio tramo y el servidor la rechaza con su error.
  function batchRanges(items) {
    const ranges = [];
    let start = 0;
    let bytes = 0;
    items.forEach((item, i) => {
      const size = Object.bsonsize(item) + ITEM_OVERHEAD_BYTES;
      const full = i - start === MAX_WRITE_BATCH_SIZE || (i > start && bytes + size > MAX_BATCH_BYTES);
      if (full) {
        ranges.push([start, i]);
        start = i;
        bytes = 0;
      }
      bytes += size;
    });
    if (start < items.length) ranges.push([start, items.length]);
    return ranges;
  }

  const emptySummary = () => ({
    counts: { insert: 0, update: 0, delete: 0 },
    nModified: 0,
    upserted: [],
    writeErrors: [],
    writeConcernErrors: [],
  });

  // Ejecuta las operaciones `items` de un tipo (insert, update o delete) sobre la colección y
  // acumula las respuestas en `into`. `origin[i]` es el índice global de la operación i, para
  // los errores y los upserts. Ordenado, para en el primer lote con errores.
  function runWrites(run, type, collection, items, { ordered = true, origin = null, into = emptySummary() } = {}) {
    for (const [start, end] of batchRanges(items)) {
      const reply = run({ [type]: collection, [OPERATIONS_FIELD[type]]: items.slice(start, end), ordered });
      const at = (index) => (origin ? origin[start + num(index)] : start + num(index));
      const errors = reply.writeErrors ?? [];
      into.counts[type] += num(reply.n ?? 0);
      into.nModified += num(reply.nModified ?? 0);
      for (const { index, _id } of reply.upserted ?? []) into.upserted.push({ index: at(index), _id });
      for (const { index, code, errmsg } of errors) {
        into.writeErrors.push({ index: at(index), code: num(code), errmsg });
      }
      if (reply.writeConcernError) into.writeConcernErrors.push(reply.writeConcernError);
      if (ordered && errors.length) break;
    }
    return into;
  }

  const applied = ({ counts }) => counts.insert + counts.update + counts.delete;

  // Lanza el primer error de escritura. Con varias operaciones dice cuál falló y cuánto se aplicó.
  function failOnWriteErrors(summary, operations) {
    const [first] = summary.writeErrors;
    if (first) {
      const many = operations > 1;
      const where = many ? `operación ${first.index}` : '';
      const message =
        first.code === DOCUMENT_VALIDATION_FAILURE
          ? `${first.errmsg}: el documento no cumple la validación de la colección${many ? ` (${where})` : ''}`
          : `${first.errmsg} (código ${first.code}${many ? `, ${where}` : ''})`;
      const total = many ? `; ${summary.writeErrors.length} con error, ${applied(summary)} aplicadas` : '';
      failWith(many ? 'BulkWriteError' : 'WriteError', message + total);
    }
    const [concern] = summary.writeConcernErrors;
    if (concern) failWith('WriteConcernError', concern.errmsg);
    return summary;
  }

  function updateResult(summary) {
    return new WriteResult({
      acknowledged: true,
      matchedCount: summary.counts.update - summary.upserted.length,
      modifiedCount: summary.nModified,
      upsertedCount: summary.upserted.length,
      upsertedId: summary.upserted.length ? summary.upserted[0]._id : null,
    });
  }

  Object.assign(lib, { WriteResult, emptySummary, runWrites, failOnWriteErrors, updateResult });
});
