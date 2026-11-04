# 51. Reintentar un insert puede duplicar el documento

- **Severidad:** BAJO
- **Dónde:** src/features/documents/ui/DocumentEditorWindow.tsx, src/features/documents/infrastructure/commandDocumentStore.ts
- **Estado:** pendiente

## Problema
Si se pierde la respuesta del insert (timeout o red), el editor sigue abierto con el error. Al pulsar "Insertar" otra vez, el servidor genera otro `_id`.

## Escenario de fallo
El primer insert sí llegó; el reintento crea un segundo documento idéntico salvo el `_id`.

## Recomendación
Generar el `_id` (ObjectId) en el cliente una vez por apertura del editor si el texto no lo trae; el reintento fallará con duplicate key en vez de duplicar.
