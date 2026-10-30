# 08 · Preferencias y empaquetado

**Estado:** ⛔ Bloqueada (D4)
**Fase:** 6 Cierre · **Depende de:** 06, 07 · **Doc:** R13, R14

## Objetivo
Diálogo de preferencias aplicado en toda la app y un instalador de release listo para distribuir.

## Pasos

### Paso 1: Preferencias
- [ ] `src/features/settings/domain/settings.ts` (tipo + valores por defecto: vista de resultados, fechas UTC/local (persistir el interruptor creado en 05), expandir primer documento, codificación UUID, tamaño de lote, timeout, tema claro/oscuro) + persistencia en `store.rs` (`load_settings`/`save_settings`) (R13)
- [ ] `src/features/settings/ui/SettingsDialog.tsx` + contexto `useSettings`; consumirlo en `bsonFormat.ts` (zona, UUID), `ResultsPanel` (vista por defecto) y `shellService` (lote, timeout) (R13)

### Paso 2: Release
- [ ] `src-tauri/tauri.conf.json`: `productName`, identificador, versión, iconos propios, targets según D4; diálogo "Acerca de" con versión (R14)
- [ ] `README.md`: reescribir (qué es, requisitos, `npm run tauri dev`, `npm run tauri build`, atajos de teclado) (R14)

### Paso 3: Verificación
- [ ] Prueba real: cambiar preferencias, reiniciar, comprobar que se aplican; `npm run tauri build` genera el instalador y la app instalada conecta y ejecuta consultas
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npm run build`, `cargo test` pasan
- [ ] Commit: `feat(settings): preferencias y build de release`
- **Cierre de Fase 6**

## Criterios de aceptación
- [ ] Las preferencias persisten y cambian el comportamiento real (formato de fechas, lote, vista)
- [ ] El instalador se genera e instala en una máquina limpia
- [ ] El README permite a alguien nuevo compilar y usar la app

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
