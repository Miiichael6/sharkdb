// Colección del shell: consultas, escrituras (en lotes, vía writes.js y bulk.js), índices,
// tamaños y `explain()`. Todo lo que no es find/aggregate va al servidor como `runCommand`.
(function (native, lib) {
  'use strict';

  const {
    num, compact, withChildren, failWith, withId, scaleOption,
    Cursor, ExplainQuery, verbosityOf, rememberFound,
    WriteResult, runWrites, failOnWriteErrors, updateResult,
    Bulk, bulkWrite, updateStatement, deleteStatement, checkUpdate, checkReplacement, checkFilter, checkDefined,
  } = lib;

  const WATCH_UNSUPPORTED =
    'watch: los change streams no se pueden seguir desde un script (bloquearían la pestaña); ' +
    'consulta los cambios recientes con find sobre tus datos o usa otra herramienta para seguirlos';

  // Tipos de `listCollections` cuyos documentos no se editan desde el resultado de un find.
  const READ_ONLY_TYPES = new Set(['view', 'timeseries']);

  // Etapas con las que un aggregate escribe su resultado en otra colección.
  const WRITE_STAGES = ['$out', '$merge'];
  const writesOutput = (stage) =>
    stage !== null && typeof stage === 'object' && WRITE_STAGES.some((name) => name in stage);
  const WRITE_PIPELINE_STARTED =
    'un aggregate con $out o $merge se ejecuta al llamarlo; pasa la opción en el segundo argumento: ' +
    'aggregate(pipeline, { allowDiskUse: true, ... })';

  const indexName = (keys) => Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_');

  const withIndexNames = (keyPatterns, options) =>
    keyPatterns.map((key) => ({ key, ...options, name: indexName(key) }));

  // Firma del shell clásico `update(q, u, upsert, multi)`, además de la de opciones.
  function updateOptions(options, multi) {
    if (typeof options === 'boolean' || typeof multi === 'boolean') {
      return { upsert: Boolean(options), multi: Boolean(multi) };
    }
    return options ?? {};
  }

  // `remove(q, true)` o `remove(q, { justOne: true, collation })`, como en el shell clásico.
  function removeOptions(options) {
    if (options !== null && typeof options === 'object') {
      const { justOne = false, ...rest } = options;
      return { justOne: Boolean(justOne), rest };
    }
    return { justOne: Boolean(options), rest: {} };
  }

  // Opciones de findOneAndUpdate/Replace (las de mongosh) → campos del comando findAndModify. El
  // resto (`arrayFilters`, `collation`, `hint`...) se llaman igual en el comando y pasan tal cual;
  // si el servidor no conoce alguna, falla en vez de ignorarla.
  function findAndModifyOptions(name, { projection, returnDocument, returnNewDocument, ...rest }) {
    if (returnDocument !== undefined && returnDocument !== 'before' && returnDocument !== 'after') {
      failWith('Error', `${name}: returnDocument debe ser 'before' o 'after'`);
    }
    const returnNew = returnDocument === undefined ? returnNewDocument : returnDocument === 'after';
    return { ...rest, fields: projection, new: returnNew };
  }

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
        writable: () => this._writable(),
      }, ...extra);
      return projection ? cursor.projection(projection) : cursor;
    }

    // Solo se pregunta al servidor al mostrar el resultado; una colección que no existe cuenta como normal.
    _writable() {
      const [info] = this._db.getCollectionInfos({ name: this._name });
      return !READ_ONLY_TYPES.has(info?.type);
    }

    find(filter = {}, projection = undefined) { return this._query(filter, projection); }

    findOne(filter = {}, projection = undefined) {
      const cursor = this.find(filter, projection).limit(1);
      return cursor.hasNext() ? rememberFound(cursor.next(), cursor) : null;
    }

    aggregate(pipeline = [], options = {}) {
      const stages = Array.isArray(pipeline) ? pipeline : [...arguments];
      const extra = Array.isArray(pipeline) ? options : {};
      const db = this._db.getName();
      const cursor = new Cursor(this.getFullName(), {
        open: (cursorOptions) => native.aggregate(db, this._name, stages, { ...extra, ...cursorOptions }),
        count: null,
        command: (cursorOptions) => aggregateCommand(this._name, stages)({ ...extra, ...cursorOptions }),
        run: (command) => this._run(command),
        editable: false,
      });
      // Como el shell clásico (Robo 3T) y mongosh: un pipeline que escribe se ejecuta al llamarlo,
      // aunque el script no lo recorra ni se muestre.
      if (stages.some(writesOutput)) cursor._start(WRITE_PIPELINE_STARTED);
      return cursor;
    }

    _write(type, items, ordered = true) {
      const summary = runWrites((command) => this._run(command), type, this._name, items, { ordered });
      return failOnWriteErrors(summary, items.length);
    }

    insertOne(doc) {
      const document = withId(doc, 'insertOne');
      this._write('insert', [document]);
      return new WriteResult({ acknowledged: true, insertedId: document._id });
    }

    insertMany(docs, { ordered = true } = {}) {
      const documents = docs.map((doc, i) => withId(doc, `insertMany (documento ${i})`));
      this._write('insert', documents, ordered);
      return new WriteResult({ acknowledged: true, insertedIds: documents.map((d) => d._id) });
    }

    insert(docOrDocs, { ordered = true } = {}) {
      const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const summary = this._write('insert', docs.map((doc, i) => withId(doc, `insert (documento ${i})`)), ordered);
      return new WriteResult({ nInserted: summary.counts.insert });
    }

    _update(filter, update, options) {
      return updateResult(this._write('update', [updateStatement(filter, update, options)]));
    }

    updateOne(filter, update, options = {}) {
      return this._update(checkDefined('updateOne', filter), checkUpdate('updateOne', update), { ...options, multi: false });
    }

    updateMany(filter, update, options = {}) {
      return this._update(checkDefined('updateMany', filter), checkUpdate('updateMany', update), { ...options, multi: true });
    }

    replaceOne(filter, doc, options = {}) {
      return this._update(checkDefined('replaceOne', filter), checkReplacement('replaceOne', doc), { ...options, multi: false });
    }

    update(filter, update, options = {}, multi = undefined) {
      return this._update(checkDefined('update', filter), update, updateOptions(options, multi));
    }

    _delete(filter, justOne, options = {}) {
      const summary = this._write('delete', [deleteStatement(filter, justOne, options)]);
      return new WriteResult({ acknowledged: true, deletedCount: summary.counts.delete });
    }

    deleteOne(filter, options = {}) { return this._delete(checkFilter('deleteOne', filter), true, options); }
    deleteMany(filter, options = {}) { return this._delete(checkFilter('deleteMany', filter), false, options); }

    remove(filter, options = false) {
      const { justOne, rest } = removeOptions(options);
      return this._delete(checkFilter('remove', filter), justOne, rest);
    }

    initializeOrderedBulkOp() { return new Bulk(this, true); }
    initializeUnorderedBulkOp() { return new Bulk(this, false); }
    bulkWrite(operations, options = {}) { return bulkWrite(this, operations, options); }

    // Sin filtro el servidor tomaría el primer documento en orden natural: un filtro que llega
    // `undefined` por error borraría o pisaría uno cualquiera. Para eso hay que pedirlo con `{}`.
    findAndModify(spec) {
      checkFilter('findAndModify', spec?.query, 'para tomar el primer documento cualquiera pásalo vacío: findAndModify({ query: {}, ... })');
      return this._run({ findAndModify: this._name, ...compact(spec) }).value ?? null;
    }

    _findOneAndFilter(name, filter) {
      return checkFilter(name, filter, `para tomar el primer documento cualquiera pásalo vacío: ${name}({}, ...)`);
    }

    _findAndUpdate(name, filter, update, options) {
      return this.findAndModify({ query: this._findOneAndFilter(name, filter), update, ...findAndModifyOptions(name, options) });
    }

    findOneAndUpdate(filter, update, options = {}) {
      return this._findAndUpdate('findOneAndUpdate', filter, checkUpdate('findOneAndUpdate', update), options);
    }

    findOneAndReplace(filter, doc, options = {}) {
      return this._findAndUpdate('findOneAndReplace', filter, checkReplacement('findOneAndReplace', doc), options);
    }

    findOneAndDelete(filter, { projection, ...rest } = {}) {
      return this.findAndModify({ query: this._findOneAndFilter('findOneAndDelete', filter), ...rest, fields: projection, remove: true });
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
    // Como mongosh: con '*' (o una lista) el servidor borraría todos los índices, unique incluidos.
    dropIndex(name) {
      if (name === '*' || Array.isArray(name)) {
        failWith('Error', "dropIndex: borra un solo índice; para borrar todos (o varios) usa dropIndexes()");
      }
      return this._run({ dropIndexes: this._name, index: name });
    }
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

    update(filter, update, options = {}, multi = undefined) {
      const statement = updateStatement(filter, update, updateOptions(options, multi));
      return this._explain({ update: this._collection.getName(), updates: [statement] });
    }

    remove(filter, options = false) {
      const { justOne, rest } = removeOptions(options);
      return this._explain({ delete: this._collection.getName(), deletes: [deleteStatement(checkFilter('remove', filter), justOne, rest)] });
    }

    findAndModify(spec) {
      return this._explain({ findAndModify: this._collection.getName(), ...compact(spec) });
    }

    toString() { return `Explainable(${this._collection.getFullName()})`; }
    tojson() { return this.toString(); }
  }

  Object.assign(lib, { Collection });
});
