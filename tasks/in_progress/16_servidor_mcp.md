# 16 · Servidor MCP y actividad MCP

**Estado:** 🔄 En progreso
**Fase:** 10 MCP · **Depende de:** 13 · **Doc:** R31, R32 · **Decisión:** D8

## Objetivo
La app expone sus conexiones abiertas como servidor MCP (HTTP local) y trae un chat con Claude en una pestaña del sidebar derecho (junto a Operaciones): se inicia con el setup token de `claude setup-token`, Claude consulta MongoDB a través del servidor MCP de la app y cada llamada se ve en vivo.

## Pasos

### Paso 1: Servidor MCP (`src-tauri/src/mcp/`)
- [x] `tools.rs`: herramientas `list_connections`, `list_databases`, `list_collections`, `find`, `aggregate`, `count`, `collection_schema`, `insert`, `update`, `delete`; cada una se traduce a un comando y pasa por `SafeMode::check_command` de su conexión (R31, D8). Lógica pura con `cargo test`
- [x] `protocol.rs`: JSON-RPC de MCP (`initialize`, `tools/list`, `tools/call`, notificaciones) puro y testeado; `http.rs`: transporte Streamable HTTP en `127.0.0.1` con puerto libre y token bearer aleatorio; `server.rs`/`commands.rs`: arrancar/parar, conexiones expuestas elegidas por el usuario (R31)
- [x] `activity.rs`: un evento `mcp://activity` por llamada (herramienta, argumentos, duración, resultado o error) (R32)

### Paso 2: Claude embebido (`src-tauri/src/claude/`)
- [x] `token.rs`: setup token guardado en el llavero del sistema (guardar, borrar, saber si hay)
- [x] `cli.rs` + `session.rs`: lanzar `claude -p` con stream-json, `CLAUDE_CODE_OAUTH_TOKEN`, solo el MCP de la app (`--strict-mcp-config`, sin herramientas integradas); enviar mensajes, detener y nueva conversación (`--resume` al relanzar)
- [x] `stream.rs`: traducir las líneas stream-json a eventos de chat (texto parcial, uso de herramienta, fin de turno, error) puro y testeado

### Paso 3: UI
- [x] Sidebar derecho con pestañas **Operaciones | Claude**; botón **Claude** en la barra (11)
- [x] `src/features/claude/` hexagonal: dominio del chat (reducer de eventos, testeado), servicio, gateway Tauri; `ClaudePanel` con configuración (cómo obtener el setup token y pegarlo), conexiones expuestas, chat y **actividad MCP** con filtro y detalle (R32)

### Paso 4: Verificación
- [x] Prueba real del servidor contra MongoDB local (`cargo test live_reads_and_writes -- --ignored`): insert, find, list_collections y count; la escritura con safe mode se rechaza
- [ ] Prueba real con Claude: pegar el setup token, preguntar en el chat y ver las llamadas en Actividad MCP (pendiente del usuario: el token sale de su `claude setup-token`)
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(mcp): servidor MCP, chat con Claude y panel de actividad` (propuesto, pendiente del usuario)
- **Cierre de Fase 10**

## Criterios de aceptación
- [ ] Con el setup token pegado, el chat de la pestaña Claude responde y consulta solo las conexiones expuestas
- [ ] Toda llamada queda registrada en la actividad MCP
- [x] El servidor respeta el safe mode de cada conexión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-04: Alcance cambiado por el usuario: en vez de un botón "MCP server" en la barra, chat con Claude embebido en una pestaña del sidebar derecho que usa el MCP de la app; D8 → HTTP local y escrituras con safe mode.
- 2026-11-04: El servidor MCP arranca con el primer mensaje del chat y vive lo que la ventana (sin botón de parar): solo 127.0.0.1 + token bearer; las conexiones expuestas son todas las abiertas salvo las desmarcadas.
- 2026-11-04: Falta la prueba con Claude real: necesita el setup token del usuario; la app arranca y el camino herramientas → safe mode → MongoDB se probó con un test vivo.
