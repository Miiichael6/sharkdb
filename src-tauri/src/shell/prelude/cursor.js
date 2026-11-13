// Cursor perezoso de find y aggregate: los modificadores (sort, limit, collation...) solo valen
// antes de leer el primer documento; la consulta se abre en el servidor al leer.
(function (native, lib) {
  'use strict';

  const { failWith } = lib;

  // Documentos que se piden al servidor cada vez que un script recorre un cursor.
  const SCRIPT_BATCH_SIZE = 100;
  // `explain(true)` del shell clásico es el nivel más detallado.
  const VERBOSITY = { true: 'allPlansExecution', false: 'queryPlanner' };
  const DEFAULT_VERBOSITY = 'queryPlanner';
  // Opciones del cursor que no son campos del comando (van al driver como preferencia de lectura).
  const DRIVER_ONLY_OPTIONS = ['readPref'];

  const verbosityOf = (verbosity) => VERBOSITY[verbosity] ?? verbosity ?? DEFAULT_VERBOSITY;
  const hasFields = (spec) => spec != null && typeof spec === 'object' && Object.keys(spec).length > 0;

  // `source` dice cómo abrir el cursor en el servidor y, si se puede, cómo contarlo y con qué
  // comando se explica: { open(options), count(options), command(options), run(command), editable,
  // writable() }.
  class Cursor {
    constructor(ns, source) {
      this._ns = ns;
      this._source = source;
      this._options = {};
      this._id = null;
      this._buffer = [];
      // Cursor del que salió `_buffer`: sigue valiendo cuando `_id` pasa a null al agotarse.
      this._bufferFrom = null;
      this._done = false;
      this._startedBecause = null;
    }

    _modify(name, value) {
      if (this._id !== null || this._done) {
        failWith('Error', `${name}: ${this._startedBecause ?? 'el cursor ya se ha empezado a leer'}`);
      }
      this._options[name] = value;
      return this;
    }

    // Abre la consulta ya, sin esperar a que se lea; `reason` explica después por qué no admite
    // modificadores.
    _start(reason) {
      this._startedBecause = reason;
      this._id = this._source.open(this._options);
    }

    sort(spec) { return this._modify('sort', spec); }
    skip(n) { return this._modify('skip', n); }
    limit(n) { return this._modify('limit', n); }
    projection(spec) { return this._modify('projection', spec); }
    batchSize(n) { return this._modify('batchSize', n); }
    hint(index) { return this._modify('hint', index); }
    maxTimeMS(ms) { return this._modify('maxTimeMS', ms); }
    collation(spec) { return this._modify('collation', spec); }
    min(spec) { return this._modify('min', spec); }
    max(spec) { return this._modify('max', spec); }
    comment(text) { return this._modify('comment', text); }
    noCursorTimeout() { return this._modify('noCursorTimeout', true); }
    allowDiskUse(allow = true) { return this._modify('allowDiskUse', allow); }

    readPref(mode, tagSets = undefined) {
      return this._modify('readPref', tagSets ? { mode, tagSets } : { mode });
    }

    // El resultado ya se muestra formateado; existe para que los scripts de Robo 3T funcionen.
    pretty() { return this; }

    _fetch(size) {
      if (this._done) return;
      if (this._id === null) this._id = this._source.open(this._options);
      // Solo se lee con el buffer vacío (`hasNext`): lo que haya en él es la cola de este lote.
      const batch = native.cursorNext(this._id, size);
      this._bufferFrom = this._id;
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

    // Sin preguntar al servidor: true solo si ya se leyó todo y no queda nada por entregar.
    isExhausted() { return this._done && this._buffer.length === 0; }

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

    // Como el shell clásico: cuenta lo que casa con el filtro; skip y limit solo si se pide.
    count(applySkipLimit = false) {
      if (!this._source.count) failWith('Error', 'count: este cursor no se puede contar');
      const { skip, limit } = this._options;
      return this._source.count(applySkipLimit ? { skip, limit } : {});
    }

    size() { return this.count(true); }

    explain(verbosity = undefined) {
      if (!this._source.command) failWith('Error', 'explain: este cursor no se puede explicar');
      const options = { ...this._options };
      DRIVER_ONLY_OPTIONS.forEach((name) => delete options[name]);
      return this._source.run({ explain: this._source.command(options), verbosity: verbosityOf(verbosity) });
    }

    close() {
      if (this._id !== null) native.cursorClose(this._id);
      this._id = null;
      this._done = true;
      this._buffer = [];
    }

    // Primer lote para mostrar como resultado: lo que el script ya tenía leído y, en `missing`,
    // cuántos más debe leer prelude/mod.rs directamente del servidor sin pasarlos por JS. Si
    // la consulta aún no se abrió, se abre pidiendo de entrada al menos esa página: la respuesta
    // trae el lote entero y leerlo más tarde (`fresh`) da lo mismo que leerlo ahora.
    _take(size) {
      const fresh = this._id === null && !this._done && this._buffer.length < size;
      if (fresh) {
        this._options.batchSize = Math.max(this._options.batchSize ?? 0, size);
        this._id = this._source.open(this._options);
      }
      const documents = this._buffer.splice(0);
      const uneditable = this._uneditable();
      return {
        kind: 'cursor',
        ns: this._ns,
        id: this._id,
        documents,
        // cursor_result.rs toma estos documentos del lote en BSON que guardó el puente, si lo tiene:
        // pasados por JS, un Double entero volvería como Int32.
        bufferFrom: documents.length > 0 ? this._bufferFrom : null,
        exhausted: this._done,
        missing: this._done ? 0 : Math.max(0, size - documents.length),
        fresh,
        editable: uneditable === null,
        uneditable,
        cursor: this,
      };
    }

    // Solo los documentos enteros de la colección se pueden editar o eliminar desde el resultado
    // (y sincronizar con otro entorno por su `_id`). Devuelve por qué no, o null si se puede:
    // con proyección, guardar reemplazaría el documento por los campos que se ven; los de un
    // aggregate (`editable: false` en `source`) no son documentos de la colección y su `_id` puede
    // ser otro; una vista o una timeseries (`writable()` en `source`) no admiten reemplazar ni
    // borrar el documento y su `_id` puede salir del pipeline de la vista.
    _uneditable() {
      if (this._source.editable === false) return 'aggregate';
      if (hasFields(this._options.projection)) return 'projection';
      return !this._source.writable || this._source.writable() ? null : 'readOnlyCollection';
    }

    _editable() { return this._uneditable() === null; }

    // prelude/mod.rs leyó el cursor hasta el final.
    _exhaust() {
      this._id = null;
      this._done = true;
    }

    toString() { return `DBQuery: ${this._ns}`; }
    tojson() { return this.toString(); }
  }

  // `coll.explain().find(...)`: admite los mismos modificadores, pero al mostrarse (o con
  // `next()`/`finish()`) da el plan de la consulta en vez de sus documentos.
  class ExplainQuery extends Cursor {
    constructor(ns, source, verbosity) {
      super(ns, source);
      this._verbosity = verbosity;
    }

    finish() { return this.explain(this._verbosity); }
    next() { return this.finish(); }
    toArray() { return [this.finish()]; }
  }

  // Documento de `findOne` → su cursor y cómo era al leerlo. Si queda intacto como valor de una
  // sentencia se muestra como el resultado de un find de un documento, editable como tal.
  const found = new WeakMap();

  const isPlainObject = (value) => {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  };

  // Estructura del documento al leerlo: cada objeto y array con sus claves; las hojas (también
  // ObjectId, NumberLong...) por identidad y las fechas además por su instante, que `setX` cambia.
  function snapshotOf(value) {
    if (Array.isArray(value) || isPlainObject(value)) {
      return { value, entries: Object.entries(value).map(([key, child]) => [key, snapshotOf(child)]) };
    }
    return { value, time: value instanceof Date ? value.getTime() : undefined };
  }

  function unchanged(value, snapshot) {
    if (!Object.is(value, snapshot.value)) return false;
    if (snapshot.entries) {
      const keys = Object.keys(value);
      return keys.length === snapshot.entries.length &&
        snapshot.entries.every(([key, child], i) => keys[i] === key && unchanged(value[key], child));
    }
    return snapshot.time === undefined || value.getTime() === snapshot.time;
  }

  function rememberFound(doc, cursor) {
    if (isPlainObject(doc)) found.set(doc, { cursor, snapshot: snapshotOf(doc) });
    return doc;
  }

  // Lo que `Cursor._take` daría para `value` si es un documento de `findOne` que el script no
  // tocó y que se puede editar; null si no. Con proyección, de una vista... se muestra como valor.
  function describeFound(value) {
    const entry = isPlainObject(value) ? found.get(value) : undefined;
    if (!entry || !unchanged(value, entry.snapshot) || !entry.cursor._editable()) return null;
    return {
      kind: 'cursor',
      ns: entry.cursor._ns,
      id: null,
      documents: [value],
      bufferFrom: null,
      exhausted: true,
      missing: 0,
      fresh: false,
      editable: true,
      uneditable: null,
      cursor: entry.cursor,
    };
  }

  Object.assign(lib, { Cursor, ExplainQuery, verbosityOf, rememberFound, describeFound });
});
