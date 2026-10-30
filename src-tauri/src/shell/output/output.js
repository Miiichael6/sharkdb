// print, printjson y tojson del shell. Recibe la función nativa que acumula cada línea en la
// salida del script (output.rs).
(function (emit) {
  'use strict';

  const INDENT = '\t';
  const MAX_DEPTH = 100;

  function tojson(value, indent = '', depth = 0) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value !== 'object') return String(value);
    if (depth >= MAX_DEPTH) return '[...]';
    if (typeof value.tojson === 'function') return value.tojson();

    const inner = indent + INDENT;
    const entries = Array.isArray(value)
      ? value.map((item) => inner + tojson(item, inner, depth + 1))
      : Object.keys(value).map((key) => `${inner}${JSON.stringify(key)} : ${tojson(value[key], inner, depth + 1)}`);
    const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
    if (entries.length === 0) return `${open} ${close}`;
    return `${open}\n${entries.join(',\n')}\n${indent}${close}`;
  }

  globalThis.tojson = (value) => tojson(value);
  globalThis.print = (...values) => emit(values.map(String).join(' '));
  globalThis.printjson = (value) => emit(tojson(value));
});
