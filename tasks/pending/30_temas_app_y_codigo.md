# 30 · Temas de color para la aplicación y para el código

**Estado:** ⬜ Pendiente
**Fase:** 16 Temas · **Depende de:** – (el "tema" de las preferencias de 08 pasa a esta tarea) · **Doc:** R55, R56

## Objetivo
En Configuración (la tuerca) se elige el **tema de la aplicación** y, por separado, el **tema del código**. Hoy hay una sola opción de cada uno: Claro/Oscuro (`src/shared/ui/theme.ts`) para la app y Monokai Vibrant (`src/shared/ui/monokaiVibrant.ts`) para el código. El tema del código lo usan el editor del shell, "Ver documento" y las vistas JSON del panel de detalles (`.detail-code`).

## Pasos

### Paso 1: Catálogo de temas (dominio)
- [ ] `src/shared/domain/themes.ts`: catálogo puro con `APP_THEMES` y `CODE_THEMES` (id, nombre, `dark: boolean`). Los temas actuales se mantienen como una opción más de cada lista (R55, R56). Según D14:
  - Aplicación: Oscuro (actual), Claro (actual), Según el sistema, Nord, Solarized claro, Dracula
  - Código: Monokai Vibrant (actual), One Dark, GitHub claro, Dracula, Solarized oscuro
- [ ] Mantener "Según el sistema" como opción de la app (elige el claro o el oscuro por defecto)
- [ ] Test de dominio: ids únicos, tema por defecto válido, id guardado desconocido → por defecto

### Paso 2: Paletas en CSS
- [ ] `src/app/themes/app-<id>.css`: un archivo por tema de la app con sus variables (`--bg`, `--surface`, `--text`, `--accent`…), bajo `:root[data-theme="<id>"]`. Se sacan de `App.css` las dos paletas actuales (`:root` y `:root[data-theme="light"]`)
- [ ] `src/app/themes/code-<id>.css`: un archivo por tema del código con sus `--syn-*`, bajo `[data-code-theme="<id>"]`. Se sacan de `App.css` el Monokai actual y el bloque que fuerza el oscuro en `.document-editor`, `.validation-editor` y `.detail-code`
- [ ] `monokaiVibrant.ts` → `codeTheme.ts`: la extensión de CodeMirror solo lee `--syn-*`. Se quitan `alwaysDark` y el parámetro dark/light: el tema del código decide

### Paso 3: Aplicar y guardar la elección
- [ ] `src/shared/ui/theme.ts`: `data-theme` toma el id del tema de la app y `data-code-theme` el del código. Los dos se guardan en `localStorage` (como hoy) y se aplican al arrancar y en las ventanas modales. La barra de título nativa sigue el `dark` del tema de la app
- [ ] `settingsMenu.tsx`: el menú de la tuerca queda con una sola entrada **"Tema…"** (sin submenús) que abre la sub-ventana del paso 4

### Paso 4: Sub-ventana "Tema"
- [ ] `src/features/workspace/ui/ThemeDialog.tsx`: ventana modal propia (como "Bases de datos", con `openModalWindow`). Tiene dos listas, **Aplicación** y **Código**, cada una con el tema activo marcado y navegable con flechas
- [ ] Vista previa en la misma ventana: un fragmento de shell (`db.coll.find({ … })` con `ObjectId`, `ISODate`, números, strings y un comentario) en el `CodeEditor` de solo lectura con el tema del código elegido. Un trozo de la interfaz (barra, fila seleccionada, botón primario) muestra el tema de la app
- [ ] Al elegir, la vista previa cambia al momento. **Aplicar** guarda y aplica a todas las ventanas abiertas; **Cancelar**/Escape cierra sin cambiar nada

### Paso 5: Verificación
- [ ] Prueba real: abrir "Tema…" desde la tuerca, probar cada tema en la vista previa, Cancelar no cambia nada y Aplicar sí. Después Se ven bien la ventana principal, una ventana modal ("Bases de datos"), el editor del shell, "Ver documento", Info del host y la vista árbol/tabla/texto. Contraste legible en todos
- [ ] Prueba real: reiniciar la app conserva los dos temas; un valor guardado desconocido vuelve al tema por defecto sin romper nada
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] Tests / typecheck / lint pasan
- [ ] Commit: `feat(themes): temas de color para la aplicación y el código`

## Criterios de aceptación
- [ ] La tuerca tiene una sola entrada "Tema…" que abre una sub-ventana donde se eligen por separado el tema de la aplicación y el del código. Los actuales siguen disponibles
- [ ] La sub-ventana muestra una vista previa del código y de la interfaz que cambia al elegir, antes de Aplicar
- [ ] El tema del código se aplica igual en el shell, "Ver documento" y las vistas JSON del panel de detalles
- [ ] La elección persiste entre reinicios y se aplica también en las ventanas modales
- [ ] Añadir un tema nuevo es crear su archivo CSS y una entrada en el catálogo, sin tocar componentes

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-10-31: D14 aceptada tal cual; el menú de la tuerca queda en una sola entrada "Tema…" con sub-ventana y vista previa (pedido del usuario).
