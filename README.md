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
- Opcional: un MongoDB en `127.0.0.1:27017` para probar contra una base real y lanzar las pruebas de Rust
  marcadas `#[ignore]`.
- Solo para publicar versiones: [GitHub CLI](https://cli.github.com) (`gh`) y la clave privada de firma (ver
  [Firma de las actualizaciones](#firma-de-las-actualizaciones)).

## Puesta en marcha

```sh
git clone https://github.com/Miiichael6/sharkdb.git
cd sharkdb
npm install
npm run start:dev
```

La primera vez Cargo compila todas las dependencias de Rust y tarda varios minutos; después arranca en
segundos.

## Desarrollo

```sh
npm run start:dev     # recomendado
npm run tauri dev     # equivalente, si ~/.cargo/bin ya está bien en el PATH
```

`start:dev` antepone `~/.cargo/bin` al `PATH` antes de lanzar `tauri dev`: en Windows, una entrada mal formada
del `PATH` (por ejemplo, una comilla suelta) hace que se ignoren todas las siguientes y no se encuentre `cargo`.

- El frontend (Vite, `http://localhost:1420`) se recarga en caliente; un cambio en `src-tauri/` recompila y
  reinicia la app.
- Si sale `Port 1420 is already in use`, ya hay otra instancia de desarrollo abierta: ciérrala antes.

## Pruebas

```sh
npm test                          # frontend (vitest)
npx tsc --noEmit                  # tipos
npm run build                     # tipos + build del frontend
cd src-tauri && cargo test --lib  # backend
```

Las pruebas de Rust que necesitan un MongoDB en `127.0.0.1:27017` (o TLS/SSH reales) están marcadas
`#[ignore]`; se lanzan con `cargo test --lib -- --ignored`.

## Build de release

```sh
npm run release -- --local
```

Compila el instalador NSIS firmado y lo deja en `releases/SharkDB_<versión>_x64-setup.exe` (carpeta ignorada
por git), junto a su `.sig` y `latest.json`. No hace commit ni publica nada. Con `--local patch` (o `minor`,
`major`, `1.2.0`) sube antes la versión en `package.json`.

También se puede usar `npm run tauri build` directamente, pero entonces hay que definir a mano las variables
de la clave (ver abajo) y el instalador queda en `src-tauri/target/release/bundle/nsis/`.

### Firma de las actualizaciones

El build genera también la firma (`.sig`) que el actualizador comprueba antes de instalar, así que necesita la
clave privada. La pública está en `plugins.updater.pubkey` de `tauri.conf.json`; la privada **nunca** va al
repositorio. `npm run release` la busca en `~/.tauri/sharkdb.key` (en Windows,
`C:\Users\<usuario>\.tauri\sharkdb.key`) o en la variable `TAURI_SIGNING_PRIVATE_KEY`.

- **En otra máquina**: copia `sharkdb.key` a esa ruta. Guarda una copia segura: sin ella no se puede publicar.
- **Con `tauri build` a mano**:

  ```sh
  # PowerShell
  $env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\sharkdb.key"
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""   # la clave actual no tiene contraseña
  npm run tauri build
  ```

Si se pierde la clave privada, las versiones ya instaladas no podrán actualizarse: hay que generar otra con
`npm run tauri signer generate -- -w ~/.tauri/sharkdb.key`, poner la nueva pública en `pubkey` y reinstalar a
mano en cada equipo.

### Publicar una versión

La app busca actualizaciones en las [GitHub Releases](https://github.com/Miiichael6/sharkdb/releases) de este
repositorio (`releases/latest/download/latest.json`).

**Preparación (una sola vez por máquina):** instala `gh`, inicia sesión con `gh auth login` y deja la clave
en `~/.tauri/sharkdb.key`.

**Cada versión:**

1. Mergea a `main` lo que vaya en la versión y quédate en `main` sin cambios pendientes (`git status` limpio).
2. Ejecuta:

   ```sh
   npm run release -- patch "Qué trae esta versión"   # o minor, major, o una versión exacta: 1.2.0
   ```

El script, antes de tocar nada, comprueba la clave, la rama, que no haya cambios y la sesión de `gh`. Después:

1. Sube la versión en `package.json`, que es la única: `tauri.conf.json` y la pantalla de inicio la leen de ahí.
2. Compila el instalador firmado y lo deja en `releases/` con su `.sig` y `latest.json`.
3. Hace commit `chore(release): v<versión>`, crea el tag y sube `main` y el tag.
4. Crea la release `v<versión>` en GitHub con esos tres archivos.

Si el build falla, `package.json` vuelve a la versión anterior y no se publica nada. Para publicar la versión
que ya tiene `package.json` sin subirla (por ejemplo la primera, `0.1.0`), pasa esa misma versión:
`npm run release -- 0.1.0 "Primera versión"`.

Las apps instaladas ven el aviso al abrirse o al pulsar **Buscar actualizaciones** en la pantalla de inicio;
**Actualizar** descarga, verifica la firma, instala y reinicia. La release tiene que ser la última publicada
(no borrador ni *pre-release*) para que `latest` apunte a ella. Mientras no haya ninguna, el botón dice «No
se encontró ninguna versión publicada» y la app funciona igual.

### Instalar y desinstalar

El instalador (`SharkDB_<versión>_x64-setup.exe`, de `releases/` o de la página de releases) instala para el
usuario actual, sin permisos de administrador, en `%LOCALAPPDATA%\SharkDB`. Con `/S` se instala en silencio.
Se desinstala desde **Configuración → Aplicaciones** o con `%LOCALAPPDATA%\SharkDB\uninstall.exe`.

Las preferencias se guardan aparte, en `%APPDATA%\com.sharkdb.app\settings.json`, y se conservan al
actualizar.

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
