// Servidor falso para los tests del prelude: guarda cada llamada en `__calls` y sirve
// colecciones de `n` documentos `{ _id: i }`, donde `n` es la opción `limit` o
// FAKE_COLLECTION_SIZE si no la hay. No tiene sharding: `config.collections` está vacía.
(() => {
  const FAKE_COLLECTION_SIZE = 120;
  const calls = [];
  const cursors = new Map();
  let lastId = 0;
  globalThis.__calls = calls;

  const open = (documents) => {
    cursors.set(++lastId, documents);
    return lastId;
  };

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
      return { ok: 1, n: NumberInt(1) };
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
