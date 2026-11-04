//! Las carpetas de las ejecuciones de una programación: `<carpeta>/<nombre>/<AAAA-MM-DD_HHMM>` (D16),
//! con `_2`, `_3`… si dos caen en el mismo minuto. Solo se listan y borran las que tienen ese nombre.
//! Cada una dice si terminó bien: una sin terminar no cuenta para la retención (error 46). Se crean
//! en exclusiva: dos ejecuciones, aunque sean de instancias distintas, nunca comparten carpeta (error 60).

use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use serde::Serialize;

use crate::backup::folder::{is_marked_incomplete, mark_incomplete};

/// Una carpeta de ejecución y si su backup terminó bien.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RunFolder {
    pub name: String,
    pub complete: bool,
}

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
pub fn list_runs(parent: &Path) -> Result<Vec<RunFolder>, String> {
    if !parent.is_dir() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(parent).map_err(|e| format!("No se pudo leer {}: {e}", parent.display()))?;
    let mut runs: Vec<RunFolder> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok().filter(|name| is_run_name(name))?;
            Some(RunFolder { name, complete: !is_marked_incomplete(&entry.path()) })
        })
        .collect();
    runs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(runs)
}

/// Primer `_n` de una ejecución repetida en el mismo minuto.
const FIRST_REPEAT: u32 = 2;

/// Crea en `parent` la carpeta de una ejecución que empieza en `stamp` (`2026-10-31_0230`), o
/// `<stamp>_2`, `_3`… si ya existe, marcada como sin terminar; devuelve su nombre. Crearla es lo que
/// la reserva: si otra instancia la crea antes, esta pasa a la siguiente.
pub fn create_run(parent: &Path, stamp: &str) -> Result<String, String> {
    if !is_stamp(stamp) {
        return Err(format!("“{stamp}” no es la fecha de una ejecución"));
    }
    fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear {}: {e}", parent.display()))?;
    let mut repeat = FIRST_REPEAT - 1;
    loop {
        let name = if repeat < FIRST_REPEAT { stamp.to_string() } else { format!("{stamp}_{repeat}") };
        let run = parent.join(&name);
        match fs::create_dir(&run) {
            Ok(()) => {
                mark_incomplete(&run)?;
                return Ok(name);
            }
            Err(e) if e.kind() == ErrorKind::AlreadyExists => repeat += 1,
            Err(e) => return Err(format!("No se pudo crear {}: {e}", run.display())),
        }
    }
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

    fn names(parent: &Path) -> Vec<String> {
        list_runs(parent).unwrap().into_iter().map(|run| run.name).collect()
    }

    #[test]
    fn says_which_runs_did_not_finish() {
        let parent = std::env::temp_dir().join(format!("robo3b-runs-incomplete-{}", std::process::id()));
        let _ = fs::remove_dir_all(&parent);
        fs::create_dir_all(parent.join("2026-10-30_0200")).unwrap();
        crate::backup::folder::mark_incomplete(&parent.join("2026-10-31_0200")).unwrap();
        assert_eq!(
            list_runs(&parent).unwrap(),
            [
                RunFolder { name: "2026-10-30_0200".into(), complete: true },
                RunFolder { name: "2026-10-31_0200".into(), complete: false },
            ]
        );
        fs::remove_dir_all(parent).unwrap();
    }

    #[test]
    fn each_run_gets_a_folder_of_its_own() {
        let parent = std::env::temp_dir().join(format!("robo3b-runs-create-{}", std::process::id()));
        let _ = fs::remove_dir_all(&parent);
        assert_eq!(create_run(&parent, "2026-10-31_0200"), Ok("2026-10-31_0200".into()));
        assert_eq!(create_run(&parent, "2026-10-31_0200"), Ok("2026-10-31_0200_2".into()));
        assert_eq!(create_run(&parent, "2026-10-31_0200"), Ok("2026-10-31_0200_3".into()));
        assert!(create_run(&parent, "../x").is_err());
        // Recién creada cuenta como sin terminar hasta que su backup acabe bien.
        assert!(list_runs(&parent).unwrap().iter().all(|run| !run.complete));
        fs::remove_dir_all(parent).unwrap();
    }

    #[test]
    fn lists_and_removes_runs_and_nothing_else() {
        let parent = std::env::temp_dir().join(format!("robo3b-runs-{}", std::process::id()));
        assert_eq!(names(&parent), Vec::<String>::new());
        for name in ["2026-10-30_0200", "2026-10-31_0200", "2026-10-31_0200_2", "notas"] {
            fs::create_dir_all(parent.join(name)).unwrap();
        }
        fs::write(parent.join("2026-10-29_0200"), "un archivo, no una carpeta").unwrap();
        assert_eq!(names(&parent), ["2026-10-30_0200", "2026-10-31_0200", "2026-10-31_0200_2"]);

        assert!(remove_runs(&parent, &["..".into()]).is_err());
        remove_runs(&parent, &["2026-10-30_0200".into(), "2026-10-31_0200".into()]).unwrap();
        assert_eq!(names(&parent), ["2026-10-31_0200_2"]);
        assert!(parent.join("notas").is_dir());
        fs::remove_dir_all(parent).unwrap();
    }
}
