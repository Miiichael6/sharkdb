//! El setup token de Claude (el que imprime `claude setup-token`): se guarda en el almacén de
//! credenciales del sistema, nunca en un archivo.

use crate::secrets::Vault;

const ACCOUNT: &str = "claude:setup-token";
/// Los tokens de Anthropic empiezan así (`sk-ant-oat01-…` para el setup token).
const TOKEN_PREFIX: &str = "sk-ant-";

/// El token pegado, sin espacios alrededor, o por qué no parece un setup token.
pub fn validate(pasted: &str) -> Result<String, String> {
    let token = pasted.trim();
    if token.is_empty() {
        return Err("Pega el token que imprime `claude setup-token`".into());
    }
    if !token.starts_with(TOKEN_PREFIX) || token.chars().any(char::is_whitespace) {
        return Err(format!("Eso no parece un setup token: debe empezar por «{TOKEN_PREFIX}» y no tener espacios"));
    }
    Ok(token.to_string())
}

pub fn load(vault: &dyn Vault) -> Result<Option<String>, String> {
    vault.get(ACCOUNT)
}

/// Guarda el token pegado, si lo parece.
pub fn save(vault: &dyn Vault, pasted: &str) -> Result<(), String> {
    vault.set(ACCOUNT, &validate(pasted)?)
}

pub fn forget(vault: &dyn Vault) -> Result<(), String> {
    vault.delete(ACCOUNT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_pasted_token_and_trims_it() {
        assert_eq!(validate("  sk-ant-oat01-abc_DEF-123\n").unwrap(), "sk-ant-oat01-abc_DEF-123");
    }

    #[test]
    fn rejects_what_is_not_a_token() {
        assert!(validate("   ").is_err());
        assert!(validate("hola").is_err());
        assert!(validate("sk-ant-oat01 abc").is_err());
    }
}
