# 23 · Bases favoritas y temporales por conexión

**Estado:** ✅ Terminada (prueba manual en local pendiente del usuario)
**Fase:** 11 Bases fijadas · **Depende de:** 12, 22 · **Doc:** R42, R43, R44

## Objetivo
Al conectarse, el explorador ya no lista todas las bases: muestra solo las **favoritas** de la conexión (persistentes) y las **temporales** abiertas en esta ejecución (desaparecen al cerrar la app). Se eligen desde la ventana "Bases de datos", con una estrella por base y selección múltiple.

## Pasos

### Paso 1: Dominio y persistencia
- [x] `src/features/connections/domain/connection.ts`: campo `favoriteDatabases: string[]` en `MongoConnection` + migración en `migrate.ts` (las conexiones existentes empiezan con `[]`) (R42)
- [x] `src/features/explorer/domain/pinnedDatabases.ts` (nuevo, puro): `visibleDatabases(favorites, temporaries, existing)` (favoritas siempre, aunque ya no existan en el servidor → marcadas `missing`), `toggleFavorite`, `orderForDialog(all, favoritesAtOpen)` (favoritas al abrir arriba, el resto debajo, ambos alfabéticos por D10) (R42, R44)
- [x] Temporales por sesión en memoria (servicio de explorer, por id de conexión); nunca se persisten (R42)

### Paso 2: Explorador
- [x] `explorerService.ts`: el nodo de conexión expande a `visibleDatabases(...)` en vez de todo `listDatabases`; F5 solo refresca esas (R42)
- [x] Favorita que ya no existe en el servidor: atenuada con aviso, se puede desmarcar (R42)
- [x] Al conectar sin favoritas ni temporales: se abre la ventana "Bases de datos" en **modo obligatorio** (sin X ni Escape). **Cancelar** cierra la conexión y la quita del explorador (sigue registrada) (R43)
- [x] Servidor sin ninguna base: la ventana lo dice y ofrece **Crear base de datos** (el "Nueva…" que ya existe); la base creada queda abierta (R43)
- [x] Menú contextual de una base en el explorador: **Quitar de la lista** (no toca el servidor; si es favorita, también la desmarca) claramente separado de **Eliminar base de datos** (borra en el servidor): grupos distintos con separador, icono y texto propios, Eliminar con la confirmación roja de la tarea 25 (D11, R42)

### Paso 3: Ventana "Bases de datos"
- [x] `src/features/workspace/ui/OpenDatabaseDialog.tsx`: estrella por fila (marca/desmarca favorita al instante y persiste), selección múltiple (clic + Ctrl/Shift, casillas) y botón **Abrir (N)**; doble clic abre solo esa como temporal (R44)
- [x] El orden se calcula **una vez al abrir** la ventana (`orderForDialog`): marcar una estrella no mueve la fila; la próxima vez que se abra ya sale arriba (R44)
- [x] Solo actúa sobre la conexión seleccionada (clic en la conexión, no en sus bases o colecciones); deshabilitada con tooltip si no hay ninguna. Ctrl+K usa la misma lista y el mismo orden (R44)
- [x] Si crece de ~200 líneas: estado en `useOpenDatabaseForm.ts` y fila en `DatabaseChoiceRow.tsx`

### Paso 4: Tests
- [x] `pinnedDatabases.test.ts`: favoritas + temporales sin duplicar, favorita inexistente, orden congelado al abrir, alternar estrella
- [x] `migrate.test.ts` y `explorerService.test.ts`: conexión antigua sin campo → `[]`; expandir conexión devuelve solo las visibles

### Paso 5: Verificación
- [ ] Prueba real en MongoDB local: conexión nueva → ventana obligatoria; marcar 2 estrellas y abrir 1 temporal; reiniciar la app → quedan solo las 2 favoritas
- [ ] Cancelar en la ventana obligatoria cierra la conexión y desaparece del explorador; con un servidor vacío se ofrece crear base
- [ ] "Quitar de la lista" no borra nada en el servidor; "Eliminar base de datos" se ve distinto y pide confirmación
- [ ] La estrella no reordena mientras la ventana está abierta; al reabrirla las favoritas salen arriba
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y build pasan (no hay script de lint)
- [ ] Commit: `feat(explorer): bases favoritas y temporales por conexión` (propuesto, pendiente del usuario)

## Criterios de aceptación
- [ ] El explorador solo muestra favoritas (persisten entre reinicios) y temporales (se van al cerrar la app)
- [ ] Una conexión sin bases fijadas obliga a elegir al menos una (o crearla si no hay); Cancelar cierra la conexión y la quita del explorador
- [x] Quitar de la lista y Eliminar base de datos son inconfundibles
- [ ] Cada base del modal tiene estrella; se pueden abrir varias a la vez; el orden no salta mientras el modal está abierto

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: Favoritas y temporales viven en el servicio de explorer (las favoritas además se guardan en la conexión desde `useSavedConnections`); crear base va dentro de la propia ventana porque en modo obligatorio la sesión aún no está en el árbol.
- 2026-10-31: Ctrl+K (bases) lista todas las bases de las conexiones abiertas con el orden de la ventana; elegir una la abre como temporal y abre su shell. "Eliminar base de datos" mantiene la confirmación actual: la roja llega con la tarea 25.
- 2026-10-31: Cerrada con tsc, vitest (272) y build en verde; la prueba manual en MongoDB local (Paso 5, primeras 4 líneas, y criterios 1, 2 y 4) queda pendiente del usuario: no se pudo lanzar otra instancia de la app (puerto 1420 ocupado por la suya).
- 2026-10-31: Tras probarlo el usuario: admin/config/local no cuentan como elección (antes abrían la conexión con solo la carpeta System). Salen de la ventana, la carpeta System se ve siempre como en Robo 3T y no tiene "Quitar de la lista".
