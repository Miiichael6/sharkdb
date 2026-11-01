// Servidor falso para los tests del prelude: guarda cada llamada en `__calls` y sirve
// colecciones de `n` documentos `{ _id: i }`, donde `n` es la opción `limit` o
// FAKE_COLLECTION_SIZE si no la hay. No tiene sharding: `config.collections` está vacía.
// Las escrituras responden como el servidor: una operación con `fail` (en el documento o en
// el filtro) da un error de clave duplicada en su índice (ordenado, el resto del lote no se
// aplica) y un update con `upsert` inserta en vez de modificar.
(() => {
  const FAKE_COLLECTION_SIZE = 120;
  const DUPLICATE_KEY = 11000;
  const OPERATIONS = { insert: 'documents', update: 'updates', delete: 'deletes' };
  const calls = [];
  const cursors = new Map();
  let lastId = 0;
  globalThis.__calls = calls;

  const open = (documents) => {
    cursors.set(++lastId, documents);
    return lastId;
  };

  const fails = (type, op) => 'fail' in (type === 'insert' ? op : op.q);

  function writeReply(type, command) {
    const writeErrors = [];
    const applied = [];
    for (const [index, op] of command[OPERATIONS[type]].entries()) {
      if (!fails(type, op)) {
        applied.push({ index, op });
        continue;
      }
      writeErrors.push({ index, code: DUPLICATE_KEY, errmsg: 'E11000 duplicate key error' });
      if (command.ordered !== false) break;
    }
    const upserted = applied.filter(({ op }) => op.upsert).map(({ index }) => ({ index, _id: index }));
    const reply = { ok: 1, n: NumberInt(applied.length) };
    if (type === 'update') {
      reply.nModified = NumberInt(applied.length - upserted.length);
      if (upserted.length) reply.upserted = upserted;
    }
    if (writeErrors.length) reply.writeErrors = writeErrors;
    return reply;
  }

  return {
    find(db, coll, filter, options) {
      calls.push({ op: 'find', db, coll, filter, options });
      const n = db === 'config' && coll === 'collections' ? 0 : options.limit ?? FAKE_COLLECTION_SIZE;
      return open(Array.from({ length: n }, (_, i) => ({ _id: i })));
    },
    aggregate(db, coll, pipeline, options) {
      calls.push({ op: 'aggregate', db, coll, pipeline, options });
      return open([{ _id: 1, n: 3 }]);
    },
    runCommand(db, command) {
      calls.push({ op: 'runCommand', db, command });
      const [name] = Object.keys(command);
      return name in OPERATIONS ? writeReply(name, command) : { ok: 1, n: NumberInt(1) };
    },
    cursorNext(id, size) {
      const rest = cursors.get(id);
      const documents = rest.splice(0, size);
      const exhausted = rest.length === 0;
      if (exhausted) cursors.delete(id);
      return { documents, exhausted };
    },
    cursorClose(id) {
      calls.push({ op: 'close', id });
      cursors.delete(id);
    },
  };
})()
