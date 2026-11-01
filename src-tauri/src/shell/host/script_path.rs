//! Ruta de `load(ruta)`: relativa a la carpeta del script abierto en la pestaña, como cuando
//! Robo 3T carga un fichero junto al que se está ejecutando. Lógica pura, sin tocar el disco.

use std::path::{Path, PathBuf};

const NO_SCRIPT_DIR: &str =
    "load: la pestaña no tiene un script guardado; usa una ruta absoluta o guarda el script";
const EMPTY_PATH: &str = "load: falta la ruta del fichero";

pub fn resolve(script_dir: Option<&Path>, path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path.trim());
    if path.as_os_str().is_empty() {
        return Err(EMPTY_PATH.into());
    }
    if path.is_absolute() {
        return Ok(path.to_path_buf());
    }
    script_dir
        .map(|dir| dir.join(path))
        .ok_or_else(|| NO_SCRIPT_DIR.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_paths_hang_from_the_script_folder() {
        let dir = Path::new("scripts");
        assert_eq!(
            resolve(Some(dir), "lib/util.js"),
            Ok(dir.join("lib/util.js"))
        );
        assert!(resolve(None, "util.js").unwrap_err().contains("ruta absoluta"));
        assert!(resolve(Some(dir), "  ").is_err());
    }

    #[test]
    fn absolute_paths_are_kept() {
        let absolute = std::env::temp_dir().join("util.js");
        let text = absolute.to_str().unwrap();
        assert_eq!(resolve(None, text), Ok(absolute.clone()));
        assert_eq!(resolve(Some(Path::new("otra")), text), Ok(absolute));
    }
}
