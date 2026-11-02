// Colección del shell: consultas, escrituras (en lotes, vía writes.js y bulk.js), índices,
// tamaños y `explain()`. Todo lo que no es find/aggregate va al servidor como `runCommand`.
(function (native, lib) {
  'use strict';

  const {
    num, compact, withChildren, failWith, withId, scaleOption,
    Cursor, ExplainQuery, verbosityOf,
    WriteResult, runWrites, failOnWriteErrors, updateResult,
    Bulk, bulkWrite, updateStatement, deleteStatement,
  } = lib;

  const WATCH_UNSUPPORTED =
    'watch: los change streams no se pueden seguir desde un script (bloquearían la pestaña); ' +
    'consulta los cambios recientes con find sobre tus datos o usa otra herramienta para seguirlos';

  const indexName = (keys) => Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_');

  const withIndexNames = (keyPatterns, options) =>
    keyPatterns.map((key) => ({ key, ...options, name: indexName(key) }));

  // Comando find con las opciones del cursor; es lo que se explica en `cursor.explain()`.
  const findCommand = (name, filter) => (options) => ({ find: name, filter, ...options });

  function aggregateCommand(name, pipeline) {
    return ({ batchSize, ...options }) => ({
      aggregate: name,
      pipeline,
      cursor: compact({ batchSize }),
      ...options,
    });
  }

  class Collection {
    constructor(db, name) {
      this._db = db;
      this._name = name;
      return withChildren(this, (sub) => this.getCollection(sub));
    }

    getName() { return this._name; }
    getFullName() { return `${this._db.getName()}.${this._name}`; }
    getDB() { return this._db; }
    getCollection(sub) { return new Collection(this._db, `${this._name}.${sub}`); }
    _run(command) { return this._db.runCommand(command); }

    _query(filter, projection, QueryClass = Cursor, ...extra) {
      const db = this._db.getName();
      const cursor = new QueryClass(this.getFullName(), {
        open: (options) => native.find(db, this._name, filter, options),
        count: (options) => this.count(filter, options),
        command: findCommand(this._name, filter),
        run: (command) => this._run(command),
      }, ...extra);
      return projection ? cursor.projection(projection) : cursor;
    }

    find(filter = {}, projection = undefined) { return this._query(filter, projection); }

    findOne(filter = {}, projection = undefined) {
      const cursor = this.find(filter, projection).limit(1);
      return cursor.hasNext() ? cursor.next() : null;
    }

    aggregate(pipeline = [], options = {}) {
      const stages = Array.isArray(pipeline) ? pipeline : [...arguments];
      const extra = Array.isArray(pipeline) ? options : {};
      const db = this._db.getName();
      return new Cursor(this.getFullName(), {
        open: (cursorOptions) => native.aggregate(db, this._name, stages, { ...extra, ...cursorOptions }),
        count: null,
        command: (cursorOptions) => aggregateCommand(this._name, stages)({ ...extra, ...cursorOptions }),
        run: (command) => this._run(command),
      });
    }

    _write(type, items, ordered = true) {
      const summary = runWrites((command) => this._run(command), type, this._name, items, { ordered });
      return failOnWriteErrors(summary, items.length);
    }

    insertOne(doc) {
      const document = withId(doc);
      this._write('insert', [document]);
      return new WriteResult({ acknowledged: true, insertedId: document._id });
    }

    insertMany(docs, { ordered = true } = {}) {
      const documents = docs.map(withId);
      this._write('insert', documents, ordered);
      return new WriteResult({ acknowledged: true, insertedIds: documents.map((d) => d._id) });
    }

    insert(docOrDocs, { ordered = true } = {}) {
      const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const summary = this._write('insert', docs.map(withId), ordered);
      return new WriteResult({ nInserted: summary.counts.insert });
    }

    _update(filter, update, options) {
      return updateResult(this._write('update', [updateStatement(filter, update, options)]));
    }

    updateOne(filter, update, options = {}) { return this._update(filter, update, { ...options, multi: false }); }
    updateMany(filter, update, options = {}) { return this._update(filter, update, { ...options, multi: true }); }
    replaceOne(filter, doc, options = {}) { return this._update(filter, doc, { ...options, multi: false }); }
    update(filter, update, options = {}) { return this._update(filter, update, options); }

    _delete(filter, justOne) {
      const summary = this._write('delete', [deleteStatement(filter, justOne)]);
      return new WriteResult({ acknowledged: true, deletedCount: summary.counts.delete });
    }

    deleteOne(filter) { return this._delete(filter, true); }
    deleteMany(filter) { return this._delete(filter, false); }
    remove(filter = {}, justOne = false) { return this._delete(filter, justOne); }

    initializeOrderedBulkOp() { return new Bulk(this, true); }
    initializeUnorderedBulkOp() { return new Bulk(this, false); }
    bulkWrite(operations, options = {}) { return bulkWrite(this, operations, options); }

    findAndModify(spec) {
      return this._run({ findAndModify: this._name, ...compact(spec) }).value ?? null;
    }

    findOneAndUpdate(filter, update, options = {}) {
      return this.findAndModify({
        query: filter, update, sort: options.sort, fields: options.projection,
        upsert: options.upsert, new: options.returnNewDocument,
      });
    }

    findOneAndReplace(filter, doc, options = {}) { return this.findOneAndUpdate(filter, doc, options); }

    findOneAndDelete(filter, options = {}) {
      return this.findAndModify({ query: filter, sort: options.sort, fields: options.projection, remove: true });
    }

    count(filter = {}, options = {}) {
      return num(this._run({ count: this._name, query: filter, ...compact(options) }).n);
    }

    estimatedDocumentCount() { return num(this._run({ count: this._name }).n); }

    countDocuments(filter = {}) {
      const [row] = this.aggregate([{ $match: filter }, { $group: { _id: 1, n: { $sum: 1 } } }]).toArray();
      return row ? num(row.n) : 0;
    }

    distinct(key, filter = {}) {
      return this._run({ distinct: this._name, key, query: filter }).values;
    }

    createIndex(keys, options = {}) {
      const name = options.name ?? indexName(keys);
      this._run({ createIndexes: this._name, indexes: [{ key: keys, ...options, name }] });
      return name;
    }

    createIndexes(keyPatterns, options = {}) {
      return this._run({ createIndexes: this._name, indexes: withIndexNames(keyPatterns, options) });
    }

    getIndexes() { return this._run({ listIndexes: this._name }).cursor.firstBatch; }
    getIndexKeys() { return this.getIndexes().map((index) => index.key); }
    dropIndex(name) { return this._run({ dropIndexes: this._name, index: name }); }
    dropIndexes(indexes = '*') { return this._run({ dropIndexes: this._name, index: indexes }); }

    stats(scale = undefined) { return this._run({ collStats: this._name, ...scaleOption(scale) }); }
    dataSize() { return num(this.stats().size); }
    storageSize() { return num(this.stats().storageSize); }
    totalIndexSize() { return num(this.stats().totalIndexSize); }

    totalSize() {
      const { storageSize, totalIndexSize } = this.stats();
      return num(storageSize) + num(totalIndexSize);
    }

    isCapped() { return Boolean(this.stats().capped); }

    validate(full = false) {
      const options = typeof full === 'object' ? full : { full: Boolean(full) };
      return this._run({ validate: this._name, ...options });
    }

    renameCollection(newName, dropTarget = false) {
      const db = this._db.getName();
      return this._db.adminCommand({ renameCollection: this.getFullName(), to: `${db}.${newName}`, dropTarget });
    }

    explain(verbosity = undefined) { return new Explainable(this, verbosityOf(verbosity)); }

    watch() { failWith('Error', WATCH_UNSUPPORTED); }

    // Solo responde un mongos; en un servidor sin sharding el error del servidor lo dice.
    getShardVersion() { return this._db.adminCommand({ getShardVersion: this.getFullName() }); }

    // Documentos y tamaño por shard, como `getShardDistribution()` de mongosh pero devuelto como datos.
    getShardDistribution() {
      const ns = this.getFullName();
      const sharded = this._db.getSiblingDB('config').getCollection('collections').findOne({ _id: ns });
      if (!sharded) failWith('ShardingError', `La colección ${ns} no está fragmentada (sharded)`);
      const shards = this.aggregate([{ $collStats: { storageStats: {} } }]).toArray();
      const total = shards.reduce((sum, s) => sum + num(s.storageStats.count), 0);
      return shards.map(({ shard, host, storageStats }) => ({
        shard,
        host,
        count: num(storageStats.count),
        size: num(storageStats.size),
        avgObjSize: num(storageStats.avgObjSize ?? 0),
        percentOfDocuments: total ? (100 * num(storageStats.count)) / total : 0,
      }));
    }

    // Como mongosh: `false` si la colección no existe, en vez de fallar. Desde MongoDB 7.0 el
    // servidor ya no falla ahí y responde `ok`, así que da `true`. El mensaje termina en
    // `(codeName)`, como lo arma `mongo::describe`.
    drop() {
      try {
        this._run({ drop: this._name });
      } catch (e) {
        if (e.name === 'MongoError' && /\(NamespaceNotFound\)$/.test(e.message)) return false;
        throw e;
      }
      return true;
    }

    toString() { return this.getFullName(); }
    tojson() { return this.toString(); }
  }

  // `coll.explain(verbosidad)`: las mismas operaciones que la colección, pero devuelven el plan.
  // Explicar no ejecuta: ni siquiera un update o un remove llegan a escribir.
  class Explainable {
    constructor(collection, verbosity) {
      this._collection = collection;
      this._verbosity = verbosity;
    }

    _explain(command) {
      return this._collection._run({ explain: command, verbosity: this._verbosity });
    }

    find(filter = {}, projection = undefined) {
      return this._collection._query(filter, projection, ExplainQuery, this._verbosity);
    }

    aggregate(pipeline = [], options = {}) {
      return this._explain(aggregateCommand(this._collection.getName(), pipeline)(options));
    }

    count(filter = {}) { return this._explain({ count: this._collection.getName(), query: filter }); }

    distinct(key, filter = {}) {
      return this._explain({ distinct: this._collection.getName(), key, query: filter });
    }

    update(filter, update, options = {}) {
      return this._explain({ update: this._collection.getName(), updates: [updateStatement(filter, update, options)] });
    }

    remove(filter = {}, justOne = false) {
      return this._explain({ delete: this._collection.getName(), deletes: [deleteStatement(filter, justOne)] });
    }

    findAndModify(spec) {
      return this._explain({ findAndModify: this._collection.getName(), ...compact(spec) });
    }

    toString() { return `Explainable(${this._collection.getFullName()})`; }
    tojson() { return this.toString(); }
  }

  Object.assign(lib, { Collection });
});
