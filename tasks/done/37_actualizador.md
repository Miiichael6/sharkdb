# 37 · Actualizador

**Estado:** ✅ Terminada
**Fase:** 22 Actualizador · **Depende de:** 08 · **Doc:** R76, R77, R78

## Objetivo
La pantalla principal avisa, bajo el título «SharkDB», cuando hay una versión nueva y permite instalarla. Un botón «Buscar actualizaciones» comprueba en el momento. Todo queda listo y solo falta el origen de las versiones (D18).

## Pasos

### Paso 1: Backend del actualizador
- [x] Añadir `tauri-plugin-updater` y `tauri-plugin-process` (Cargo + npm), registrarlos en `lib.rs` y dar los permisos `updater:default` y `process:allow-restart` en `capabilities/default.json` (R76)
- [x] `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` y `plugins.updater` con `pubkey` y `endpoints` (marcador hasta D18), y `windows.installMode: "passive"` para que NSIS instale sin asistente (R76)
- [x] Generar el par de claves con `npm run tauri signer generate`. La clave privada queda fuera del repo; en el README, cómo firmar el build con `TAURI_SIGNING_PRIVATE_KEY` (R76)

### Paso 2: Feature `updates` (capas)
- [x] `src/features/updates/domain/update.ts`: el estado `UpdateStatus` (`idle` · `checking` · `upToDate` · `available{version, notes}` · `downloading{percent}` · `error{message}`) y sus transiciones puras (R77)
- [x] `application/ports.ts` (`UpdateGateway`: `check()`, `install(onProgress)`, `restart()`) y `application/updateService.ts`: comprobación al arrancar (una vez y en silencio si falla) y bajo demanda, con suscripción como `settingsService` (R77)
- [x] `infrastructure/tauriUpdateGateway.ts` sobre `@tauri-apps/plugin-updater` y `plugin-process`; conectarlo en `src/app/services.tsx` (R77)
- [x] Tests de dominio y servicio con un gateway falso: hay versión, no hay, error de red y progreso de descarga (R77)

### Paso 3: UI bajo el título
- [x] `src/features/updates/ui/UpdateNotice.tsx`: va en `Welcome.tsx` bajo «SharkDB» y la versión. Muestra «Hay una versión nueva: X.Y.Z» con el botón **Actualizar** (descarga con progreso, instala y reinicia), y siempre el botón **Buscar actualizaciones**, que muestra «Comprobando…», «Tienes la última versión» o el error (R77, R78)
- [x] Sustituir el `Versión 0.1.0` fijo de `Welcome.tsx` por `__APP_VERSION__`; estilos en `App.css` (R78)

### Paso 4: Publicación
- [x] Poner el endpoint real en `plugins.updater.endpoints` y documentar en el README cómo publicar una versión: subir la versión, `npm run tauri build` firmado y subir el `.exe`, el `.sig` y `latest.json` (R76)
- [x] `npm run release -- <patch|minor|major|x.y.z> "notas"` hace todo: sube versión, compila firmado, deja el `.exe` en `releases/`, commit + tag + push y crea la release; `--local` solo compila (R76)

### Paso 5: Verificación
- [x] Prueba real: instalar la 0.1.0, publicar una 0.1.1 de prueba, abrir la app y ver el aviso; «Actualizar» instala y reinicia en la 0.1.1. Sin conexión, «Buscar actualizaciones» muestra el error sin romper nada
- [x] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` y `cargo test --lib` pasan
- [x] Commit: `feat(updates): aviso de nueva versión y búsqueda de actualizaciones`

## Criterios de aceptación
- [x] Con una versión más nueva publicada, el aviso aparece solo bajo el título «SharkDB» al abrir la app
- [x] «Buscar actualizaciones» informa en el momento: comprobando, al día, versión nueva o error
- [x] «Actualizar» descarga, verifica la firma, instala y reinicia en la versión nueva
- [x] Sin red o sin endpoint, la app arranca y funciona igual; solo el botón muestra el error

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- 2026-11-01: Rama creada desde `robo3b/preferencias-empaquetado-08` (no desde `main`): la 08 está commiteada pero sin mergear y la 37 depende de ella.
- 2026-11-01: Clave privada en `~/.tauri/sharkdb.key`, sin contraseña. Endpoint provisional `https://updates.sharkdb.invalid/latest.json` (`.invalid` nunca resuelve): hasta D18 el botón da error y el arranque lo ignora.
- 2026-11-01: Plugins en `[dependencies]` sin `cfg` de móvil, como los demás: la app es solo de escritorio.
- 2026-11-01: `tauri build` con `TAURI_SIGNING_PRIVATE_KEY` genera el instalador y su `.sig`; la prueba real (0.1.0 → 0.1.1) queda para cuando haya endpoint (D18).
- 2026-11-01: D18 → GitHub Releases. `npm run release` crea `latest.json` (Tauri no lo genera sin CI) y la release con `gh`; la versión vive solo en `package.json` (`tauri.conf.json` la lee de ahí).
- 2026-11-01: Errores del plugin traducidos en el adaptador (vienen en inglés). Instalador firmado probado con `/S`: arranca, sin release el botón dice «No se encontró ninguna versión publicada», conecta y consulta.
- 2026-11-01: Prueba real con las releases v0.1.0 → v0.1.1 publicadas: aviso, Actualizar y reinicio OK (probado por el usuario). Error probado sin release publicada, no sin red. El `.exe` mostraba 0.1.0 en Propiedades: `npm run release` copia ahora la versión a `Cargo.toml`.
