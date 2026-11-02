# 21. Tipos que no sobreviven edicion

- **Severidad:** BAJO
- **Dónde:** src/features/shell/domain/bsonFormat.ts, src/features/shell/domain/bsonValue.ts, src/features/documents/domain/markIntegers.ts
- **Estado:** pendiente

## Problema
Algunos tipos no sobreviven a la edición.

## Escenario de fallo
Una regex con `/` o con opciones `x`/`l` da error al guardar; Symbol se convierte en String; `undefined` en `null`; un campo `__proto__` desaparece; una fecha fuera del rango de JS se muestra como `ISODate("Invalid Date")`. El cambio de orden de las claves numéricas está en el 24.

## Recomendación
Conservar esos tipos en el formato de edición.
