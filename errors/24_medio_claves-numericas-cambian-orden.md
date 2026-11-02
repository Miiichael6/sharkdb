# 24. Claves numericas cambian orden

- **Severidad:** MEDIO
- **Dónde:** src/features/documents/domain/documentEdit.ts (`unchangedFilter`), src-tauri/src/shell/convert/to_bson.rs (`document()`), transporte por IPC como objeto JS
- **Estado:** pendiente

## Problema
JavaScript pone primero las claves que parecen enteros ("2024", "10"…) y las ordena. Los documentos viajan como objetos JS por IPC y por QuickJS, así que el orden original se pierde.

## Escenario de fallo
- Documento `{ _id: 1, nombre: "a", "2024": 5 }`: al guardar queda `{ "2024": 5, _id: 1, nombre: "a" }`, también en subdocumentos. Cambia la igualdad de subdocumentos en consultas (`{ meta: { … } }`).
- `unchangedFilter` compara con el documento reordenado y nunca coincide: siempre sale el aviso falso «Otro proceso modificó el documento».
- `sameKey` de índices puede dar un resultado equivocado con claves numéricas.

## Recomendación
Transportar los documentos como Extended JSON en texto (o lista de pares) y no como objeto JS; en QuickJS, construir el documento conservando el orden del texto.
