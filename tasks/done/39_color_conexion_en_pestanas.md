# 39 · Punto de color de la conexión en las pestañas

**Estado:** ✅ Terminada
**Fase:** 24 Pestañas por conexión · **Depende de:** 26 · **Doc:** R85–R88

## Objetivo
Cada pestaña del shell lleva un punto con el `color` de su conexión en su borde izquierdo (el título sigue centrado), para saber de un vistazo dónde se va a ejecutar. Producción y las conexiones protegidas llevan además una señal fija que no depende del color elegido.

## Pasos

### Paso 1: Dominio (lógica pura + tests)
- [x] `src/features/shell/domain/tabConnection.ts` (nuevo): `tabConnections(entry, connections)` → un `{ id, name, color, guard }` por panel de la entrada (1 o 2); `guard` = `neverModified` o `protectedAmong` (reutilizar los de `connections/domain/connection.ts`, sin duplicarlos); conexión desconocida → sin punto (R85, R87)
- [x] Tests: pestaña simple, dividida con la misma conexión (un punto), dividida con dos conexiones (dos puntos), conexión protegida, de producción y conexión borrada (R85–R87)

### Paso 2: UI
- [x] `src/features/shell/ui/TabConnectionDots.tsx` (nuevo): punto a la izquierda de la pestaña, dos puntos si los paneles son de conexiones distintas; color por variable CSS (`--tab-conn-color`), visible en temas claro y oscuro (R85, R86)
- [x] `TabBar.tsx` / `TabFace.tsx`: solo enganchan `TabConnectionDots`; el `title` de la pestaña dice el nombre de la conexión (y "protegida"/"producción" cuando aplique), así el color nunca es la única pista (R88)
- [x] Conexión protegida o de producción: candado pequeño antes del título, el mismo ícono que ya usa el modo seguro (R87)
- [x] `App.css`: estilos del punto junto a los de `.tab-bar`, sin números sueltos (tamaño y margen del punto como variables)

### Paso 3: Verificación
- [x] Prueba real: abrir pestañas de dos conexiones con colores distintos → cada una con su punto; cambiar el color en el formulario de la conexión → las pestañas abiertas se actualizan
- [x] Pestaña dividida con dos conexiones → dos puntos; con la misma conexión → un solo color
- [x] Conexión de producción o protegida → candado además del color; el tooltip dice conexión y entorno
- [x] Temas claro y oscuro: el punto se distingue y el texto de la pestaña no pierde contraste
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, typecheck y `vite build` pasan
- [ ] Commit: `feat(shell): punto con el color de la conexión en cada pestaña` (propuesto, pendiente del usuario)
- **Cierre de Fase 24**

## Criterios de aceptación
- [x] Toda pestaña muestra el color de su conexión como un punto a la izquierda, sin teñir el fondo ni descentrar el título
- [x] Una pestaña dividida entre dos conexiones muestra los dos colores (dos puntos)
- [x] Producción y las conexiones protegidas se reconocen aunque tengan un color "tranquilo"
- [x] El tooltip de la pestaña nombra su conexión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario. Es la opción de franja fina (no fondo entero) elegida en la conversación; se usa `connection.color`, no el de la etiqueta, a diferencia de la barra que se descartó en la tarea 24.
- 2026-11-04: `guard` es `"production" | "protected" | null` en vez de un booleano: el tooltip necesita decir cuál de los dos. El candado del modo seguro pasa a `shared/ui/LockIcon.tsx` para que barra y pestañas usen el mismo SVG.
- 2026-11-04: Cambio del usuario tras verla: la franja superior no le gustó → punto de color al borde izquierdo de la pestaña, fuera del flujo para que el título siga centrado; con dos conexiones, dos puntos juntos.
