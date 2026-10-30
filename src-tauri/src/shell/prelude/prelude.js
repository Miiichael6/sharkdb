// API del shell de Mongo: clases DB, Collection y Cursor sobre las funciones nativas de
// native/mod.rs (find, aggregate, runCommand, cursorNext, cursorClose). Se evalúa como una
// función que recibe esas nativas; deja el global oculto `__shell` con los ganchos que usa
// prelude/mod.rs (beginRun, use, show, describe).
(function (native) {
  'use strict';

  // Documentos que se piden al servidor cada vez que un script recorre un cursor.
  const SCRIPT_BATCH_SIZE = 100;
  const BYTES_PER_GB = 1024 ** 3;
  const DB_NAME_WIDTH = 20;

  // Los enteros del servidor llegan como NumberInt/NumberLong; los contadores se dan como número.
  const num = (value) => (value !== null && typeof value === 'object' ? Number(value) : value);

  // Quita las opciones sin valor: `undefined` llegaría al servidor como null.
  const compact = (fields) =>
    Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

  // `db.coll` y `db.coll.sub`: cualquier propiedad desconocida es una (sub)colección. Las que
  // empiezan por `_` se reservan para el estado interno (`_bsontype`, `_name`...).
  function withChildren(target, child) {
    return new Proxy(target, {
      get(obj, prop, receiver) {
        if (typeof prop === 'symbol' || prop in obj || prop.startsWith('_')) {
          return Reflect.get(obj, prop, receiver);
        }
        return child(prop);
      },
    });
  }

  function failWith(name, message) {
    const error = new Error(message);
    error.name = name;
    throw error;
  }

  function checkWrite(reply) {
    const [first] = reply.writeErrors ?? [];
    if (first) failWith('WriteError', `${first.errmsg} (código ${num(first.code)})`);
    if (reply.writeConcernError) failWith('WriteConcernError', reply.writeConcernError.errmsg);
    return reply;
  }

  // Resultado de una escritura: el frontend lo muestra distinto de un documento cualquiera.
  class WriteResult {
    constructor(fields) {
      Object.assign(this, fields);
    }
  }

  function updateResult(reply) {
    const upserted = reply.upserted ?? [];
    return new WriteResult({
      acknowledged: true,
      matchedCount: num(reply.n) - upserted.length,
      modifiedCount: num(reply.nModified),
      upsertedCount: upserted.length,
      upsertedId: upserted.length ? upserted[0]._id : null,
    });
  }

  const withId = (doc) => ('_id' in doc ? doc : { _id: ObjectId(), ...doc });

  // Cursor perezoso: los modificadores (sort, limit...) solo valen antes de leer el primer
  // documento; la consulta se abre en el servidor al leer.
  class Cursor {
    constructor(ns, open, count) {
      this._ns = ns;
      this._open = open;
      this._count = count;
      this._options = {};
      this._id = null;
      this._buffer = [];
      this._done = false;
    }

    _modify(name, value) {
      if (this._id !== null || this._done) failWith('Error', `${name}: el cursor ya se ha empezado a leer`);
      this._options[name] = value;
      return this;
    }

    sort(spec) { return this._modify('sort', spec); }
    skip(n) { return this._modify('skip', n); }
    limit(n) { return this._modify('limit', n); }
    projection(spec) { return this._modify('projection', spec); }
    batchSize(n) { return this._modify('batchSize', n); }
    hint(index) { return this._modify('hint', index); }
    maxTimeMS(ms) { return this._modify('maxTimeMS', ms); }

    _fetch(size) {
      if (this._done) return;
      if (this._id === null) this._id = this._open(this._options);
      const batch = native.cursorNext(this._id, size);
      this._buffer.push(...batch.documents);
      if (batch.exhausted) {
        this._done = true;
        this._id = null;
      }
    }

    hasNext() {
      while (this._buffer.length === 0 && !this._done) this._fetch(SCRIPT_BATCH_SIZE);
      return this._buffer.length > 0;
    }

    next() {
      if (!this.hasNext()) failWith('Error', 'next: el cursor no tiene más documentos');
      return this._buffer.shift();
    }

    toArray() {
      const all = [];
      while (this.hasNext()) all.push(...this._buffer.splice(0));
      return all;
    }

    forEach(fn) {
      while (this.hasNext()) fn(this.next());
    }

    map(fn) {
      return this.toArray().map(fn);
    }

    itcount() {
      let n = 0;
      while (this.hasNext()) n += this._buffer.splice(0).length;
      return n;
    }

    // Como el shell clásico: cuenta lo que casa con el filtro, sin aplicar skip ni limit.
    count() {
      if (!this._count) failWith('Error', 'count: este cursor no se puede contar');
      return this._count();
    }

    close() {
      if (this._id !== null) native.cursorClose(this._id);
      this._id = null;
      this._done = true;
      this._buffer = [];
    }

    // Primer lote para mostrar como resultado; incluye lo que el script ya tenía leído.
    _take(size) {
      while (this._buffer.length < size && !this._done) this._fetch(size - this._buffer.length);
      return {
        kind: 'cursor',
        ns: this._ns,
        id: this._id,
        documents: this._buffer.splice(0),
        exhausted: this._done,
      };
    }

    toString() { return `DBQuery: ${this._ns}`; }
    tojson() { return this.toString(); }
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

    find(filter = {}, projection = undefined) {
      const db = this._db.getName();
      const cursor = new Cursor(
        this.getFullName(),
        (options) => native.find(db, this._name, filter, options),
        () => this.count(filter),
      );
      return projection ? cursor.projection(projection) : cursor;
    }

    findOne(filter = {}, projection = undefined) {
      const cursor = this.find(filter, projection).limit(1);
      return cursor.hasNext() ? cursor.next() : null;
    }

    aggregate(pipeline = [], options = {}) {
      const stages = Array.isArray(pipeline) ? pipeline : [...arguments];
      const extra = Array.isArray(pipeline) ? options : {};
      const db = this._db.getName();
      return new Cursor(
        this.getFullName(),
        (cursorOptions) => native.aggregate(db, this._name, stages, { ...extra, ...cursorOptions }),
        null,
      );
    }

    insertOne(doc) {
      const document = withId(doc);
      checkWrite(this._run({ insert: this._name, documents: [document] }));
      return new WriteResult({ acknowledged: true, insertedId: document._id });
    }

    insertMany(docs, { ordered = true } = {}) {
      const documents = docs.map(withId);
      checkWrite(this._run({ insert: this._name, documents, ordered }));
      return new WriteResult({ acknowledged: true, insertedIds: documents.map((d) => d._id) });
    }

    insert(docOrDocs) {
      const docs = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const reply = checkWrite(this._run({ insert: this._name, documents: docs.map(withId) }));
      return new WriteResult({ nInserted: num(reply.n) });
    }

    _update(filter, update, { upsert = false, multi = false, ...rest } = {}) {
      const statement = compact({ q: filter, u: update, upsert, multi, ...rest });
      return updateResult(checkWrite(this._run({ update: this._name, updates: [statement] })));
    }

    updateOne(filter, update, options = {}) { return this._update(filter, update, { ...options, multi: false }); }
    updateMany(filter, update, options = {}) { return this._update(filter, update, { ...options, multi: true }); }
    replaceOne(filter, doc, options = {}) { return this._update(filter, doc, { ...options, multi: false }); }
    update(filter, update, options = {}) { return this._update(filter, update, options); }

    _delete(filter, justOne) {
      const deletes = [{ q: filter, limit: justOne ? 1 : 0 }];
      const reply = checkWrite(this._run({ delete: this._name, deletes }));
      return new WriteResult({ acknowledged: true, deletedCount: num(reply.n) });
    }

    deleteOne(filter) { return this._delete(filter, true); }
    deleteMany(filter) { return this._delete(filter, false); }
    remove(filter = {}, justOne = false) { return this._delete(filter, justOne); }

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

    count(filter = {}) { return num(this._run({ count: this._name, query: filter }).n); }
    estimatedDocumentCount() { return num(this._run({ count: this._name }).n); }

    countDocuments(filter = {}) {
      const [row] = this.aggregate([{ $match: filter }, { $group: { _id: 1, n: { $sum: 1 } } }]).toArray();
      return row ? num(row.n) : 0;
    }

    distinct(key, filter = {}) {
      return this._run({ distinct: this._name, key, query: filter }).values;
    }

    createIndex(keys, options = {}) {
      const name = options.name ?? Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_');
      this._run({ createIndexes: this._name, indexes: [{ key: keys, ...options, name }] });
      return name;
    }

    getIndexes() { return this._run({ listIndexes: this._name }).cursor.firstBatch; }
    dropIndex(name) { return this._run({ dropIndexes: this._name, index: name }); }
    stats() { return this._run({ collStats: this._name }); }

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

    drop() {
      this._run({ drop: this._name });
      return true;
    }

    toString() { return this.getFullName(); }
    tojson() { return this.toString(); }
  }

  class DB {
    constructor(name) {
      this._name = name;
      return withChildren(this, (coll) => this.getCollection(coll));
    }

    getName() { return this._name; }
    getCollection(name) { return new Collection(this, name); }
    getSiblingDB(name) { return new DB(name); }

    runCommand(command) {
      return native.runCommand(this._name, typeof command === 'string' ? { [command]: 1 } : command);
    }

    adminCommand(command) { return this.getSiblingDB('admin').runCommand(command); }

    getCollectionInfos(filter = {}) {
      return this.runCommand({ listCollections: 1, filter }).cursor.firstBatch;
    }

    getCollectionNames() { return this.getCollectionInfos().map((c) => c.name).sort(); }
    getUsers() { return this.runCommand({ usersInfo: 1 }).users; }
    stats() { return this.runCommand({ dbStats: 1 }); }
    version() { return this.adminCommand({ buildInfo: 1 }).version; }
    createCollection(name, options = {}) { return this.runCommand({ create: name, ...options }); }
    dropDatabase() { return this.runCommand({ dropDatabase: 1 }); }

    toString() { return this._name; }
    tojson() { return this.toString(); }
  }

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
      if (value instanceof Cursor) return value._take(firstBatchSize);
      if (value instanceof WriteResult) return { kind: 'write', value };
      if (value instanceof DB || value instanceof Collection) return { kind: 'value', value: value.toString() };
      return { kind: 'value', value };
    },
  };
  Object.defineProperty(globalThis, '__shell', { value: shell });
});
