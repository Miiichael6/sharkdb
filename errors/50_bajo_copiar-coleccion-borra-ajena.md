# 50. Copia fallida puede borrar una colección creada por otro proceso

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/application/explorerService.ts (`buildCopy`, catch con `dropCollection(target)`)
- **Estado:** pendiente

## Problema
`copyTargetExists` consulta `listCollections` antes de crear el destino. Si otro proceso lo crea entre la comprobación y el `create`, este falla con NamespaceExists y el catch borra la colección ajena.

## Escenario de fallo
Carrera de milisegundos con otro cliente creando la misma colección: se pierde la colección del otro proceso.

## Recomendación
Borrar el destino en el catch solo si esta copia llegó a crearlo (marcar tras `createCollection`/`$out` correctos).
