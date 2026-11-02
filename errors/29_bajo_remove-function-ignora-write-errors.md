# 29. Remove function ignora write errors

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/infrastructure/commandMongoAdmin.ts (`exec`, `removeFunction`, `listFunctions`)
- **Estado:** pendiente

## Problema
`exec` no revisa `writeErrors` ni `n`. `removeFunction` borra de `system.js` con `{ _id: name }` (string). `listFunctions` solo lee el primer lote del cursor.

## Escenario de fallo
Una función con `_id` que no es string no se borra y aun así se muestra «Función eliminada». Con más de un lote de funciones, las siguientes no aparecen.

## Recomendación
Comprobar `writeErrors` y `n === 1` en las escrituras; usar el `_id` original; recorrer el cursor con `getMore`.
