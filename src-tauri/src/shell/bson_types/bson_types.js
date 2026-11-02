// Constructores BSON del shell de Mongo. Se evalúa como una función que recibe los helpers
// nativos de bson_types.rs; así esos helpers no quedan expuestos como globales.
//
// Contrato con convert.rs: cada prototipo lleva `_bsontype` (también Date y RegExp) y cada
// instancia guarda su contenido en propiedades no enumerables (`str`, `_value`, `_subtype`...).
(function (native) {
  'use strict';

  const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/;
  const UUID_HEX = /^[0-9a-fA-F]{32}$/;
  const INT64_DIGITS = /^-?\d+$/;
  const HAS_TIME_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
  const HAS_TIME = /T|\s\d/;
  const UUID_SUBTYPE = 4;
  const MAX_SAFE_LONG = Number.MAX_SAFE_INTEGER;

  function hidden(target, values) {
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(target, name, { value, writable: false, enumerable: false });
    }
  }

  function defineType(ctor, tag, methods) {
    Object.defineProperty(ctor.prototype, '_bsontype', { value: tag });
    for (const [name, fn] of Object.entries(methods)) {
      Object.defineProperty(ctor.prototype, name, { value: fn, writable: true, configurable: true });
    }
    globalThis[tag] = ctor;
  }

  // El shell permite llamar a los constructores sin `new`: ObjectId(), NumberLong(5)...
  function construct(self, ctor, args) {
    return self instanceof ctor ? null : new ctor(...args);
  }

  function ObjectId(hex) {
    const instance = construct(this, ObjectId, arguments);
    if (instance) return instance;
    if (hex === undefined) hex = native.newObjectId();
    if (typeof hex !== 'string' || !OBJECT_ID_HEX.test(hex)) {
      throw new TypeError('ObjectId: se esperan 24 caracteres hexadecimales');
    }
    hidden(this, { str: hex.toLowerCase() });
  }
  defineType(ObjectId, 'ObjectId', {
    toString() { return `ObjectId("${this.str}")`; },
    tojson() { return this.toString(); },
    toHexString() { return this.str; },
    valueOf() { return this.str; },
    getTimestamp() { return new Date(parseInt(this.str.slice(0, 8), 16) * 1000); },
    equals(other) { return other instanceof ObjectId && other.str === this.str; },
  });

  // Fechas sin zona horaria se interpretan en UTC, como el shell.
  globalThis.ISODate = function ISODate(text) {
    if (text === undefined) return new Date();
    const iso = String(text).trim();
    const date = new Date(HAS_TIME.test(iso) && !HAS_TIME_ZONE.test(iso) ? iso + 'Z' : iso);
    if (Number.isNaN(date.getTime())) throw new TypeError(`ISODate: fecha no válida "${iso}"`);
    return date;
  };
  defineType(Date, 'Date', {
    tojson() { return `ISODate("${this.toISOString()}")`; },
  });

  defineType(RegExp, 'RegExp', {
    tojson() { return this.toString(); },
  });

  // Expresión regular con opciones que JS no admite (x, l).
  function BSONRegExp(pattern, options) {
    const instance = construct(this, BSONRegExp, arguments);
    if (instance) return instance;
    hidden(this, { _pattern: String(pattern), _options: String(options ?? '') });
  }
  defineType(BSONRegExp, 'BSONRegExp', {
    toString() { return `BSONRegExp(${JSON.stringify(this._pattern)}, ${JSON.stringify(this._options)})`; },
    tojson() { return this.toString(); },
  });

  function NumberLong(value) {
    const instance = construct(this, NumberLong, arguments);
    if (instance) return instance;
    const text = typeof value === 'number' ? String(Math.trunc(value)) : String(value ?? 0);
    if (!INT64_DIGITS.test(text)) throw new TypeError(`NumberLong: entero no válido "${text}"`);
    hidden(this, { _value: native.parseInt64(text) });
  }
  defineType(NumberLong, 'NumberLong', {
    toString() {
      const n = Number(this._value);
      return Math.abs(n) <= MAX_SAFE_LONG ? `NumberLong(${this._value})` : `NumberLong("${this._value}")`;
    },
    tojson() { return this.toString(); },
    valueOf() { return Number(this._value); },
    toNumber() { return Number(this._value); },
  });

  function NumberInt(value) {
    const instance = construct(this, NumberInt, arguments);
    if (instance) return instance;
    const n = Number(value ?? 0);
    if (Number.isNaN(n)) throw new TypeError(`NumberInt: número no válido "${value}"`);
    hidden(this, { _value: n | 0 });
  }
  defineType(NumberInt, 'NumberInt', {
    toString() { return `NumberInt(${this._value})`; },
    tojson() { return this.toString(); },
    valueOf() { return this._value; },
    toNumber() { return this._value; },
  });

  // Double con valor entero: un número JS entero se guarda como Int32 (ver convert).
  function Double(value) {
    const instance = construct(this, Double, arguments);
    if (instance) return instance;
    const n = Number(value ?? 0);
    if (Number.isNaN(n) && typeof value !== 'number') throw new TypeError(`Double: número no válido "${value}"`);
    hidden(this, { _value: n });
  }
  defineType(Double, 'Double', {
    toString() { return `Double(${this._value})`; },
    tojson() { return this.toString(); },
    valueOf() { return this._value; },
    toNumber() { return this._value; },
  });

  function NumberDecimal(value) {
    const instance = construct(this, NumberDecimal, arguments);
    if (instance) return instance;
    hidden(this, { _value: native.parseDecimal(String(value ?? 0)) });
  }
  defineType(NumberDecimal, 'NumberDecimal', {
    toString() { return `NumberDecimal("${this._value}")`; },
    tojson() { return this.toString(); },
    valueOf() { return Number(this._value); },
    toNumber() { return Number(this._value); },
  });

  function BinData(subtype, base64) {
    const instance = construct(this, BinData, arguments);
    if (instance) return instance;
    if (!Number.isInteger(subtype) || subtype < 0 || subtype > 255) {
      throw new TypeError('BinData: el subtipo debe ser un entero entre 0 y 255');
    }
    const text = String(base64 ?? '');
    native.base64ToHex(text); // valida
    hidden(this, { _subtype: subtype, _base64: text });
  }
  defineType(BinData, 'BinData', {
    toString() {
      if (this._subtype === UUID_SUBTYPE && this.length() === 16) return `UUID("${this.uuid()}")`;
      return `BinData(${this._subtype},"${this._base64}")`;
    },
    tojson() { return this.toString(); },
    subtype() { return this._subtype; },
    base64() { return this._base64; },
    hex() { return native.base64ToHex(this._base64); },
    length() { return this.hex().length / 2; },
    uuid() {
      const h = this.hex();
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  });

  // Como en el shell, UUID() devuelve un BinData de subtipo 4.
  globalThis.UUID = function UUID(text) {
    const hex = text === undefined ? native.newUuid() : String(text).replace(/-/g, '');
    if (!UUID_HEX.test(hex)) throw new TypeError('UUID: se esperan 32 dígitos hexadecimales');
    return new BinData(UUID_SUBTYPE, native.hexToBase64(hex));
  };

  function Timestamp(t, i) {
    const instance = construct(this, Timestamp, arguments);
    if (instance) return instance;
    hidden(this, { _t: Number(t ?? 0) >>> 0, _i: Number(i ?? 0) >>> 0 });
  }
  defineType(Timestamp, 'Timestamp', {
    toString() { return `Timestamp(${this._t}, ${this._i})`; },
    tojson() { return this.toString(); },
    getTime() { return this._t; },
    getInc() { return this._i; },
  });

  function Code(code, scope) {
    const instance = construct(this, Code, arguments);
    if (instance) return instance;
    hidden(this, { _code: String(code ?? ''), _scope: scope });
  }
  defineType(Code, 'Code', {
    toString() { return `Code(${JSON.stringify(this._code)})`; },
    tojson() { return this.toString(); },
  });

  // MinKey y MaxKey son únicos: MinKey() === MinKey().
  function singleton(tag) {
    let only = null;
    function Key() {
      if (only) return only;
      if (!(this instanceof Key)) return new Key();
      only = this;
    }
    Object.defineProperty(Key, 'name', { value: tag });
    defineType(Key, tag, {
      toString() { return `${tag}()`; },
      tojson() { return this.toString(); },
    });
  }
  singleton('MinKey');
  singleton('MaxKey');
});
