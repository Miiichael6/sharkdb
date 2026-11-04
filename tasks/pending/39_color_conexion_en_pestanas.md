# 39 · Franja de color de la conexión en las pestañas

**Estado:** ⬜ Pendiente
**Fase:** 24 Pestañas por conexión · **Depende de:** 26 · **Doc:** R85–R88

## Objetivo
Cada pestaña del shell lleva una franja fina (2–3 px) con el `color` de su conexión, para saber de un vistazo dónde se va a ejecutar. Producción y las conexiones protegidas llevan además una señal fija que no depende del color elegido.

## Pasos

### Paso 1: Dominio (lógica pura + tests)
- [ ] `src/features/shell/domain/tabConnection.ts` (nuevo): `tabStripes(entry, connections)` → un `{ color, connectionName, guarded }` por panel de la entrada (1 o 2); `guarded` = `neverModified` o `protectedAmong` (reutilizar los de `connections/domain/connection.ts`, sin duplicarlos); conexión desconocida → sin franja (R85, R87)
- [ ] Tests: pestaña simple, dividida con la misma conexión (una franja), dividida con dos conexiones (dos tramos), conexión protegida, de producción y conexión borrada (R85–R87)

### Paso 2: UI
- [ ] `src/features/shell/ui/TabStripe.tsx` (nuevo): franja de 2–3 px en el borde superior de la pestaña, partida en dos tramos si los paneles son de conexiones distintas; color por variable CSS (`--tab-conn-color`), visible en temas claro y oscuro (R85, R86)
- [ ] `TabBar.tsx` / `TabFace.tsx`: solo enganchan `TabStripe`; el `title` de la pestaña dice el nombre de la conexión (y "protegida"/"producción" cuando aplique), así el color nunca es la única pista (R88)
- [ ] Conexión protegida o de producción: candado pequeño antes del título, el mismo ícono que ya usa el modo seguro (R87)
- [ ] `App.css`: estilos de la franja junto a los de `.tab-bar`, sin números sueltos (alto de la franja como variable)

### Paso 3: Verificación
- [ ] Prueba real: abrir pestañas de dos conexiones con colores distintos → cada una con su franja; cambiar el color en el formulario de la conexión → las pestañas abiertas se actualizan
- [ ] Pestaña dividida con dos conexiones → franja en dos tramos; con la misma conexión → un solo color
- [ ] Conexión de producción o protegida → candado además del color; el tooltip dice conexión y entorno
- [ ] Temas claro y oscuro: la franja se distingue y el texto de la pestaña no pierde contraste
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, typecheck y `vite build` pasan
- [ ] Commit: `feat(shell): franja con el color de la conexión en cada pestaña`
- **Cierre de Fase 24**

## Criterios de aceptación
- [ ] Toda pestaña muestra el color de su conexión como franja fina, sin teñir el fondo
- [ ] Una pestaña dividida entre dos conexiones muestra los dos colores
- [ ] Producción y las conexiones protegidas se reconocen aunque tengan un color "tranquilo"
- [ ] El tooltip de la pestaña nombra su conexión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Pedida por el usuario. Es la opción de franja fina (no fondo entero) elegida en la conversación; se usa `connection.color`, no el de la etiqueta, a diferencia de la barra que se descartó en la tarea 24.
