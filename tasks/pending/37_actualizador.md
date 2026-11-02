# 37 · Actualizador

**Estado:** ⬜ Pendiente (paso 4 espera D18)
**Fase:** 22 Actualizador · **Depende de:** 08 · **Doc:** R76, R77, R78

## Objetivo
La pantalla principal avisa, bajo el título «SharkDB», cuando hay una versión nueva y permite instalarla. Un botón «Buscar actualizaciones» comprueba en el momento. Todo queda listo y solo falta el origen de las versiones (D18).

## Pasos

### Paso 1: Backend del actualizador
- [ ] Añadir `tauri-plugin-updater` y `tauri-plugin-process` (Cargo + npm), registrarlos en `lib.rs` y dar los permisos `updater:default` y `process:allow-restart` en `capabilities/default.json` (R76)
- [ ] `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` y `plugins.updater` con `pubkey` y `endpoints` (marcador hasta D18), y `windows.installMode: "passive"` para que NSIS instale sin asistente (R76)
- [ ] Generar el par de claves con `npm run tauri signer generate`. La clave privada queda fuera del repo; en el README, cómo firmar el build con `TAURI_SIGNING_PRIVATE_KEY` (R76)

### Paso 2: Feature `updates` (capas)
- [ ] `src/features/updates/domain/update.ts`: el estado `UpdateStatus` (`idle` · `checking` · `upToDate` · `available{version, notes}` · `downloading{percent}` · `error{message}`) y sus transiciones puras (R77)
- [ ] `application/ports.ts` (`UpdateGateway`: `check()`, `install(onProgress)`, `restart()`) y `application/updateService.ts`: comprobación al arrancar (una vez y en silencio si falla) y bajo demanda, con suscripción como `settingsService` (R77)
- [ ] `infrastructure/tauriUpdateGateway.ts` sobre `@tauri-apps/plugin-updater` y `plugin-process`; conectarlo en `src/app/services.tsx` (R77)
- [ ] Tests de dominio y servicio con un gateway falso: hay versión, no hay, error de red y progreso de descarga (R77)

### Paso 3: UI bajo el título
- [ ] `src/features/updates/ui/UpdateNotice.tsx`: va en `Welcome.tsx` bajo «SharkDB» y la versión. Muestra «Hay una versión nueva: X.Y.Z» con el botón **Actualizar** (descarga con progreso, instala y reinicia), y siempre el botón **Buscar actualizaciones**, que muestra «Comprobando…», «Tienes la última versión» o el error (R77, R78)
- [ ] Sustituir el `Versión 0.1.0` fijo de `Welcome.tsx` por `__APP_VERSION__`; estilos en `App.css` (R78)

### Paso 4: Publicación (espera D18)
- [ ] Poner el endpoint real en `plugins.updater.endpoints` y documentar en el README cómo publicar una versión: subir la versión, `npm run tauri build` firmado y subir el `.exe`, el `.sig` y `latest.json` (R76)

### Paso 5: Verificación
- [ ] Prueba real: instalar la 0.1.0, publicar una 0.1.1 de prueba, abrir la app y ver el aviso; «Actualizar» instala y reinicia en la 0.1.1. Sin conexión, «Buscar actualizaciones» muestra el error sin romper nada
- [ ] Código organizado: una responsabilidad por archivo, lógica pura separada de la integración, sin duplicación ni código muerto
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` y `cargo test --lib` pasan
- [ ] Commit: `feat(updates): aviso de nueva versión y búsqueda de actualizaciones`

## Criterios de aceptación
- [ ] Con una versión más nueva publicada, el aviso aparece solo bajo el título «SharkDB» al abrir la app
- [ ] «Buscar actualizaciones» informa en el momento: comprobando, al día, versión nueva o error
- [ ] «Actualizar» descarga, verifica la firma, instala y reinicia en la versión nueva
- [ ] Sin red o sin endpoint, la app arranca y funciona igual; solo el botón muestra el error

## Bitácora
<!-- Resumida: 1 a 3 entradas de una línea. Solo decisiones no obvias, problemas y desviaciones. -->
- _(fecha: nota)_
