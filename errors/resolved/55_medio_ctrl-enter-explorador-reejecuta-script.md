# 55. Ctrl+Enter en una colección del explorador re-ejecuta el script editado de una pestaña (aunque sea una escritura)

- **Severidad:** MEDIO
- **Tipo:** implícito (el atajo se percibe como "ver documentos"; la pestaña elegida puede no estar visible)
- **Dónde:** src/features/explorer/ui/useTreeKeyboard.ts (`Enter` + Ctrl → `onRunCollection`), src/app/App.tsx (`tabs.runCollection(shellTab(node, true))`), src/features/shell/domain/tabs.ts (`runCollectionTab`), src/features/shell/ui/ShellTab.tsx (efecto de `runRequest` → `execute(tab.code)`), src/features/shell/ui/useShellTabs.ts (`tabForNode` pone `coll` también en las plantillas Update/Remove)
- **Estado:** resuelto — Ctrl+Enter / «View documents» solo reutiliza una pestaña de la colección cuyo código sigue siendo exactamente la consulta pedida; si no, abre una pestaña nueva con el `find`.
- **Relacionado:** #43 (resuelto: quita `coll` solo cuando el script cambia de BD, `tabs.ts`), #52

## Problema
`runCollectionTab` busca una pestaña con el mismo `sid`/`db`/`coll` (la activa o la primera) y, si existe, solo incrementa `runRequest`; `ShellTab` ejecuta entonces `tab.code`, es decir, **el código actual de esa pestaña**, no el `find` por defecto. La pestaña conserva `coll` aunque el usuario haya reescrito el script, y las plantillas "Update documents" / "Remove documents" (abiertas sin ejecutar) también llevan `coll`, así que también son candidatas.

## Escenario de fallo
1. Clic derecho en `orders` → "Remove documents"; se escribe `db.orders.deleteMany({status: "x"})` y no se ejecuta (o se cambia de pestaña).
2. Más tarde se selecciona `orders` en el árbol y se pulsa Ctrl+Enter para ver documentos.
3. Se activa esa pestaña y se ejecuta el `deleteMany`, sin confirmación.

Lo mismo con una pestaña "View documents" cuyo código se editó y ahora contiene escrituras.

## Recomendación
Reutilizar una pestaña solo si su `code` sigue siendo exactamente la consulta por defecto de esa colección; si no, abrir una pestaña nueva con el `find`. Como mínimo, nunca reutilizar pestañas abiertas desde plantillas de escritura.

## Solución
`runCollectionTab` (shell/domain/tabs.ts) solo reutiliza una pestaña con el mismo `sid`/`db`/`coll` si además su `code` es idéntico al de la consulta pedida (`init.code`). Una plantilla «Update/Remove documents», o una pestaña «View documents» cuyo script se editó, ya no es candidata: se abre una pestaña nueva con el `find` y lo que el usuario escribió en la otra no se ejecuta. Lo cubre el test «never reruns a tab on the collection whose code isn't the query asked for» (tabs.test.ts).
