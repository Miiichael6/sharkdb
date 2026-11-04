# 52. Scripts del menú apuntan a otra colección si el nombre lleva `\`

- **Severidad:** BAJO
- **Dónde:** src/features/shell/domain/menuScripts.ts (`collectionExpr`)
- **Estado:** pendiente

## Problema
`collectionExpr` solo escapa `'`. Una colección `data\_old` genera `getCollection('data\_old')`, que en JS es `data_old`.

## Escenario de fallo
La plantilla de remove/update del menú, ejecutada tal cual, actúa sobre otra colección (`data_old`) si existe.

## Recomendación
Generar el literal con `JSON.stringify(coll)`.
