// Utilidades que comparten todas las piezas del prelude. Cada fichero del prelude es una función
// que recibe las nativas (native/mod.rs) y `lib`, donde deja lo que exporta a los siguientes.
(function (native, lib) {
  'use strict';

  // Los Int32 del servidor llegan como número y los Int64 como NumberLong; los contadores se dan
  // como número.
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

  // Sin `_id` se genera un ObjectId. Con `_id: undefined` (variable sin asignar, propiedad mal
  // escrita) se guardaría `_id: null` y el siguiente insert igual daría duplicate key: se rechaza.
  function withId(doc, name) {
    if (!('_id' in doc)) return { _id: ObjectId(), ...doc };
    if (doc._id === undefined) {
      failWith('Error', `${name}: el documento tiene _id undefined; quita la clave para que se genere un ObjectId o dale un valor`);
    }
    return doc;
  }

  // `stats(1024)` o `stats({ scale: 1024 })`, como en el shell clásico.
  const scaleOption = (scale) => (typeof scale === 'number' ? { scale } : scale ?? {});

  Object.assign(lib, { num, compact, withChildren, failWith, withId, scaleOption });
});
