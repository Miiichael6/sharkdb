// The app was called Robo3B, with identifier com.robo3b.app, and Tauri names its data folders after
// the identifier. On the first start as SharkDB the old folders are moved to the new names: the
// config one (connections, history, schedules, known_hosts) and the local data one (the webview
// profile, which holds localStorage). It runs before any window opens, because the webview creates
// its profile as soon as the window does. Passwords move from the old keyring service in `secrets`.
use std::fs;
use std::path::{Path, PathBuf};

const OLD_IDENTIFIER: &str = "com.robo3b.app";

/// Moves each old folder whose new one doesn't exist yet. If a move fails (Robo3B still open, another
/// volume), SharkDB starts with empty data and leaves the old folder untouched.
pub fn move_old_data(identifier: &str) {
    let mut roots = vec![dirs::config_dir(), dirs::data_local_dir()];
    // On macOS both are the same folder.
    roots.dedup();
    for root in roots.into_iter().flatten() {
        if let Err(e) = move_folder(&root, OLD_IDENTIFIER, identifier) {
            eprintln!("No se pudieron mover los datos de Robo3B en {}: {e}", root.display());
        }
    }
}

fn move_folder(root: &Path, old: &str, new: &str) -> std::io::Result<Option<PathBuf>> {
    let (from, to) = (root.join(old), root.join(new));
    if !from.is_dir() || to.exists() {
        return Ok(None);
    }
    fs::rename(&from, &to)?;
    Ok(Some(to))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sharkdb-rename-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn moves_the_old_folder_with_its_files() {
        let dir = root("move");
        fs::create_dir_all(dir.join("old/history")).unwrap();
        fs::write(dir.join("old/connections.json"), "[]").unwrap();
        assert_eq!(move_folder(&dir, "old", "new").unwrap(), Some(dir.join("new")));
        assert!(!dir.join("old").exists());
        assert_eq!(fs::read_to_string(dir.join("new/connections.json")).unwrap(), "[]");
        assert!(dir.join("new/history").is_dir());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn leaves_both_alone_once_the_new_folder_exists() {
        let dir = root("keep");
        fs::create_dir_all(dir.join("old")).unwrap();
        fs::create_dir_all(dir.join("new")).unwrap();
        assert_eq!(move_folder(&dir, "old", "new").unwrap(), None);
        assert!(dir.join("old").is_dir());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn nothing_to_move_without_an_old_folder() {
        let dir = root("none");
        assert_eq!(move_folder(&dir, "old", "new").unwrap(), None);
        assert!(!dir.join("new").exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
