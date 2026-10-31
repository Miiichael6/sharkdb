# Tareas: Robo3B (clon de Robo 3T sobre Tauri + React)

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
- [ ] **D4** ¿Plataformas y formato de instalador? (p. ej. solo Windows NSIS/MSI, o también macOS/Linux) → afecta 08
- [x] **D5** Safe mode → **interruptor de solo lectura**: activo, ninguna escritura llega a la BD (scripts del shell ni acciones manuales: árbol, CRUD, restore, sync); solo lecturas (2026-10-30) → afecta 13
- [x] **D6** Backup/restore → **nativo en Rust con formato compatible con `mongodump`** (`<colección>.bson` + `<colección>.metadata.json`): sin dependencias que instalar, usa la misma conexión de la app (SSH/TLS de 07), progreso y cancelación propios, restaurable también con `mongorestore` (2026-10-30) → afecta 14
- [x] **D7** Sync database → **restaurar entre entornos (p. ej. prod → QA) una BD completa o colecciones sueltas** (reemplaza el contenido del destino). Las conexiones se pueden marcar **protegidas** (prod): nunca son destino de restore/sync y abren con safe mode activo. El diálogo muestra siempre, de forma destacada, cuál es el origen y cuál el destino que se va a modificar (2026-10-30) → afecta 13, 15
- [ ] **D8** Servidor MCP: ¿transporte stdio o HTTP local? ¿Solo lectura o también escrituras? **Pospuesta por el usuario** (2026-10-30) → afecta 16

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
| 08 | [Preferencias y empaquetado](pending/08_preferencias_empaquetado.md) | 6 Cierre | 06, 07, 11 | ⛔ Bloqueada (D4) |
| 09 | [Administración: usuarios y copia de colecciones](done/09_administracion_usuarios_copia.md) | 7 Administración | 01 | ✅ Terminada (prueba manual pendiente en la UI) |
| 10 | [Crear y editar funciones guardadas](pending/10_funciones_guardadas.md) | 7 Administración | 04 | ⬜ Pendiente (opcional) |
| 11 | [Barra de herramientas del workspace](done/11_barra_herramientas.md) | 8 Barra de herramientas | 04 | ✅ Terminada |
| 12 | [Apertura rápida y acciones rápidas de BD](done/12_apertura_rapida_y_acciones.md) | 8 Barra de herramientas | 11 | ✅ Terminada (prueba manual pendiente en la UI) |
| 13 | [Safe mode y centro de notificaciones](done/13_safe_mode_notificaciones.md) | 8 Barra de herramientas | 06, 11 | ✅ Terminada (prueba manual pendiente en la UI) |
| 14 | [Backup y restore de base de datos](done/14_backup_restore.md) | 9 Operaciones de BD | 12, 13 | ✅ Terminada (prueba manual pendiente en la UI) |
| 15 | [Sincronizar entre entornos](pending/15_sincronizar_bd.md) | 9 Operaciones de BD | 09, 14 | ⬜ Pendiente |
| 16 | [Servidor MCP y actividad MCP](pending/16_servidor_mcp.md) | 10 MCP | 13 | ⛔ Bloqueada (D8, pospuesta) |
| 17 | [Menú contextual completo de colección](done/17_menu_coleccion.md) | 7 Administración | 09, 13 | ✅ Terminada (prueba manual pendiente en la UI) |
| 18 | [Confirmaciones en ventanas modales](done/18_ventanas_confirmacion.md) | 8 Barra de herramientas | 12 | ✅ Terminada (prueba manual pendiente) |
| 19 | [Menús de índices y conexión como Robo 3T](done/19_menus_indices_conexion.md) | 7 Administración | 17, 18 | ✅ Terminada (prueba manual pendiente) |

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
```
