# 25. Copiar coleccion pierde opciones

- **Severidad:** MEDIO
- **Dónde:** src/features/explorer/domain/copySpec.ts (`$out`), src/features/explorer/application/explorerService.ts (`copyCollection` / `duplicateCollection`)
- **Estado:** pendiente

## Problema
`$out` a un destino nuevo crea una colección normal: sin validador, sin collation por defecto, sin capped ni clustered. Restore y sync sí conservan esas opciones.

## Escenario de fallo
Duplicar una colección con `$jsonSchema` y collation insensible a mayúsculas: la copia acepta cualquier documento y compara distinguiendo mayúsculas.

## Recomendación
Leer las opciones con `listCollections` y crear el destino con `create` (mismas opciones) antes del `$out`, o insertar sin validar y aplicar el validador con `collMod` al final.
