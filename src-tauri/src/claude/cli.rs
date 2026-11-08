//! Cómo se lanza Claude Code para el chat: dónde está el ejecutable y con qué argumentos y variables.
//! Sin herramientas propias (ni Bash, ni archivos): solo las del servidor MCP de la app.

use std::path::{Path, PathBuf};

use serde_json::json;

/// Variable con la que Claude Code toma el setup token en vez de su propio login.
pub const OAUTH_TOKEN_ENV: &str = "CLAUDE_CODE_OAUTH_TOKEN";
/// Variable que lleva el token bearer del servidor MCP; la config la cita como `${…}`, así el
/// token no aparece en la línea de comandos.
pub const MCP_TOKEN_ENV: &str = "SHARKDB_MCP_TOKEN";
/// Variables que harían que Claude Code ignorase el setup token.
pub const OVERRIDING_ENV: &[&str] = &["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];
/// Nombre del servidor en la config: las herramientas se llaman `mcp__sharkdb__<herramienta>`.
pub const MCP_SERVER_NAME: &str = "sharkdb";

#[cfg(windows)]
const EXECUTABLE: &str = "claude.exe";
#[cfg(not(windows))]
const EXECUTABLE: &str = "claude";
/// Donde lo deja el instalador nativo, aunque no esté en el PATH.
const NATIVE_INSTALL_DIR: &str = ".local/bin";

pub const NOT_INSTALLED: &str =
    "No se encontró Claude Code. Instálalo (npm install -g @anthropic-ai/claude-code) y vuelve a intentarlo";

const SYSTEM_PROMPT: &str = "Estás dentro de SharkDB, un cliente de escritorio para MongoDB. \
Responde en el idioma del usuario y de forma concisa. Consulta las bases de datos solo con las herramientas \
del servidor sharkdb (empieza por list_connections). Antes de cualquier escritura (insert, update, delete, \
$out, $merge) explica qué vas a modificar y espera a que el usuario lo confirme.";

/// El primer `claude` que hay en `dirs`.
fn find_in(dirs: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    dirs.into_iter().map(|dir| dir.join(EXECUTABLE)).find(|path| path.is_file())
}

/// El ejecutable de Claude Code: el del PATH o, si no, el del instalador nativo.
pub fn find_executable() -> Result<PathBuf, String> {
    let path_dirs = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect::<Vec<_>>()).unwrap_or_default();
    let native = dirs::home_dir().map(|home| home.join(NATIVE_INSTALL_DIR));
    find_in(path_dirs.into_iter().chain(native)).ok_or_else(|| NOT_INSTALLED.to_string())
}

/// La config MCP con solo el servidor de la app.
pub fn mcp_config(url: &str) -> String {
    json!({
        "mcpServers": {
            MCP_SERVER_NAME: {
                "type": "http",
                "url": url,
                "headers": { "Authorization": format!("Bearer ${{{MCP_TOKEN_ENV}}}") },
            }
        }
    })
    .to_string()
}

/// Argumentos de una conversación por stream-json; `resume` continúa la anterior.
pub fn args(mcp_url: &str, resume: Option<&str>) -> Vec<String> {
    let mut args: Vec<String> = [
        "--print",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--strict-mcp-config",
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        // Ni hooks ni ajustes del usuario: la carpeta de trabajo propia no tiene ajustes de proyecto.
        "--setting-sources",
        "project",
    ]
    .map(String::from)
    .into();
    args.extend(["--mcp-config".into(), mcp_config(mcp_url)]);
    args.extend(["--allowedTools".into(), format!("mcp__{MCP_SERVER_NAME}")]);
    args.extend(["--append-system-prompt".into(), SYSTEM_PROMPT.into()]);
    if let Some(session) = resume {
        args.extend(["--resume".into(), session.into()]);
    }
    args
}

/// Carpeta de trabajo de Claude: una propia, para que no cargue el CLAUDE.md de ningún proyecto.
pub fn working_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("claude")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn value_after<'a>(args: &'a [String], flag: &str) -> Option<&'a str> {
        args.iter().position(|a| a == flag).map(|i| args[i + 1].as_str())
    }

    #[test]
    fn only_the_app_mcp_server_and_no_builtin_tools() {
        let args = args("http://127.0.0.1:5000/mcp", None);
        assert_eq!(value_after(&args, "--tools"), Some(""));
        assert_eq!(value_after(&args, "--allowedTools"), Some("mcp__sharkdb"));
        assert!(args.contains(&"--strict-mcp-config".to_string()));
        assert_eq!(value_after(&args, "--setting-sources"), Some("project"));
        assert!(value_after(&args, "--resume").is_none());
        let config: Value = serde_json::from_str(value_after(&args, "--mcp-config").unwrap()).unwrap();
        let server = &config["mcpServers"]["sharkdb"];
        assert_eq!(server["url"], "http://127.0.0.1:5000/mcp");
        assert_eq!(server["headers"]["Authorization"], "Bearer ${SHARKDB_MCP_TOKEN}");
    }

    #[test]
    fn resumes_the_previous_conversation() {
        let args = args("http://x", Some("abc"));
        assert_eq!(value_after(&args, "--resume"), Some("abc"));
    }

    #[test]
    fn finds_the_executable_in_the_first_directory_that_has_it() {
        let root = std::env::temp_dir().join(format!("sharkdb-cli-{}", std::process::id()));
        let (empty, with) = (root.join("a"), root.join("b"));
        std::fs::create_dir_all(&empty).unwrap();
        std::fs::create_dir_all(&with).unwrap();
        std::fs::write(with.join(EXECUTABLE), "").unwrap();
        assert_eq!(find_in([empty.clone(), with.clone()]), Some(with.join(EXECUTABLE)));
        assert_eq!(find_in([empty]), None);
        std::fs::remove_dir_all(root).unwrap();
    }
}
