# 28. Quitar validacion sin confirmacion

- **Severidad:** BAJO
- **Dónde:** src/features/explorer/ui/ValidationWindow.tsx, src/features/documents/ui/DocumentEditorDialog.tsx
- **Estado:** pendiente

## Problema
«Quitar validación» se ejecuta sin confirmar. Escape cierra el editor de documentos y el de validación descartando los cambios sin avisar.

## Escenario de fallo
Un clic de más quita el validador de producción; pulsar Escape tras editar un documento largo pierde todo lo escrito.

## Recomendación
Confirmar «Quitar validación»; preguntar antes de cerrar si hay cambios sin guardar.
