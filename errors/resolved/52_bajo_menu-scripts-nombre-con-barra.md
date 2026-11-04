# 52. Scripts del menú apuntan a otra colección si el nombre lleva `\`

- **Severidad:** BAJO
- **Dónde:** src/features/shell/domain/menuScripts.ts (`collectionExpr`)
- **Estado:** resuelto — `collectionExpr` genera el literal con `JSON.stringify` (escapa `\` y caracteres de control) manteniendo comillas simples. Test: `menuScripts.test.ts` (`escapes backslashes so the literal still names the same collection`, evalúa el literal y comprueba que da el mismo nombre).

## Problema
`collectionExpr` solo escapa `'`. Una colección `data\_old` genera `getCollection('data\_old')`, que en JS es `data_old`.

## Escenario de fallo
La plantilla de remove/update del menú, ejecutada tal cual, actúa sobre otra colección (`data_old`) si existe.

## Recomendación
Generar el literal con `JSON.stringify(coll)`.
