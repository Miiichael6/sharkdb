# 08. Undefined en filtro es null

- **Severidad:** MEDIO
- **Dónde:** src-tauri/src/shell/convert/to_bson.rs (undefined → Bson::Null)
- **Estado:** resuelto

## Problema
Un valor `undefined` dentro de un filtro se convierte en `null`, y en MongoDB `{f:null}` también coincide con los documentos que no tienen el campo.

## Escenario de fallo
`deleteMany({tenant: varMalEscrita})` borra todos los documentos que no tienen `tenant`.

## Recomendación
Rechazar `undefined` en los filtros de delete y update, o al menos avisar antes de ejecutar.
