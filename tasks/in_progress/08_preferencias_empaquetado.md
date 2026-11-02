# 08 · Preferencias y empaquetado

**Estado:** 🔄 En progreso (commit hecho; falta prueba manual)
**Fase:** 6 Cierre · **Depende de:** 06, 07, 11 · **Doc:** R13, R14, R33

## Objetivo
Diálogo de preferencias aplicado en toda la app y un instalador de release listo para distribuir.

## Pasos

### Paso 1: Preferencias
- [x] `src/features/settings/domain/settings.ts` (tipo + valores por defecto: vista de resultados, fechas UTC/local (persistir el interruptor creado en 05), expandir primer documento, codificación UUID, tamaño de lote, timeout, tema claro/oscuro) + persistencia en `store.rs` (`load_settings`/`save_settings`) (R13)
- [x] `src/features/settings/ui/SettingsDialog.tsx` + contexto `useSettings`; consumirlo en `bsonFormat.ts` (zona, UUID), `ResultsPanel` (vista por defecto) y `shellService` (lote, timeout) (R13)
- [x] Botón **Ajustes** (`Ctrl+,`) en la barra de herramientas (11) y entrada en su Menú, que abren `SettingsDialog` (R33)

### Paso 2: Release
- [x] `src-tauri/tauri.conf.json`: `productName`, identificador, versión, iconos propios, targets según D4; diálogo "Acerca de" con versión (R14)
- [x] `README.md`: reescribir (qué es, requisitos, `npm run tauri dev`, `npm run tauri build`, atajos de teclado) (R14)

### Paso 3: Verificación
- [ ] Prueba real: cambiar preferencias, reiniciar, comprobar que se aplican; `npm run tauri build` genera el instalador y la app instalada conecta y ejecuta consultas
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npm run build`, `cargo test` pasan
- [x] Commit: `feat(settings): preferencias y build de release`
- **Cierre de Fase 6**

## Criterios de aceptación
- [ ] Las preferencias persisten y cambian el comportamiento real (formato de fechas, lote, vista)
- [ ] El instalador se genera e instala en una máquina limpia
- [ ] El README permite a alguien nuevo compilar y usar la app

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: Fuera de alcance: UUID (el formato ya muestra UUID() estándar), tema (ya en «Tema…», tarea 30) y expandir primer documento (el árbol ya abre el único documento de un resultado); «Acerca de» ya existía.
- 2026-11-01: Preferencias en ventana propia; se sincronizan por el evento `settings-changed` y cada ejecución recibe timeout y lote como `RunOptions`, así valen sin reiniciar.
- 2026-11-01: D4: NSIS en `tauri.conf.json`; macOS/Linux preparados en `tauri.macos/linux.conf.json` (sin probar). Ctrl+, es un atajo global (`usePreferencesShortcut` en App) para que funcione también en la pantalla de bienvenida.
- 2026-11-01: `npm run tauri build` genera `SharkDB_0.1.0_x64-setup.exe` (4.8 MiB); falta la prueba manual (preferencias tras reiniciar, instalar en máquina limpia), por eso sigue 🔄.
