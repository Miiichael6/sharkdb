# Tareas: SharkDB (antes Robo3B; clon de Robo 3T sobre Tauri + React)

Documento fuente: no hay spec escrita; el alcance es la paridad funcional con Robo 3T (lista de requisitos **R1…R20** en la tabla de cobertura). Punto de partida: ya existen gestor de conexiones, árbol del explorador y operaciones de administración (`src/features/connections`, `src/features/explorer`, `src-tauri/src/mongo.rs`).

## Cómo se usa

- Cada archivo `NN_nombre.md` es una tarea. Se hacen **en orden numérico** salvo que las dependencias digan otra cosa.
- Cada tarea tiene un **Estado** general y una lista de **pasos** con casilla.
- Al marcar un paso: `- [ ]` → `- [x]`.
- Solo si una tarea es **muy compleja** (no es lo habitual), se **subdivide** en `NN.1_nombre.md`, `NN.2_nombre.md`... Cada subtarea enlaza a su padre (`**Tarea padre:**`) y la padre las lista en su sección `## Subtareas`. La padre no se cierra hasta que todas sus subtareas estén ✅.
- Al cerrar cada **fase**, la app debe arrancar (`npm run tauri dev`) y se hace commit.
- En la sección **Bitácora** de cada archivo se anotan, de forma resumida (1 a 3 líneas), decisiones no obvias, problemas y fecha de cierre.
- Cada archivo vive en la carpeta que corresponde a su estado, y al moverlo se actualiza su enlace y su estado en el **Tablero** (y en la padre, si es subtarea):

  | Carpeta | Cuándo |
  |---|---|
  | [pending/](pending/) | Tarea no iniciada (⬜) o bloqueada (⛔) |
  | [in_progress/](in_progress/) | Al **empezar** a trabajarla (🔄). Solo una familia a la vez (padre + su subtarea activa) |
  | [done/](done/) | Al **terminarla** (✅), con todos sus pasos, criterios y subtareas cumplidos |

## Arquitectura obligatoria (aplica a toda tarea)

Todo componente, vista y servicio nuevo o modificado sigue **arquitectura hexagonal (puertos y adaptadores)** y buenas prácticas. Una tarea no se cierra si su código no cumple esta sección.

### Capas por feature (`src/features/<feature>/`)

| Capa | Contiene | Puede importar |
|---|---|---|
| `domain/` | Tipos, reglas y funciones puras (sin IO, sin React, sin Tauri) | solo `domain/` y `src/shared/domain` |
| `application/` | Casos de uso / servicios (`create<X>Service`) y **puertos** (`ports.ts`: interfaces que necesita) | `domain/` |
| `infrastructure/` | **Adaptadores** que implementan los puertos (`tauri<X>Gateway.ts` con `invoke`, ficheros, eventos) | `application/` (puertos), `domain/`, `src/shared/infrastructure` |
| `ui/` | Vistas y componentes React + hooks de presentación | `application/` (vía `useServices()`), `domain/` |

- **La dependencia va siempre hacia dentro**: `ui` → `application` → `domain`; `infrastructure` implementa puertos de `application`. `domain` y `application` nunca importan React, `@tauri-apps/*` ni nada de `infrastructure`.
- **La UI nunca llama a `invoke`** ni conoce Tauri: usa los servicios que expone `useServices()`.
- **Raíz de composición única**: los adaptadores se instancian y se inyectan en los servicios solo en `src/app/services.tsx`. Así los servicios se testean con adaptadores falsos.
- **Entre features** solo se importa `domain/` o el servicio público de la otra feature, nunca su `ui/` interna ni su `infrastructure/`.
- **Backend Rust (`src-tauri/src/`)** es un adaptador: los `#[tauri::command]` son finos (validan, delegan y convierten errores); la lógica va en módulos propios testeables sin Tauri.

### Buenas prácticas en componentes y vistas

- **Vista = composición**: un componente de vista orquesta componentes hijos y hooks; no contiene lógica de negocio ni transformaciones de datos (eso va en `domain/` o en un hook).
- **Estado y efectos en hooks** (`useX.ts`) separados del JSX; el componente queda declarativo.
- **Un componente por archivo**, nombre en PascalCase igual al archivo; si pasa de ~200 líneas o mezcla dos responsabilidades, se divide en el momento.
- **Props tipadas** con `interface Props`, sin `any` (salvo `Doc` de Mongo); callbacks con nombre de evento (`onSave`, `onCancel`).
- **Reutilizar** lo que ya hay en `src/shared/ui` (diálogos, `ConfirmDialog`, `SplitPane`…) antes de crear uno nuevo; lo genérico entre features va a `src/shared/`.
- **Accesibilidad básica**: roles ARIA en árboles/menús/pestañas, navegación por teclado, `label` en cada campo.
- **Sin strings ni números mágicos** repartidos: constantes en `domain/`; textos de la UI en español y coherentes.
- **Tests**: toda función de `domain/` y todo servicio de `application/` nuevos llevan test (vitest con adaptadores falsos).

### Leyenda de estados

| Estado | Significado |
|---|---|
| ⬜ Pendiente | No iniciada |
| 🔄 En progreso | Se está trabajando |
| ✅ Terminada | Todos los pasos, criterios y subtareas cumplidos |
| ⛔ Bloqueada | Espera una decisión o a otra tarea |

## Decisiones pendientes (bloquean tareas)

- [x] **D1** ¿Cómo se ejecuta el shell? → **Motor JS embebido (QuickJS vía `rquickjs`) en el backend Rust**, con API `db`/colección/cursor propia; scripts JS completos como Robo 3T (2026-10-30) → afecta 02, 03
- [x] **D2** ¿Qué formato de documento se muestra en la vista texto? → **Estilo shell** como Robo 3T: `ObjectId("…")`, `ISODate("…")`, `NumberLong(…)`; al editar se acepta sintaxis de shell (2026-10-30) → afecta 05
- [x] **D3** ¿Túneles SSH? → **Sí, con contraseña o clave privada (con passphrase opcional)**, como Robo 3T (2026-10-30) → afecta 07
- [x] **D4** ¿Plataformas y formato de instalador? → solo Windows NSIS por ahora; configuración preparada para macOS/Linux a futuro (2026-11-01)
- [x] **D5** Safe mode → **interruptor de solo lectura**: activo, ninguna escritura llega a la BD (scripts del shell ni acciones manuales: árbol, CRUD, restore, sync); solo lecturas (2026-10-30) → afecta 13
- [x] **D6** Backup/restore → **nativo en Rust con formato compatible con `mongodump`** (`<colección>.bson` + `<colección>.metadata.json`): sin dependencias que instalar, usa la misma conexión de la app (SSH/TLS de 07), progreso y cancelación propios, restaurable también con `mongorestore` (2026-10-30) → afecta 14
- [x] **D7** Sync database → **restaurar entre entornos (p. ej. prod → QA) una BD completa o colecciones sueltas** (reemplaza el contenido del destino). Las conexiones se pueden marcar **protegidas** (prod): nunca son destino de restore/sync y abren con safe mode activo. El diálogo muestra siempre, de forma destacada, cuál es el origen y cuál el destino que se va a modificar (2026-10-30) → afecta 13, 15
- [x] **D9** Flujo de operaciones de datos (aprobado por el usuario, 2026-10-30) → afecta 20, 21, 22:
  - Sync, backup y restore usan **las mismas piezas**: sub-ventana de selección (origen → destino, selector multi-BD) → **Continuar** → sub-ventana "Se va a MODIFICAR" donde se escribe **`confirmo`**. Las tres la piden, también el backup (cambio del usuario, 2026-10-30).
  - El trabajo corre en **segundo plano** en un **panel lateral derecho "Operaciones"** con secciones Sync, Backup y Restore, con %. Cancelar se confirma en una sub-ventana.
  - Origen y destino salen de **todas las conexiones registradas** (todas MongoDB); las cerradas se conectan al elegirlas. Producción/protegidas nunca son destino, y la conexión elegida en un select se quita del otro.
  - "Clonar" no es una operación aparte: entre conexiones es el sync; dentro de la misma conexión es "Copiar colección" (09).
- [x] **D10** Orden de las favoritas → **alfabético** (al usuario le da igual, 2026-10-31) → afecta 23
- [x] **D11** Quitar una base de la lista → **sí, "Quitar de la lista"** en el menú contextual, inconfundible con "Eliminar base de datos" (grupo, icono y color distintos) (2026-10-31) → afecta 23
- [x] **D12** Nivel de confirmación de cada borrado manual, aprobada por el usuario (2026-10-31), con icono de alerta en la cabecera → afecta 25:
  - **Rojo + `confirmo`**: eliminar base de datos, eliminar colección, eliminar todos los documentos, eliminar usuario, eliminar índice.
  - **Rojo, sin escribir**: eliminar documentos seleccionados (se usa a menudo), eliminar conexión registrada (no toca el servidor).
  - **Sin rojo** (no borran datos): renombrar colección, reconstruir índices, editar índice, quitar base de la lista (23).
- [x] **D13** Shell en paralelo → **pestaña dividida como en file-manager**, aprobada por el usuario (2026-10-31) → afecta 26:
  - Como en **file-manager**: una **pestaña dividida** con dos paneles (izquierdo y derecho), que en la barra se ve como una sola pestaña `A | B`; no hay dos barras de pestañas.
  - Se divide **arrastrando** una pestaña sobre el área del shell (vista previa del lado); se separa con **"Separar pestaña"** en su menú.
  - Divisor arrastrable; en ventana estrecha solo se ve el panel activo. El panel de detalles del explorador no se divide.
- [x] **D14** Temas incluidos → **la propuesta, aceptada por el usuario** (2026-10-31); los actuales se quedan como una opción más → afecta 30:
  - **Aplicación**: Oscuro (actual), Claro (actual), Según el sistema, y además Nord, Solarized claro, Dracula, Monokai, Monokai Pro y Monokai Pro (Machine) (añadidos a pedido del usuario).
  - **Código y vistas JSON**: Monokai Vibrant (actual), One Dark, Claro (a juego con el Claro de la aplicación), GitHub claro, Dracula, Solarized oscuro, Monokai, Monokai Pro y Monokai Pro (Machine) (añadidos a pedido del usuario).
- [x] **D15** Backups programados → **solo con la app abierta**; si al abrirla ya pasó la hora del día, se ejecuta entonces. Sin arranque automático de Windows (2026-10-31) → afecta 32
- [x] **D16** Carpeta de cada ejecución → **fechada** `<carpeta>/<nombre>/<AAAA-MM-DD_HHMM>`, conservando las **últimas 7** (se borran las más viejas) (2026-10-31) → afecta 31, 32
- [x] **D17** Confirmación de las programaciones → `confirmo` **una sola vez al guardar**; ni la ejecución diaria ni el ▶ manual vuelven a pedirlo (2026-10-31) → afecta 31
- [x] **D18** Actualizador → **GitHub Releases del repo público `Miiichael6/sharkdb`**; endpoint `releases/latest/download/latest.json` (2026-11-01) → afecta 37
- [x] **D19** Edición en línea → **solo string, números (Int32, Int64, Double, Decimal128) y booleanos**; null, fechas y ObjectId no se editan en línea (2026-11-04) → afecta 38
- [x] **D20** Edición en línea → **el tipo no puede cambiar**: un valor de otro tipo se marca como error y no se guarda. No aplica al editor de documentos (06), que sigue libre salvo la validación de la colección (2026-11-04) → afecta 38
- [x] **D21** Edición en línea → **solo en la vista árbol** (2026-11-04) → afecta 38
- [x] **D22** Edición en línea → **Esc cancela** y deja el valor original. Clic fuera (otro documento, el explorador, otra pestaña o fuera de la ventana) → sub-ventana "Estás editando un campo" con **Seguir editando** (devuelve el foco) y **Descartar cambios** (2026-11-04) → afecta 38
- [x] **D23** Detalle de operaciones: estados y colores de cada colección → **aceptada la propuesta**: ○ gris `Pendiente` (en cola, 0 %) · ● azul con pulso `En curso` · ● ámbar `Copiada, se aplica al final` (solo sync/restore: el destino se reemplaza cuando terminan todas) · ● verde `Aplicada` / `Guardada` (100 %) · ● rojo `Error` (con el motivo) · ○ gris hueco con % tachado `Descartada` (cancelada o fallida: el destino quedó como estaba). Restore con `_id` duplicados: verde con "⚠ N duplicados" (2026-11-04) → afecta 40, 41
- [x] **D24** Detalle de operaciones: ¿cómo se abre? → **en una sub-ventana** al hacer clic (o Enter) en la fila del panel; se actualiza en vivo mientras la operación corre (2026-11-04) → afecta 41
- [x] **D25** Sync de documentos: si el documento ya existe en el destino (mismo `_id`) → **se reemplaza entero (upsert por `_id`)**; si no existe la BD o colección en el destino, se crea (2026-11-11) → afecta 42
- [x] **D26** Sync de documentos, aprobada por el usuario (2026-11-11) → afecta 42:
  - **Solo hacia un entorno de menor nivel**, nunca el mismo nivel ni hacia arriba. Niveles por etiqueta: `production` (3) → `testing`/`staging` = QA (2) → `local`/`development` (1). Permitido: prod → QA, prod → local, QA → local. Prohibido: QA → prod, local → QA, QA → QA, local → local. Las protegidas siguen sin ser nunca destino.
  - Entrada **solo desde el visor** (opción a): menú contextual de los documentos seleccionados, "Sincronizar con otro entorno…". Va a la **misma BD y colección** del destino.
  - El documento se lee **completo desde la BD por `_id`**, nunca lo que muestra el visor (que puede venir de un `find` con proyección o de un `aggregate` con `$project`).
  - La confirmación muestra **cada documento completo** junto con su conexión, BD y colección de origen y destino, y pide escribir **`confirmo`**.
- [x] **D27** Reintentar operaciones → **aceptada la propuesta** (2026-11-11): ⟳ en sync, backup, restore y sync de documentos (42) **fallidas o canceladas**; relanza **toda** la petición original (el destino quedó como estaba, D23); sub-ventana corta "Reintentar origen → destino" **sin escribir `confirmo`** (ya se confirmó al lanzarla, como D17). Hoy no existe: lo implementa 43 → afecta 43
- [x] **D8** Servidor MCP → **descartado por el usuario**: se quitó el servidor MCP y el chat con Claude (2026-11-07) → afecta 16

## Tablero

| # | Tarea | Fase | Depende de | Estado |
|---|---|---|---|---|
| 01 | [Base de tests y orden del Workspace](done/01_base_tests_y_workspace.md) | 1 Base | – | ✅ Terminada |
| 02 | [Motor JavaScript embebido y tipos BSON](done/02_parser_shell.md) | 2 Motor | 01 | ✅ Terminada |
| 03 | [API de shell (db, colecciones, cursores) y ejecución](done/03_ejecucion_cursores.md) | 2 Motor | 02 | ✅ Terminada |
| 04 | [Pestañas de shell con editor y autocompletado](done/04_pestanas_shell_editor.md) | 3 Shell | 03 | ✅ Terminada |
| 05 | [Visor de resultados: árbol, tabla y texto](done/05_visor_resultados.md) | 3 Shell | 04 | ✅ Terminada |
| 06 | [CRUD de documentos](done/06_crud_documentos.md) | 4 Datos | 05 | ✅ Terminada (criterios 2–3 pendientes de prueba manual en la UI) |
| 07 | [Conexión avanzada: SSH, TLS y réplicas](done/07_conexion_avanzada.md) | 5 Conexión | 01 | ✅ Terminada |
| 08 | [Preferencias y empaquetado](done/08_preferencias_empaquetado.md) | 6 Cierre | 06, 07, 11 | ✅ Terminada (instalador sin probar en máquina limpia) |
| 09 | [Administración: usuarios y copia de colecciones](done/09_administracion_usuarios_copia.md) | 7 Administración | 01 | ✅ Terminada (prueba manual pendiente en la UI) |
| 10 | [Crear y editar funciones guardadas](pending/10_funciones_guardadas.md) | 7 Administración | 04 | ⬜ Pendiente (opcional) |
| 11 | [Barra de herramientas del workspace](done/11_barra_herramientas.md) | 8 Barra de herramientas | 04 | ✅ Terminada |
| 12 | [Apertura rápida y acciones rápidas de BD](done/12_apertura_rapida_y_acciones.md) | 8 Barra de herramientas | 11 | ✅ Terminada (prueba manual pendiente en la UI) |
| 13 | [Safe mode y centro de notificaciones](done/13_safe_mode_notificaciones.md) | 8 Barra de herramientas | 06, 11 | ✅ Terminada (prueba manual pendiente en la UI) |
| 14 | [Backup y restore de base de datos](done/14_backup_restore.md) | 9 Operaciones de BD | 12, 13 | ✅ Terminada (prueba manual pendiente en la UI) |
| 15 | [Sincronizar entre entornos](done/15_sincronizar_bd.md) | 9 Operaciones de BD | 09, 14 | ✅ Terminada (prueba manual pendiente en la UI) |
| 16 | [Servidor MCP y actividad MCP](pending/16_servidor_mcp.md) | 10 MCP | 13 | ❌ Descartada (el usuario ya no quiere el MCP) |
| 17 | [Menú contextual completo de colección](done/17_menu_coleccion.md) | 7 Administración | 09, 13 | ✅ Terminada (prueba manual pendiente en la UI) |
| 18 | [Confirmaciones en ventanas modales](done/18_ventanas_confirmacion.md) | 8 Barra de herramientas | 12 | ✅ Terminada (prueba manual pendiente) |
| 19 | [Menús de índices y conexión como Robo 3T](done/19_menus_indices_conexion.md) | 7 Administración | 17, 18 | ✅ Terminada (prueba manual pendiente) |
| 20 | [Panel de operaciones en segundo plano](done/20_panel_operaciones.md) | 9 Operaciones de BD | 15 | ✅ Terminada |
| 21 | [Sync en dos pasos: selección y confirmación](done/21_sync_dos_pasos.md) | 9 Operaciones de BD | 20 | ✅ Terminada |
| 22 | [Backup y restore con el mismo flujo que el sync](done/22_backup_restore_como_sync.md) | 9 Operaciones de BD | 21 | ✅ Terminada (prueba manual en QA pendiente) |
| 23 | [Bases favoritas y temporales por conexión](done/23_bases_favoritas.md) | 11 Bases fijadas | 12, 22 | ✅ Terminada (prueba manual pendiente) |
| 24 | [Título de ventana y color de la conexión activa](done/24_titulo_y_color_conexion.md) | 11 Bases fijadas | 23 | ✅ Terminada (prueba manual pendiente) |
| 25 | [Confirmación roja con `confirmo` para borrados manuales](done/25_confirmacion_destructiva.md) | 12 Operaciones destructivas | 18, 21 | ✅ Terminada |
| 26 | [Dos consultas del shell en paralelo (pestaña dividida)](done/26_shell_en_paralelo.md) | 13 Shell en paralelo | 04, 05 | ✅ Terminada |
| 27 | [Validación de documentos por colección (`$jsonSchema`)](done/27_validacion_coleccion.md) | 14 Validación | 13, 17, 18 | ✅ Terminada |
| 28 | [Filtrar colecciones del árbol escribiendo](done/28_filtro_colecciones.md) | 15 Explorador | 23 | ✅ Terminada |
| 29 | [Decir qué campo falla la validación](pending/29_campo_que_falla_validacion.md) | 14 Validación | 27 | ⬜ Pendiente |
| 30 | [Temas de color para la aplicación y el código](done/30_temas_app_y_codigo.md) | 16 Temas | – | ✅ Terminada |
| 31 | [Backups programados: lista y formulario como TablePlus](done/31_backups_programados.md) | 17 Backups programados | 22 | ✅ Terminada |
| 32 | [Ejecución automática de los backups programados](done/32_ejecucion_diaria_backups.md) | 17 Backups programados | 31 | ✅ Terminada |
| 33 | [Un resultado por sentencia: apilados hasta 2, pestañas desde 3](done/33_resultados_por_sentencia.md) | 18 Resultados múltiples | 05, 26 | ✅ Terminada |
| 34 | [Vista Consola y error marcado en el editor](done/34_vista_consola.md) | 19 Consola | 33 | ✅ Terminada |
| 34.1 | ↳ [Líneas reales y error marcado en el editor](done/34.1_lineas_reales_y_error_editor.md) | 19 Consola | 34 | ✅ Terminada |
| 34.2 | ↳ [Vista Consola: dominio y UI](done/34.2_vista_consola_ui.md) | 19 Consola | 34.1 | ✅ Terminada |
| 35 | [Compatibilidad del shell con Robo 3T](done/35_compatibilidad_shell.md) | 20 Shell compatible | 03 | ✅ Terminada (prueba en la app pendiente) |
| 36 | [Rendimiento de los resultados](done/36_rendimiento_resultados.md) | 21 Rendimiento | 34 | ✅ Terminada (comparar consulta con Robo 3T) |
| 37 | [Actualizador](done/37_actualizador.md) | 22 Actualizador | 08 | ✅ Terminada |
| 38 | [Edición en línea de valores primitivos](done/38_edicion_en_linea.md) | 23 Edición en línea | 06, 18 | ✅ Terminada (prueba GUI pendiente) |
| 39 | [Punto de color de la conexión en las pestañas](done/39_color_conexion_en_pestanas.md) | 24 Pestañas por conexión | 26 | ✅ Terminada |
| 40 | [Avance por colección en sync, restore y backup](done/40_avance_por_coleccion.md) | 25 Detalle de operaciones | 20, 22 | ✅ Terminada |
| 41 | [Detalle de una operación: origen → destino y colecciones por BD](done/41_detalle_de_operacion.md) | 25 Detalle de operaciones | 40 | ✅ Terminada |
| 42 | [Sincronizar documentos sueltos con otro entorno](pending/42_sync_de_documentos.md) | 26 Sync de documentos | 21, 41 | ⬜ Pendiente |
| 43 | [Reintentar operaciones fallidas desde el panel](pending/43_reintentar_operaciones.md) | 27 Reintentar operaciones | 20, 41 | ⬜ Pendiente |

\* 07 y 09 solo dependen de 01: pueden hacerse en cualquier momento después de 01 (09 es independiente del shell).
\* 10 es **opcional**: no cuenta para "siguiente tarea disponible" ni bloquea el cierre del plan; se hace solo si el usuario la pide.

## Cobertura del documento fuente

| Requisito (paridad Robo 3T) | Tarea |
|---|---|
| R1 Gestor de conexiones (CRUD, URI, etiquetas, test) | ya hecho |
| R2 Árbol: servidores, BDs, colecciones, índices, usuarios, funciones | ya hecho |
| R3 Administración: crear/eliminar BD y colección, renombrar, índices, estadísticas | ya hecho |
| R4 Infraestructura de tests y mantenibilidad | 01 |
| R5 Scripts JS completos (variables, bucles, funciones, `print`) con API `db`/colección/cursor | 02, 03 |
| R6 Tipos BSON (ObjectId, ISODate, NumberLong, NumberDecimal, regex, UUID): constructores en JS y formato en texto | 02, 05 |
| R7 Ejecución con cursores, paginación (skip/limit), tiempo de ejecución, cancelación | 03 |
| R8 Pestañas de shell por colección/BD, atajos (Ctrl+Enter, F5), ejecutar selección | 04 |
| R9 Autocompletado (métodos, colecciones, campos) e historial de consultas | 04 |
| R10 Vistas de resultado árbol / tabla / texto, copiar JSON | 05 |
| R11 Ver, insertar, editar, eliminar documentos | 06 |
| R12 Túnel SSH, certificados TLS, replica set / read preference, timeouts | 07 |
| R13 Preferencias (vista por defecto, zona horaria, codificación UUID, tamaño de lote, tema) | 08 |
| R14 Instalador y build de release | 08 |
| R15 Abrir y guardar scripts `.js` | 04 |
| R16 Atajos Ctrl+T / Ctrl+W y panel de logs | 04 |
| R17 Vista árbol fiel a Robo 3T: filas numeradas, `{ N fields }`, Type, primer doc expandido, fechas UTC/local (**prioridad del usuario**) | 05 |
| R18 Crear y editar usuarios con roles | 09 |
| R19 Copiar colección a otra base de datos / conexión | 09 |
| R20 Crear y editar funciones guardadas (`system.js`), opcional | 10 |
| R21 Barra de herramientas estilo TablePlus con **Menú** de la app | 11 |
| R22 Toggle del panel de bases de datos (mostrar/ocultar explorador) | 11 |
| R23 Show connections, show databases y refresh workspace | 11 |
| R24 Abrir mongosh en terminal externa | 11 |
| R25 Open connection / open database (apertura rápida) | 12 |
| R26 Quick database actions | 12 |
| R27 Safe mode (interruptor de solo lectura) y conexiones protegidas | 13 |
| R28 Notificaciones | 13 |
| R29 Backup y restore de base de datos | 14 |
| R30 Sync database: restaurar BD o colecciones entre entornos (prod → QA) sin tocar nunca una conexión protegida | 15 |
| R31 Servidor MCP | 16 |
| R32 Actividad MCP | 16 |
| R33 Botón de ajustes (settings) | 08 |
| R34 Píldora de estado en la barra: entorno (color de la etiqueta) · versión · conexión : BD : colección | 11 |
| R35 Menú de colección como Robo 3T: ver/actualizar/eliminar documentos, duplicar, versión y distribución de shards | 17 |
| R36 Confirmaciones como sub-ventanas modales (solo X, bloquean la principal) | 18 |
| R37 Menús de índices (ver, reconstruir) y conexión (ver log) como Robo 3T | 19 |
| R38 Operaciones largas en segundo plano con panel lateral por secciones (Sync, Backup, Restore), %, cancelar confirmado en sub-ventana, una escritura por destino | 20 |
| R39 Sync en dos sub-ventanas: selección → "Se va a MODIFICAR" + escribir `confirmo` | 21 |
| R40 Origen y destino entre todas las conexiones registradas (conexión bajo demanda), nunca producción ni la misma conexión | 21, 22 |
| R41 Backup y restore multi-BD en sub-ventanas con el flujo del sync (formato `mongodump --out`) | 22 |
| R42 El explorador solo muestra bases favoritas (persistentes por conexión) y temporales (hasta cerrar la app) | 23 |
| R43 Conexión sin bases fijadas: ventana "Bases de datos" obligatoria hasta elegir al menos una (crear si no hay); Cancelar cierra la conexión y la quita del explorador | 23 |
| R44 Ventana "Bases de datos": estrella por base, selección múltiple, favoritas arriba sin reordenar mientras está abierta | 23 |
| R45 Título de ventana con conexión y etiqueta de entorno (la barra coloreada se descartó a petición del usuario) | 24 |
| R46 Selectores de sync/backup/restore con las favoritas primero | 24 |
| R47 Borrados manuales en sub-ventana totalmente roja, con conexión y entorno, escribiendo `confirmo` como en el sync | 25 |
| R48 Aplicar ese nivel a cada acción destructiva del explorador, documentos y conexiones (D12) | 25 |
| R49 Dos pestañas del shell visibles y ejecutándose a la vez, lado a lado, con divisor redimensionable | 26 |
| R50 Dividir arrastrando una pestaña sobre el área del shell y separar desde el menú de la pestaña (como file-manager) | 26 |
| R51 Sub-ventana "Validación…" en el menú de colección: `$jsonSchema` editable y botones redondos que alternan con un clic el nivel (`moderate`/`strict`), acción (`error`/`warn`) y campos extra (`rechazar`/`permitir`) | 27 |
| R52 Respeta safe mode; el error de validación al editar se muestra claro (4.2 no dice qué campo falla) | 27 |
| R53 Filtrar las colecciones de una base escribiendo parte del nombre, con contador y resaltado | 28 |
| R54 El error de validación dice qué campo y qué regla fallan (`errInfo.details` en 5.0+, comprobación propia en 4.2) | 29 |
| R55 Varios temas de color para la aplicación, elegidos en Configuración (el actual es uno de ellos) | 30 |
| R57 "Tema…" en la tuerca abre una sub-ventana con los dos selectores y vista previa del código y de la interfaz | 30 |
| R56 Varios temas para el código y las vistas JSON, independientes del de la aplicación (el actual es uno de ellos) | 30 |
| R58 Iconos Conexiones / Backups en la bienvenida; lista de backups programados como el "Backup schedule" de TablePlus | 31 |
| R59 Programación: nombre, repetir (diario, semanal, cada hora, una vez, mensual o manual) a una hora de 12 h, avisar, origen (conexión + BDs/colecciones) y carpeta de destino | 31 |
| R60 Ejecutar una programación ya (▶), reutilizando el backup de la tarea 22 y el panel de Operaciones | 31 |
| R61 Ejecución automática de las programaciones activas según su frecuencia | 32 |
| R62 Aviso del resultado de cada ejecución y retención de las últimas copias | 32 |
| R63 Un resultado por cada sentencia del script que devuelve algo, rotulado con su línea | 33 |
| R64 Hasta 2 resultados apilados; 3 o más en sub-pestañas, como Robo 3T | 33 |
| R65 Vista Consola: todos los resultados en una lista con su línea, estilo consola del navegador | 34 |
| R66 Cada resultado según su tipo real (cursor/array → Array aunque traiga 1 doc; objeto solo si es documento; WriteResult; escalares) | 34 |
| R67 Error del script marcado en su línea del editor, en todas las vistas | 34 |
| R68 Líneas reales al ejecutar una selección | 34 |
| R69 `bulkWrite` e `initializeOrderedBulkOp`/`initializeUnorderedBulkOp` como en el shell clásico | 35 |
| R70 Escrituras masivas partidas en lotes (100 000 docs / 16 MB por comando) | 35 |
| R71 Atajos de cursor y colección del shell clásico (`explain`, `pretty`, `renameCollection`, `dropIndexes`, tamaños…) | 35 |
| R72 Atajos de base de datos, servidor y globales (`db.stats`, `currentOp`/`killOp`, usuarios, `rs`/`sh`, `sleep`, `load`, `it`) | 35 |
| R73 Cursor devuelto tal cual llega a la vista sin pasar por JavaScript | 36 |
| R74 El primer lote trae solo la página que se muestra | 36 |
| R75 Tiempo de consulta y de carga por separado | 36 |
| R76 Actualizador firmado (plugin updater + instalador NSIS) | 37 |
| R77 Aviso de versión nueva al arrancar y botón «Buscar actualizaciones» | 37 |
| R78 Aviso y botón bajo el título «SharkDB» de la pantalla principal | 37 |
| R79 Triple clic sobre el valor de un campo primitivo lo edita en la fila (objetos, arrays y `_id` no) | 38 |
| R80 Editor según el tipo: texto/número en un campo, booleano con `true`/`false` | 38 |
| R81 Enter con el valor igual cierra sin preguntar; Esc cancela | 38 |
| R82 Enter con cambio: sub-ventana con documento, campo, antes y después | 38 |
| R83 Solo se escribe ese campo (`$set`), conserva el tipo y no pisa cambios ajenos | 38 |
| R84 Clic fuera mientras se edita: sub-ventana "Seguir editando" / "Descartar cambios" | 38 |
| R85 Cada pestaña lleva un punto con el color de su conexión a la izquierda (no el fondo entero) | 39 |
| R86 Pestaña dividida entre dos conexiones: dos puntos | 39 |
| R87 Producción y conexiones protegidas: candado además del color | 39 |
| R88 El tooltip de la pestaña nombra la conexión (el color no es la única pista) | 39 |
| R89 Clic en una operación del panel (sync, restore, backup) muestra su detalle | 41 |
| R90 Detalle: origen → destino con entorno, host y puerto (SSH incluido) o carpeta | 41 |
| R91 Colecciones agrupadas por BD en secciones plegables, la BD como título con su resumen | 41 |
| R92 Cada colección: punto de color, nombre y % de 0 a 100 | 41 |
| R93 Estados y colores de cada colección (D23) | 41 |
| R94 El backend informa estado y avance de cada colección, también con varias en paralelo | 40 |
| R95 Al cancelar o fallar, lo no aplicado queda como descartado (el destino no cambió) | 40 |
| R96 El estado de una colección no depende solo del color (tooltip / texto accesible) | 41 |
| R97 Elegir documentos seleccionados en el visor para sincronizarlos; se leen completos de la BD por `_id` (nunca la proyección mostrada) | 42 |
| R104 Solo hacia un entorno de menor nivel: prod → QA/local, QA → local; nunca el mismo nivel ni hacia arriba (D26) | 42 |
| R98 Copiarlos a la misma BD y colección de otra conexión según D25 | 42 |
| R99 Confirmación con cada documento completo, conexión/BD/colección de origen y destino, y `confirmo`; nunca destino protegido ni en safe mode | 42 |
| R100 El sync de documentos corre en el panel de Operaciones con avance y detalle | 42 |
| R101 Botón ⟳ Reintentar en las operaciones fallidas (y canceladas, D27) | 43 |
| R102 Reintentar relanza la misma petición sin rehacer la selección | 43 |
| R103 Al reintentar se vuelven a comprobar safe mode y conexiones protegidas | 43 |
| Pendiente: abrir una base escribiendo su nombre cuando el usuario no puede listar bases | sin tarea (pospuesto por el usuario) |

## Diagrama de dependencias

```
01 → 02 → 03 → 04 → 05 → 06 ─┬→ 08
01 → 07 ─────────────────────┘
01 → 09
04 ┄→ 10 (opcional)
04 → 11 ─┬→ 12 ─────────┐
         ├→ 08          │
06 ──────┴→ 13 ─┬───────┴→ 14 → 15 (+09)
                └→ 16
09, 13 → 17
12 → 18
17, 18 → 19
15 → 20 → 21 → 22 → 23 → 24
18, 21 → 25
04, 05 → 26
13, 17, 18 → 27 → 29
23 → 28
30 (independiente)
22 → 31 → 32
05, 26 → 33
33 → 34
03 → 35
34 → 36
08 → 37
06, 18 → 38
12 ────────────────────┘
26 → 39
20, 22 → 40 → 41 ─┬→ 42 (+21)
                  └→ 43 (+20)
```
