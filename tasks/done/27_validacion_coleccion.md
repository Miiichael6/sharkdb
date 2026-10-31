# 27 · Validación de documentos por colección (`$jsonSchema`)

**Estado:** ✅ Terminada
**Fase:** 14 Validación · **Depende de:** 13, 17, 18 · **Doc:** R51, R52

## Objetivo
Desde el menú contextual de una colección, abrir una sub-ventana **"Validación…"** donde se ve y se edita el `$jsonSchema` de la colección (JSON como el que se usa en SIGO), con controles para el nivel, la acción y los campos extra. Al guardar se aplica con `collMod`, y desde ese momento MongoDB rechaza (o avisa) las ediciones que no siguen el formato.

## Pasos

### Paso 1: Dominio puro
- [x] `src/features/explorer/domain/validation.ts` (nuevo, puro):
  - tipos `ValidationLevel = "moderate" | "strict"`, `ValidationAction = "error" | "warn"` y `ExtraFields = "rechazar" | "permitir"`;
  - `readValidation(options)` saca de `listCollections` lo que el servidor tiene de verdad, se haya puesto desde robo3B, desde un script o desde SIGO. Nivel y acción nunca quedan vacíos: si el servidor no los guarda, valen lo que MongoDB aplica por defecto, `strict` y `error`. Campos extra = `rechazar` si la raíz ya tiene `additionalProperties: false`;
  - si el `validator` trae algo más que `$jsonSchema` (operadores de consulta puestos por script, p. ej. `{ Estado: { $exists: true } }`), se muestra y se guarda **el validator completo** tal cual, sin perder nada;
  - `collModCommand(coll, esquema, nivel, accion, camposExtra)` arma el comando; con `"rechazar"` pone `additionalProperties: false` en cada objeto con `properties` y admite `_id` en la raíz (R51)

### Paso 2: Sub-ventana
- [x] `src/features/explorer/ui/ValidationWindow.tsx` (nuevo, vista `VALIDATION_VIEW`), con la misma base visual que las demás sub-ventanas de la tarea 18 (R51):
  - editor CodeMirror con el `$jsonSchema` actual, vacío si la colección no tiene; acepta la sintaxis del objeto pegado (claves sin comillas, comas finales);
  - opciones con **botón que alterna** (no interruptor), en `src/shared/ui/CycleButton.tsx` (nuevo, genérico: valores, colores y `onChange`): una píldora redondeada que muestra el valor actual con su color; al hacer clic pasa al otro valor y cambia texto y color. Para que se entienda que se puede pulsar lleva un icono de flechas circulares (⟳), cursor de mano, un hover que la aclara y `title` con el valor al que cambiará ("Clic para cambiar a strict"):
    - Nivel `[moderate]` (ámbar) ⇄ `[strict]` (rojo), siempre con el valor real de la colección;
    - Acción `[error]` (rojo) ⇄ `[warn]` (ámbar), igual que el nivel: MongoDB 4.2 solo tiene esas dos y nunca queda vacía;
    - Campos extra `[rechazar]` (rojo) ⇄ `[permitir]` (verde);
  - botones **Quitar validación** (`validator: {}`), Cancelar y Guardar.
- [x] Cada botón lleva debajo una línea que explica la opción elegida, p. ej. "strict: valida todo insert y update" o "moderate: los documentos viejos que ya no cumplen se pueden seguir editando".

### Paso 3: Integración
- [x] `explorerMenu.tsx`: opción "Validación…" en el menú de colección, en el grupo de índices; `useExplorerActions.ts` + `explorerService.ts`: leer con `listCollections({ name })` y aplicar con `runCommand(collModCommand(...))` (R51)
- [x] Safe mode activo → Guardar y Quitar deshabilitados, con el motivo; un error del servidor (esquema inválido, sin permiso) se muestra en la sub-ventana sin cerrarla (R52)
- [x] Al guardar un documento que no cumple (editor de documentos, shell), el mensaje `Document failed validation` se muestra claro; en 4.2 no dice qué campo falla (R52)

### Paso 4: Tests
- [x] `validation.test.ts`: leer opciones con y sin validador, sin nivel/acción guardados (→ `strict`/`error`), con un validator de script que mezcla `$jsonSchema` y operadores (se conserva entero); armar `collMod` con cada nivel/acción, `"rechazar"` cierra la raíz y los objetos anidados y admite `_id`, `"permitir"` no cambia el esquema

### Paso 5: Verificación
- [x] Prueba real **solo en MongoDB local** (nunca prod): aplicar el esquema de `Genero` en `moderate` + `error` + `rechazar`. Comprobar que:
  - editar un documento quitando un campo obligatorio da error;
  - agregar un campo extra da error;
  - una edición correcta pasa;
  - en `warn`, las tres ediciones pasan.
- [x] `npm test`, typecheck y `cargo check` pasan
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] Commit: `feat(explorer): validación $jsonSchema por colección`
- [x] **Cierre de Fase 14**: `npm run tauri dev` arranca

## Criterios de aceptación
- [x] "Validación…" muestra el esquema, el nivel y la acción que la colección tiene de verdad en el servidor, también si se pusieron con un script (`db.runCommand({ collMod… })` desde la shell)
- [x] Los tres botones alternan su valor con un clic (texto y color) y se ven pulsables sin explicación
- [x] Lo elegido es lo que queda en la colección: al reabrir la sub-ventana se ven el mismo esquema y los mismos valores
- [x] Con la validación en `error`, una edición fuera de formato se rechaza con un mensaje visible; en `warn` pasa
- [x] Con safe mode activo no se puede aplicar ni quitar

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Planificada con el usuario: botones redondos que alternan con un clic (no interruptores); se muestra lo que el servidor tiene, aunque lo haya puesto un script; nivel y acción vacíos = `strict`/`error`, los valores por defecto de MongoDB.
- 2026-10-31: A pedido del usuario es ventana del sistema (`openModalWindow`, solo maximizar y cerrar) que guarda por sí misma, como el editor de documentos; el error queda en ella. "permitir" además quita los `additionalProperties: false` que hubiera, para que al reabrir se vea lo elegido.
- 2026-10-31: Prueba en MongoDB 4.2 local con el `collMod` que arma el dominio: en `error`, quitar un campo obligatorio y añadir un campo extra dan 121 y la edición correcta pasa; en `warn` pasan las tres. La sub-ventana no se puede manejar desde aquí y `tauri dev` no arrancó porque el puerto 1420 lo ocupa tu instancia: se verificó con `vite build`; prueba en la UI pendiente del usuario.
- 2026-10-31: El usuario probó la sub-ventana en la UI con la app arrancada y la dio por terminada; cierra la Fase 14.
