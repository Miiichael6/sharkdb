//! Las carpetas de las ejecuciones de una programación: `<carpeta>/<nombre>/<AAAA-MM-DD_HHMM>` (D16),
//! con `_2`, `_3`… si dos caen en el mismo minuto. Solo se listan y borran las que tienen ese nombre.

use std::fs;
use std::path::Path;

/// Largo de `2026-10-31_0230`.
const STAMP_LEN: usize = 15;

/// `2026-10-31_0230`: dígitos con `-` en 4 y 7 y `_` en 10.
fn is_stamp(stamp: &str) -> bool {
    stamp.len() == STAMP_LEN
        && stamp.char_indices().all(|(i, c)| match i {
            4 | 7 => c == '-',
            10 => c == '_',
            _ => c.is_ascii_digit(),
        })
}

/// `2026-10-31_0230` o `2026-10-31_0230_2`.
pub fn is_run_name(name: &str) -> bool {
    if !name.is_ascii() || name.len() < STAMP_LEN {
        return false;
    }
    let (stamp, repeat) = name.split_at(STAMP_LEN);
    let repeat_ok = match repeat.strip_prefix('_') {
        Some(digits) => !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()),
        None => repeat.is_empty(),
    };
    is_stamp(stamp) && repeat_ok
}

/// Las carpetas de ejecución que hay en `parent`, por nombre; ninguna si aún no existe.
pub fn list_runs(parent: &Path) -> Result<Vec<String>, String> {
    if !parent.is_dir() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(parent).map_err(|e| format!("No se pudo leer {}: {e}", parent.display()))?;
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| is_run_name(name))
        .collect();
    names.sort();
    Ok(names)
}

/// Borra las ejecuciones `names` de `parent`. Rechaza cualquier nombre que no sea de una ejecución:
/// así nunca se borra fuera de la carpeta de la programación.
pub fn remove_runs(parent: &Path, names: &[String]) -> Result<(), String> {
    if let Some(name) = names.iter().find(|name| !is_run_name(name)) {
        return Err(format!("“{name}” no es una carpeta de ejecución: no se borra"));
    }
    for name in names {
        let run = parent.join(name);
        if run.is_dir() {
            fs::remove_dir_all(&run).map_err(|e| format!("No se pudo borrar {}: {e}", run.display()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_only_run_folders() {
        assert!(is_run_name("2026-10-31_0230"));
        assert!(is_run_name("2026-10-31_0230_12"));
        let others = ["notas", "2026-10-31", "2026-10-31_0230_", "2026-10-31_0230_x", "..", "2026-10-31_0230/../x", "2026/10/31_0230"];
        for name in others {
            assert!(!is_run_name(name), "{name}");
        }
    }

    #[test]
    fn lists_and_removes_runs_and_nothing_else() {
        let parent = std::env::temp_dir().join(format!("robo3b-runs-{}", std::process::id()));
        assert_eq!(list_runs(&parent).unwrap(), Vec::<String>::new());
        for name in ["2026-10-30_0200", "2026-10-31_0200", "2026-10-31_0200_2", "notas"] {
            fs::create_dir_all(parent.join(name)).unwrap();
        }
        fs::write(parent.join("2026-10-29_0200"), "un archivo, no una carpeta").unwrap();
        assert_eq!(list_runs(&parent).unwrap(), ["2026-10-30_0200", "2026-10-31_0200", "2026-10-31_0200_2"]);

        assert!(remove_runs(&parent, &["..".into()]).is_err());
        remove_runs(&parent, &["2026-10-30_0200".into(), "2026-10-31_0200".into()]).unwrap();
        assert_eq!(list_runs(&parent).unwrap(), ["2026-10-31_0200_2"]);
        assert!(parent.join("notas").is_dir());
        fs::remove_dir_all(parent).unwrap();
    }
}
