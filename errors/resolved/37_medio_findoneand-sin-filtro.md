# 37. findOneAndDelete / Update / Replace sin filtro tocan un documento cualquiera

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/collection.js (`findAndModify`, `_findAndUpdate`, `findOneAndDelete`)
- **Estado:** resuelto — `findAndModify`, `findOneAndDelete`, `findOneAndUpdate` y `findOneAndReplace` usan `checkFilter`: sin filtro (`undefined`/`null`) dan «falta el filtro»; para actuar sobre el primer documento cualquiera hay que pasar `{}`.

## Problema
Usan `checkDefined`, que deja pasar un filtro `undefined`. Después `compact(spec)` quita `query` y se envía `{findAndModify: c, remove: true}` (o `update`) sin filtro: el servidor actúa sobre el primer documento en orden natural.

## Escenario de fallo
`db.users.findOneAndDelete(filtroMalEscrito)` con una variable sin definir borra un usuario arbitrario. `findOneAndReplace(undefined, {...})` sobrescribe uno cualquiera. mongosh exige el filtro.

## Recomendación
Usar `checkFilter` (rechaza `undefined`/`null`) en `findAndModify`, `_findAndUpdate` y `findOneAndDelete`, igual que en `deleteOne`.
