// Lo que une el prelude con cada ejecución: `show`, `use`, el global `it` y el global oculto
// `__shell` con los ganchos que usa prelude/mod.rs (beginRun, use, show, describe).
(function (native, lib) {
  'use strict';

  const { num, failWith, Cursor, ExplainQuery, WriteResult, DB, Collection } = lib;

  const BYTES_PER_GB = 1024 ** 3;
  const DB_NAME_WIDTH = 20;

  function showDatabases() {
    const { databases } = db.adminCommand({ listDatabases: 1, authorizedDatabases: true });
    for (const { name, sizeOnDisk } of databases) {
      print(`${name.padEnd(DB_NAME_WIDTH)}${(num(sizeOnDisk) / BYTES_PER_GB).toFixed(3)}GB`);
    }
  }

  function showCollections() {
    db.getCollectionNames().forEach((name) => print(name));
  }

  const SHOW = {
    dbs: showDatabases,
    databases: showDatabases,
    collections: showCollections,
    tables: showCollections,
    users: () => db.getUsers().forEach((user) => printjson(user)),
  };

  // Último cursor mostrado como resultado que aún tiene documentos: lo que sigue `it`.
  let lastCursor = null;

  // `it`: el último cursor mostrado, que al mostrarse da su siguiente lote, como en el shell
  // clásico. Asignarle un valor lo convierte en una variable normal.
  function nextOfLastCursor() {
    if (!lastCursor || lastCursor.isExhausted()) {
      failWith('Error', 'it: no hay un cursor anterior con más documentos');
    }
    return lastCursor;
  }

  Object.defineProperty(globalThis, 'it', {
    configurable: true,
    get: nextOfLastCursor,
    set(value) {
      Object.defineProperty(globalThis, 'it', { value, writable: true, configurable: true });
    },
  });

  function describeCursor(cursor, firstBatchSize) {
    const described = cursor._take(firstBatchSize);
    lastCursor = described.exhausted ? null : cursor;
    return described;
  }

  const shell = {
    beginRun(name) {
      globalThis.db = new DB(name);
    },
    use(name) {
      globalThis.db = new DB(name);
      print(`switched to db ${name}`);
    },
    show(what) {
      const show = SHOW[what];
      if (!show) failWith('Error', `show: opción desconocida "${what}"`);
      show();
    },
    // Traduce el valor final del script a lo que espera prelude/mod.rs.
    describe(value, firstBatchSize) {
      if (value === undefined) return undefined;
      if (value instanceof ExplainQuery) return { kind: 'value', value: value.finish() };
      if (value instanceof Cursor) return describeCursor(value, firstBatchSize);
      if (value instanceof WriteResult) return { kind: 'write', value };
      if (value instanceof DB || value instanceof Collection) return { kind: 'value', value: value.toString() };
      return { kind: 'value', value };
    },
  };
  Object.defineProperty(globalThis, '__shell', { value: shell });
});
