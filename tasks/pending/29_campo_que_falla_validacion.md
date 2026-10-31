# 29 · Decir qué campo falla la validación

**Estado:** ⬜ Pendiente
**Fase:** 14 Validación · **Depende de:** 27 · **Doc:** R54

## Objetivo
Cuando un insert o una edición fallan por la validación (código 121), el mensaje dice qué campo y qué regla no se cumplen. MongoDB 5.0+ lo trae en `errInfo.details`; en 4.2 no, así que la app lo comprueba contra el `$jsonSchema` de la colección.

## Pasos

### Paso 1: Comprobación propia del esquema
- [ ] `src/features/explorer/domain/schemaCheck.ts` (nuevo): comprueba un documento contra un `$jsonSchema` y devuelve `{ campo, problema }[]`; cubre `required`, `bsonType`/`type` (incl. `number`), `properties` anidados, `additionalProperties`, `minimum`/`maximum`, `minLength`/`maxLength`, `enum`, `pattern`, `items`; lo que no cubre se reporta como "no se pudo identificar el campo", nunca inventado + tests (R54)

### Paso 2: Mensaje en editor de documentos y shell
- [ ] `documentEdit.ts` (`writeFailure`): con `errInfo.details` (5.0+) lo resume; si no, lee la validación de la colección y usa `schemaCheck` como respaldo (R54)
- [ ] `prelude.js` (`checkWrite`): incluir `errInfo.details` cuando venga; en 4.2 indicar que el editor de documentos dice el campo (R54)

### Paso 3: Verificación
- [ ] Prueba real en local 4.2 con `Genero`: falta `Activo`, `Orden` negativo, `Activo: "si"`, campo `Extra`; cada uno nombra su campo
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck, `vite build` y `cargo check` pasan
- [ ] Commit: `feat(documents): decir qué campo falla la validación`

## Criterios de aceptación
- [ ] En 4.2 el error de validación lista cada campo que falla y por qué
- [ ] En 5.0+ se usa lo que devuelve el servidor
- [ ] Un esquema con reglas no cubiertas no produce un mensaje falso

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Pedida por el usuario al probar la 27: con 4.2 solo llega "Document failed validation".
