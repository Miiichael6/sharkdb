# 43. `use x` solo dura la ejecución aunque imprime "switched to db x"

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/prelude/shell.js (`beginRun`, `use`), src-tauri/src/shell/session.rs
- **Estado:** resuelto — la pestaña sigue en la BD con la que acaba `db` (`use`, `db = db.getSiblingDB(...)`), como en mongosh. Antes se había descartado por imitar a Robo 3T, pero la cabecera seguía mostrando la BD vieja.

## Problema
`beginRun` reinicia `db` a la BD de la pestaña en cada ejecución; `use` solo cambia `db` hasta que termina esa ejecución (intencionado según tests/prelude.rs). El mensaje "switched to db x" sugiere lo contrario, y en mongosh el cambio se mantiene.

## Escenario de fallo
El usuario ejecuta la selección `use staging` y ve "switched to db staging". Luego ejecuta solo `db.orders.deleteMany({...})`: la escritura va a la BD de la pestaña (p. ej. prod).

## Recomendación
Persistir `use` en la pestaña (devolverlo en el `ScriptOutcome` y actualizar `tab.db`), o como mínimo cambiar el mensaje y avisar al inicio de la siguiente ejecución.

## Solución
`db` es un accesor global (shell.js) que anota en `__shell.dbName` el nombre de la BD a la que apunta; al acabar, el motor lo lee (sin ejecutar JS, vale aunque el script fallara o se cortara) y lo devuelve en `ScriptOutcome.db`. El frontend mueve la pestaña a esa BD (`switchTabDb`) y suelta su colección. Si `db` acaba siendo otra cosa o un nombre inválido, la pestaña no cambia.
