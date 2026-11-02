# 14. Edicion sin control concurrencia

- **Severidad:** MEDIO
- **Dónde:** src/features/documents/application/documentService.ts, src/features/documents/infrastructure/commandDocumentStore.ts
- **Estado:** pendiente

## Problema
Al guardar una edición se reemplaza con filtro `{_id}` y se parte del documento mostrado, sin volver a leerlo ni comprobar si cambió.

## Escenario de fallo
Si otro proceso modifica el documento mientras lo editas, tu guardado pisa su cambio (lost update).

## Recomendación
Filtrar por el documento original completo (o por un campo de versión) y mostrar un aviso de conflicto si `matched = 0`.
