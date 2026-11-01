// Escrituras masivas del shell clásico: `initializeOrderedBulkOp()`/`initializeUnorderedBulkOp()`
// (con su `BulkWriteResult`) y `bulkWrite([...])`. Las operaciones se agrupan por tipo y cada
// grupo va a writes.js, que lo parte en lotes.
(function (native, lib) {
  'use strict';

  const { compact, failWith, withId, WriteResult, emptySummary, runWrites, failOnWriteErrors } = lib;

  // Orden en el que el shell clásico ejecuta los grupos de un bulk no ordenado.
  const UNORDERED_TYPES = ['insert', 'update', 'delete'];

  const updateStatement = (filter, update, { upsert = false, multi = false, ...rest } = {}) =>
    compact({ q: filter, u: update, upsert, multi, ...rest });

  const deleteStatement = (filter, justOne, rest = {}) =>
    compact({ q: filter, limit: justOne ? 1 : 0, ...rest });

  // Grupos { type, items, origin } que se mandan juntos. Ordenado: cada racha de operaciones
  // del mismo tipo, en su orden. No ordenado: un grupo por tipo.
  function groupsOf(operations, ordered) {
    const groups = [];
    operations.forEach(({ type, item }, index) => {
      const group = ordered
        ? groups.at(-1)?.type === type ? groups.at(-1) : null
        : groups.find((g) => g.type === type);
      if (group) {
        group.items.push(item);
        group.origin.push(index);
      } else {
        groups.push({ type, items: [item], origin: [index] });
      }
    });
    if (!ordered) groups.sort((a, b) => UNORDERED_TYPES.indexOf(a.type) - UNORDERED_TYPES.indexOf(b.type));
    return groups;
  }

  // Ejecuta las operaciones sobre la colección y devuelve el resumen; lanza si alguna falló.
  function executeWrites(collection, operations, ordered) {
    const run = (command) => collection._run(command);
    const summary = emptySummary();
    for (const { type, items, origin } of groupsOf(operations, ordered)) {
      runWrites(run, type, collection.getName(), items, { ordered, origin, into: summary });
      if (ordered && summary.writeErrors.length) break;
    }
    return failOnWriteErrors(summary, operations.length);
  }

  // Resultado de `bulk.execute()`, con los contadores del shell clásico.
  class BulkWriteResult extends WriteResult {
    toString() { return `BulkWriteResult(${tojson({ ...this })})`; }
    tojson() { return this.toString(); }
  }

  function bulkWriteResult(summary) {
    return new BulkWriteResult({
      writeErrors: summary.writeErrors,
      writeConcernErrors: summary.writeConcernErrors,
      nInserted: summary.counts.insert,
      nUpserted: summary.upserted.length,
      nMatched: summary.counts.update - summary.upserted.length,
      nModified: summary.nModified,
      nRemoved: summary.counts.delete,
      upserted: summary.upserted,
    });
  }

  // `bulk.find(filtro)`: lo que viene detrás (`upsert()`, `collation()`...) afecta a la
  // operación que cierra la cadena (`updateOne()`, `remove()`...), que vuelve al bulk.
  class BulkFind {
    constructor(bulk, filter) {
      this._bulk = bulk;
      this._filter = filter;
      this._upsert = false;
      this._extra = {};
    }

    upsert() {
      this._upsert = true;
      return this;
    }

    collation(spec) { return this._with('collation', spec); }
    arrayFilters(filters) { return this._with('arrayFilters', filters); }
    hint(index) { return this._with('hint', index); }

    _with(name, value) {
      this._extra[name] = value;
      return this;
    }

    _update(update, multi) {
      const options = { upsert: this._upsert, multi, ...this._extra };
      return this._bulk._add('update', updateStatement(this._filter, update, options));
    }

    update(update) { return this._update(update, true); }
    updateOne(update) { return this._update(update, false); }
    replaceOne(doc) { return this._update(doc, false); }

    _delete(justOne) {
      const { collation, hint } = this._extra;
      return this._bulk._add('delete', deleteStatement(this._filter, justOne, { collation, hint }));
    }

    remove() { return this._delete(false); }
    removeOne() { return this._delete(true); }
    delete() { return this.remove(); }
    deleteOne() { return this.removeOne(); }
  }

  class Bulk {
    constructor(collection, ordered) {
      this._collection = collection;
      this._ordered = ordered;
      this._operations = [];
      this._executed = false;
    }

    _add(type, item) {
      if (this._executed) failWith('Error', 'Este bulk ya se ejecutó; crea otro para más operaciones');
      this._operations.push({ type, item });
      return this;
    }

    insert(doc) { return this._add('insert', withId(doc)); }
    find(filter) { return new BulkFind(this, filter); }

    execute() {
      if (this._executed) failWith('Error', 'execute: este bulk ya se ejecutó');
      if (!this._operations.length) failWith('Error', 'execute: el bulk no tiene operaciones');
      this._executed = true;
      return bulkWriteResult(executeWrites(this._collection, this._operations, this._ordered));
    }

    toString() { return `Bulk(${this._collection.getFullName()}, ${this._operations.length} operaciones)`; }
    tojson() { return this.toString(); }
  }

  // Una operación de `bulkWrite` ({ insertOne: {...} }, { updateMany: {...} }...) → { type, item }.
  const BULK_WRITE_OPERATIONS = {
    insertOne: ({ document }) => ({ type: 'insert', item: withId(document) }),
    updateOne: ({ filter, update, ...options }) => ({ type: 'update', item: updateStatement(filter, update, { ...options, multi: false }) }),
    updateMany: ({ filter, update, ...options }) => ({ type: 'update', item: updateStatement(filter, update, { ...options, multi: true }) }),
    replaceOne: ({ filter, replacement, ...options }) => ({ type: 'update', item: updateStatement(filter, replacement, { ...options, multi: false }) }),
    deleteOne: ({ filter, ...options }) => ({ type: 'delete', item: deleteStatement(filter, true, options) }),
    deleteMany: ({ filter, ...options }) => ({ type: 'delete', item: deleteStatement(filter, false, options) }),
  };

  function bulkOperation(operation, index) {
    const [name, ...extra] = Object.keys(operation ?? {});
    const build = BULK_WRITE_OPERATIONS[name];
    if (!build || extra.length) {
      failWith('Error', `bulkWrite: operación ${index} no válida; se esperaba una de ${Object.keys(BULK_WRITE_OPERATIONS).join(', ')}`);
    }
    return build(operation[name]);
  }

  // Ids por índice de operación, como `insertedIds`/`upsertedIds` de `bulkWrite` en el shell 4.2.
  const idsByIndex = (entries) => Object.fromEntries(entries.map(({ index, _id }) => [index, _id]));

  function bulkWrite(collection, operations, { ordered = true } = {}) {
    if (!Array.isArray(operations) || !operations.length) failWith('Error', 'bulkWrite: se esperaba un array de operaciones');
    const planned = operations.map(bulkOperation);
    const summary = executeWrites(collection, planned, ordered);
    const inserted = planned.flatMap(({ type, item }, index) => (type === 'insert' ? [{ index, _id: item._id }] : []));
    return new WriteResult({
      acknowledged: true,
      deletedCount: summary.counts.delete,
      insertedCount: summary.counts.insert,
      matchedCount: summary.counts.update - summary.upserted.length,
      modifiedCount: summary.nModified,
      upsertedCount: summary.upserted.length,
      insertedIds: idsByIndex(inserted),
      upsertedIds: idsByIndex(summary.upserted),
    });
  }

  Object.assign(lib, { Bulk, bulkWrite, updateStatement, deleteStatement });
});
