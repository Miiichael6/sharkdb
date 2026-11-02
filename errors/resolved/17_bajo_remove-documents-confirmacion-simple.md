# 17. Remove documents confirmacion simple

- **Severidad:** BAJO
- **Dónde:** src/shared/domain/destructiveActions.ts
- **Estado:** pendiente

## Problema
Eliminar documentos seleccionados pide solo una confirmación simple.

## Escenario de fallo
Supr y un clic eliminan documentos de producción.

## Recomendación
Pedir confirmación escribiendo, al menos en conexiones de producción o protegidas.
