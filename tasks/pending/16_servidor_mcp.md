# 16 · Servidor MCP y actividad MCP

**Estado:** ❌ Descartada (2026-11-07: el usuario ya no quiere el MCP; se quitó el código)
**Fase:** 10 MCP · **Depende de:** 13 · **Doc:** R31, R32

## Objetivo
La app puede exponer sus conexiones como servidor MCP para que un agente de IA (Claude Code, Claude Desktop…) consulte MongoDB a través de ella, y un panel muestra en vivo cada llamada que hace el agente.

## Pasos

### Paso 1: Servidor
- [ ] `src-tauri/src/mcp/`: servidor MCP con el transporte de D8; herramientas `list_connections`, `list_databases`, `list_collections`, `find`, `aggregate`, `count`, `collection_schema` y, si D8 lo permite, escrituras; toda llamada pasa por la política de safe mode (13) de su conexión (R31)
- [ ] Lógica de las herramientas separada del transporte y testeada con `cargo test`; arrancar/parar desde la app, puerto y estado persistidos, conexiones expuestas elegidas por el usuario (R31)

### Paso 2: UI
- [ ] `src/features/mcp/` hexagonal: botón **MCP server** en la barra (11) con estado (parado / escuchando) y diálogo para activarlo, elegir conexiones expuestas y copiar el snippet de configuración para el cliente (R31)
- [ ] **MCP activity**: el backend emite un evento por llamada (herramienta, argumentos, duración, resultado o error); `McpActivityPanel.tsx` lo lista en vivo con filtro y detalle (R32)

### Paso 3: Verificación
- [ ] Prueba real: registrar el servidor en Claude Code, pedirle que liste colecciones y haga un `find`; las llamadas aparecen en el panel; una escritura con safe mode activo se rechaza
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(mcp): servidor MCP y panel de actividad`
- **Cierre de Fase 10**

## Criterios de aceptación
- [ ] Un cliente MCP real se conecta y consulta solo las conexiones expuestas
- [ ] Toda llamada queda registrada en el panel de actividad
- [ ] El servidor respeta el safe mode de cada conexión

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
