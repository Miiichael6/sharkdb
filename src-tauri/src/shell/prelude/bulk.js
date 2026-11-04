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

  // El filtro y `limit` van después de las opciones: un `limit` o `q` en ellas no los cambia.
  const deleteStatement = (filter, justOne, rest = {}) =>
    compact({ ...rest, q: filter, limit: justOne ? 1 : 0 });

  const keysOf = (value) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : null);

  // Como mongosh: un update usa operadores `$` o es un pipeline, y un reemplazo no los usa. Sin
  // esto, `updateOne(q, { status: 'x' })` reemplazaría el documento entero por `{ status: 'x' }`.
  function checkUpdate(name, update) {
    const keys = keysOf(update);
    if (!Array.isArray(update) && !(keys?.length && keys.every((k) => k.startsWith('$')))) {
      failWith('Error', `${name}: el update debe usar operadores $ (p. ej. { $set: {...} }) o ser un pipeline; para reemplazar el documento entero usa replaceOne`);
    }
    return update;
  }

  function checkReplacement(name, doc) {
    const keys = keysOf(doc);
    if (!keys || keys.some((k) => k.startsWith('$'))) {
      failWith('Error', `${name}: el documento de reemplazo no puede usar operadores $; para modificar campos usa updateOne`);
    }
    return doc;
  }

  // Ruta del primer `undefined` dentro de `value`, o null. Los valores BSON (`_bsontype`), las
  // fechas y las regex no se recorren.
  function undefinedPath(value, path = '', depth = 0) {
    if (value === undefined) return path;
    if (value === null || typeof value !== 'object' || depth > 100) return null;
    if (value._bsontype || value instanceof Date || value instanceof RegExp) return null;
    for (const [key, child] of Object.entries(value)) {
      const found = undefinedPath(child, path ? `${path}.${key}` : key, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  // Un `undefined` en el filtro de una escritura llegaría como null, y `{ f: null }` también
  // coincide con los documentos sin `f`: `deleteMany({ tenant: varMalEscrita })` los borraría.
  function checkDefined(name, filter) {
    const path = filter === undefined ? null : undefinedPath(filter);
    if (path !== null) {
      failWith('Error', `${name}: el filtro tiene un valor undefined en «${path}»; en MongoDB equivale a null y coincide también con los documentos sin ese campo (si es lo que quieres, usa null)`);
    }
    return filter;
  }

  // Como mongosh: borrar sin filtro es un error; para vaciar la colección hay que pedirlo con `{}`.
  // `hint` dice qué hace el filtro vacío en esa operación.
  function checkFilter(name, filter, hint = `para borrar todos los documentos pásalo vacío: ${name}({})`) {
    if (filter === undefined || filter === null) {
      failWith('Error', `${name}: falta el filtro; ${hint}`);
    }
    return checkDefined(name, filter);
  }

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

    _update(name, update, multi) {
      const options = { upsert: this._upsert, multi, ...this._extra };
      return this._bulk._add('update', updateStatement(checkDefined(name, this._filter), update, options));
    }

    update(update) { return this._update('update', checkUpdate('update', update), true); }
    updateOne(update) { return this._update('updateOne', checkUpdate('updateOne', update), false); }
    replaceOne(doc) { return this._update('replaceOne', checkReplacement('replaceOne', doc), false); }

    _delete(name, justOne) {
      const { collation, hint } = this._extra;
      return this._bulk._add('delete', deleteStatement(checkFilter(name, this._filter), justOne, { collation, hint }));
    }

    remove() { return this._delete('remove', false); }
    removeOne() { return this._delete('removeOne', true); }
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

    insert(doc) { return this._add('insert', withId(doc, 'Bulk insert')); }
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
    insertOne: ({ document }) => ({ type: 'insert', item: withId(document, 'bulkWrite insertOne') }),
    updateOne: ({ filter, update, ...options }) => ({ type: 'update', item: updateStatement(checkDefined('bulkWrite updateOne', filter), checkUpdate('bulkWrite updateOne', update), { ...options, multi: false }) }),
    updateMany: ({ filter, update, ...options }) => ({ type: 'update', item: updateStatement(checkDefined('bulkWrite updateMany', filter), checkUpdate('bulkWrite updateMany', update), { ...options, multi: true }) }),
    replaceOne: ({ filter, replacement, ...options }) => ({ type: 'update', item: updateStatement(checkDefined('bulkWrite replaceOne', filter), checkReplacement('bulkWrite replaceOne', replacement), { ...options, multi: false }) }),
    deleteOne: ({ filter, ...options }) => ({ type: 'delete', item: deleteStatement(checkFilter('bulkWrite deleteOne', filter), true, options) }),
    deleteMany: ({ filter, ...options }) => ({ type: 'delete', item: deleteStatement(checkFilter('bulkWrite deleteMany', filter), false, options) }),
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

  Object.assign(lib, { Bulk, bulkWrite, updateStatement, deleteStatement, checkUpdate, checkReplacement, checkFilter, checkDefined });
});
