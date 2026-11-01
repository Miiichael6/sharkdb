// Passwords and passphrases never reach connections.json: before writing, they're moved to the
// OS credential store (Windows Credential Manager, macOS Keychain, Secret Service) under
// `<connection id>:<field>`, and put back when the file is read.
use serde_json::Value;

const SERVICE: &str = "sharkdb";
/// Where the app kept them while it was called Robo3B: `get` moves each one over the first time it's read.
const OLD_SERVICE: &str = "robo3b";

/// Where secrets live. The real one is the OS keyring; tests use an in-memory map.
pub trait Vault {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, secret: &str) -> Result<(), String>;
    fn delete(&self, account: &str) -> Result<(), String>;
}

pub struct KeyringVault;

fn keyring_entry(service: &str, account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, account).map_err(|e| format!("Almacén de credenciales: {e}"))
}

fn read_secret(entry: &keyring::Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Almacén de credenciales: {e}")),
    }
}

impl Vault for KeyringVault {
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        if let Some(secret) = read_secret(&keyring_entry(SERVICE, account)?)? {
            return Ok(Some(secret));
        }
        let old = keyring_entry(OLD_SERVICE, account)?;
        let Some(secret) = read_secret(&old)? else {
            return Ok(None);
        };
        self.set(account, &secret)?;
        // Already saved under the new name; `delete` retries the old copy if it stays.
        let _ = old.delete_credential();
        Ok(Some(secret))
    }

    fn set(&self, account: &str, secret: &str) -> Result<(), String> {
        keyring_entry(SERVICE, account)?
            .set_password(secret)
            .map_err(|e| format!("Almacén de credenciales: {e}"))
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        // Also the old copy, or `get` would bring a deleted secret back.
        for service in [SERVICE, OLD_SERVICE] {
            match keyring_entry(service, account)?.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(e) => return Err(format!("Almacén de credenciales: {e}")),
            }
        }
        Ok(())
    }
}

/// A field of a saved connection that holds a secret.
#[derive(Clone, Copy)]
enum SecretField {
    /// JSON pointer to a plain string field.
    Field(&'static str),
    /// The password embedded in the `uri` field (`scheme://user:password@host`).
    UriPassword,
}

const SECRET_FIELDS: [(&str, SecretField); 4] = [
    ("password", SecretField::Field("/password")),
    ("ssh.password", SecretField::Field("/ssh/password")),
    ("ssh.passphrase", SecretField::Field("/ssh/passphrase")),
    ("uri.password", SecretField::UriPassword),
];

const URI_FIELD: &str = "/uri";

impl SecretField {
    /// Blanks the secret in `conn` and returns it (empty if there was none).
    fn take(self, conn: &mut Value) -> String {
        let pointer = match self {
            SecretField::Field(pointer) => pointer,
            SecretField::UriPassword => URI_FIELD,
        };
        let Some(Value::String(text)) = conn.pointer_mut(pointer) else {
            return String::new();
        };
        match self {
            SecretField::Field(_) => std::mem::take(text),
            SecretField::UriPassword => {
                let (without, password) = split_uri_password(text);
                *text = without;
                password
            }
        }
    }

    fn put(self, conn: &mut Value, secret: &str) {
        match self {
            SecretField::Field(pointer) => {
                if let Some(Value::String(text)) = conn.pointer_mut(pointer) {
                    *text = secret.to_string();
                }
            }
            SecretField::UriPassword => {
                if let Some(Value::String(uri)) = conn.pointer_mut(URI_FIELD) {
                    *uri = join_uri_password(uri, secret);
                }
            }
        }
    }
}

/// Byte offsets of the credentials in `scheme://user:password@host...`: the end of `://`,
/// the `:` before the password and the `@` after it.
fn uri_password_span(uri: &str) -> Option<(usize, usize)> {
    let start = uri.find("://")? + 3;
    let rest = &uri[start..];
    let authority = &rest[..rest.find(['/', '?']).unwrap_or(rest.len())];
    let at = authority.rfind('@')?;
    let colon = authority[..at].find(':');
    Some((start + colon.unwrap_or(at), start + at))
}

/// The URI without its password, and the password (still URL-encoded).
fn split_uri_password(uri: &str) -> (String, String) {
    match uri_password_span(uri) {
        Some((colon, at)) if colon < at => (
            format!("{}{}", &uri[..colon], &uri[at..]),
            uri[colon + 1..at].to_string(),
        ),
        _ => (uri.to_string(), String::new()),
    }
}

fn join_uri_password(uri: &str, password: &str) -> String {
    match uri_password_span(uri) {
        // Only into a URI that has a user and no password yet.
        Some((colon, at)) if colon == at && !password.is_empty() => {
            format!("{}:{password}{}", &uri[..at], &uri[at..])
        }
        _ => uri.to_string(),
    }
}

fn account(id: &str, field: &str) -> String {
    format!("{id}:{field}")
}

fn connection_ids(connections: &Value) -> Vec<String> {
    connections
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|c| c.get("id")?.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// Moves every secret from the connection list into the vault, leaving them blank.
pub fn seal(connections: &mut Value, vault: &dyn Vault) -> Result<(), String> {
    let Some(list) = connections.as_array_mut() else {
        return Ok(());
    };
    for conn in list {
        let Some(id) = conn.get("id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        for (name, field) in SECRET_FIELDS {
            let secret = field.take(conn);
            if secret.is_empty() {
                vault.delete(&account(&id, name))?;
            } else {
                vault.set(&account(&id, name), &secret)?;
            }
        }
    }
    Ok(())
}

/// Fills the blanked secrets back in from the vault.
pub fn unseal(connections: &mut Value, vault: &dyn Vault) -> Result<(), String> {
    let Some(list) = connections.as_array_mut() else {
        return Ok(());
    };
    for conn in list {
        let Some(id) = conn.get("id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        for (name, field) in SECRET_FIELDS {
            if let Some(secret) = vault.get(&account(&id, name))? {
                field.put(conn, &secret);
            }
        }
    }
    Ok(())
}

/// True if the list still carries a secret in clear text (a file from an older version).
pub fn has_plain_secrets(connections: &Value) -> bool {
    let mut copy = connections.clone();
    copy.as_array_mut().is_some_and(|list| {
        list.iter_mut()
            .any(|conn| SECRET_FIELDS.iter().any(|(_, field)| !field.take(conn).is_empty()))
    })
}

/// Deletes the secrets of connections present in `before` but gone from `after`.
pub fn forget_removed(before: &Value, after: &Value, vault: &dyn Vault) -> Result<(), String> {
    let kept = connection_ids(after);
    for id in connection_ids(before).into_iter().filter(|id| !kept.contains(id)) {
        for (name, _) in SECRET_FIELDS {
            vault.delete(&account(&id, name))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Default)]
    struct MemoryVault(RefCell<HashMap<String, String>>);

    impl Vault for MemoryVault {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(self.0.borrow().get(account).cloned())
        }
        fn set(&self, account: &str, secret: &str) -> Result<(), String> {
            self.0.borrow_mut().insert(account.into(), secret.into());
            Ok(())
        }
        fn delete(&self, account: &str) -> Result<(), String> {
            self.0.borrow_mut().remove(account);
            Ok(())
        }
    }

    fn saved() -> Value {
        json!([{
            "id": "c1",
            "password": "p@ss",
            "uri": "mongodb://ana:s%40cret@h1:1,h2:2/db?authSource=admin",
            "ssh": { "enabled": true, "password": "sshpw", "passphrase": "" },
        }])
    }

    #[test]
    fn seal_blanks_every_secret_and_unseal_restores_them() {
        let vault = MemoryVault::default();
        let mut list = saved();
        seal(&mut list, &vault).unwrap();

        let text = list.to_string();
        for secret in ["p@ss", "s%40cret", "sshpw"] {
            assert!(!text.contains(secret), "{secret} left in {text}");
        }
        assert_eq!(list[0]["uri"], "mongodb://ana@h1:1,h2:2/db?authSource=admin");
        assert!(!has_plain_secrets(&list));
        assert_eq!(vault.0.borrow().len(), 3);

        unseal(&mut list, &vault).unwrap();
        assert_eq!(list, saved());
    }

    #[test]
    fn emptied_secrets_are_deleted_from_the_vault() {
        let vault = MemoryVault::default();
        seal(&mut saved(), &vault).unwrap();
        let mut list = saved();
        list[0]["ssh"]["password"] = json!("");
        seal(&mut list, &vault).unwrap();
        assert!(vault.get("c1:ssh.password").unwrap().is_none());
        assert!(vault.get("c1:password").unwrap().is_some());
    }

    #[test]
    fn plain_secrets_are_detected_in_legacy_files() {
        assert!(has_plain_secrets(&saved()));
        assert!(!has_plain_secrets(&json!([{ "id": "c1", "password": "", "uri": "mongodb://h:1" }])));
    }

    #[test]
    fn forgetting_removed_connections_drops_their_secrets() {
        let vault = MemoryVault::default();
        let before = saved();
        seal(&mut before.clone(), &vault).unwrap();
        forget_removed(&before, &json!([]), &vault).unwrap();
        assert!(vault.0.borrow().is_empty());
    }

    #[test]
    #[ignore = "uses the real OS credential store"]
    fn keyring_vault_round_trip() {
        let account = "sharkdb-test:password";
        KeyringVault.set(account, "s3cret").unwrap();
        assert_eq!(KeyringVault.get(account).unwrap().as_deref(), Some("s3cret"));
        KeyringVault.delete(account).unwrap();
        assert_eq!(KeyringVault.get(account).unwrap(), None);
    }

    #[test]
    #[ignore = "uses the real OS credential store"]
    fn keyring_vault_moves_secrets_saved_by_robo3b() {
        let account = "sharkdb-test:old-password";
        keyring_entry(OLD_SERVICE, account).unwrap().set_password("s3cret").unwrap();
        assert_eq!(KeyringVault.get(account).unwrap().as_deref(), Some("s3cret"));
        assert_eq!(read_secret(&keyring_entry(OLD_SERVICE, account).unwrap()).unwrap(), None);
        assert_eq!(read_secret(&keyring_entry(SERVICE, account).unwrap()).unwrap().as_deref(), Some("s3cret"));
        KeyringVault.delete(account).unwrap();
        assert_eq!(KeyringVault.get(account).unwrap(), None);
    }

    #[test]
    fn uri_password_split_and_join() {
        assert_eq!(split_uri_password("mongodb+srv://u:p@h/?x=a@b"), ("mongodb+srv://u@h/?x=a@b".into(), "p".into()));
        assert_eq!(split_uri_password("mongodb://u@h"), ("mongodb://u@h".into(), "".into()));
        assert_eq!(split_uri_password("mongodb://h:27017"), ("mongodb://h:27017".into(), "".into()));
        assert_eq!(join_uri_password("mongodb://u@h", "p"), "mongodb://u:p@h");
        assert_eq!(join_uri_password("mongodb://h", "p"), "mongodb://h");
        assert_eq!(join_uri_password("mongodb://u:x@h", "p"), "mongodb://u:x@h");
    }
}
