# SharkDB

Cliente de escritorio para MongoDB en la línea de Robo 3T: explorador de conexiones y bases de datos, shell
con sintaxis de mongosh (motor JavaScript propio, sin depender de un `mongosh` instalado) y resultados en
árbol, tabla, texto o consola. Incluye túneles SSH, backup/restauración, sincronización entre entornos y
tareas programadas.

Hecho con [Tauri 2](https://tauri.app) (Rust) y React + TypeScript.

## Requisitos

- [Node.js](https://nodejs.org) 22 o superior.
- [Rust](https://rustup.rs) estable (con `cargo` en el `PATH`).
- Los [requisitos previos de Tauri](https://tauri.app/start/prerequisites/) del sistema: en Windows, las
  herramientas de compilación de C++ de Visual Studio y WebView2 (ya viene con Windows 10/11).

## Desarrollo

```sh
npm install
npm run tauri dev     # o: npm run start:dev, que añade ~/.cargo/bin al PATH antes de arrancar
```

Pruebas:

```sh
npm test                          # frontend (vitest)
npx tsc --noEmit                  # tipos
cd src-tauri && cargo test --lib  # backend
```

Las pruebas de Rust que necesitan un MongoDB en `127.0.0.1:27017` (o TLS/SSH reales) están marcadas
`#[ignore]`; se lanzan con `cargo test --lib -- --ignored`.

## Build de release

```sh
npm run tauri build
```

Genera el instalador NSIS de Windows en `src-tauri/target/release/bundle/nsis/SharkDB_<versión>_x64-setup.exe`.

### Otras plataformas

La configuración ya está preparada: Tauri mezcla `tauri.<plataforma>.conf.json` sobre `tauri.conf.json`
cuando compila en ese sistema, así que basta con ejecutar `npm run tauri build` en él:

| Sistema | Archivo                           | Formatos          |
| ------- | --------------------------------- | ----------------- |
| Windows | `src-tauri/tauri.conf.json`       | `nsis`            |
| macOS   | `src-tauri/tauri.macos.conf.json` | `dmg`, `app`      |
| Linux   | `src-tauri/tauri.linux.conf.json` | `deb`, `appimage` |

Tauri no compila en cruzado de forma fiable: cada instalador se genera en su propio sistema (o en una CI con
una máquina de cada uno). macOS y Linux aún no se han probado.

## Preferencias

**Ajustes → Preferencias…** (`Ctrl+,`): vista con la que se abren los resultados, fechas en UTC o en hora
local, documentos por página y tiempo máximo por script. Se guardan en `settings.json`, en la carpeta de
datos de la app, y se aplican en el acto a las consultas siguientes. El tema está en **Ajustes → Tema…**.

## Atajos de teclado

| Atajo                         | Acción                                     |
| ----------------------------- | ------------------------------------------ |
| `Ctrl+Enter` / `F5` (editor)  | Ejecutar el script                         |
| `Ctrl+Shift+F`                | Formatear el script                        |
| `Ctrl+T` / `Ctrl+W`           | Nueva pestaña / cerrar pestaña             |
| `Ctrl+O`                      | Abrir script                               |
| `Ctrl+S` / `Ctrl+Shift+S`     | Guardar / guardar como                     |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Siguiente / anterior pestaña de resultados |
| `Ctrl+K`                      | Abrir base de datos                        |
| `Ctrl+Shift+K`                | Abrir conexión                             |
| `Ctrl+.`                      | Acciones rápidas de base de datos          |
| `Ctrl+B`                      | Mostrar u ocultar el panel lateral         |
| `Ctrl+R` / `F5`               | Refrescar el workspace                     |
| `Ctrl+,`                      | Preferencias                               |
