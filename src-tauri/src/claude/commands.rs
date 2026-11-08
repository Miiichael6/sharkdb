use tauri::{AppHandle, State};

use super::session::ClaudeChat;
use super::token;
use crate::secrets::KeyringVault;

#[tauri::command]
pub fn claude_has_token() -> Result<bool, String> {
    Ok(token::load(&KeyringVault)?.is_some())
}

#[tauri::command]
pub fn claude_save_token(token: String) -> Result<(), String> {
    token::save(&KeyringVault, &token)
}

/// Borra el token y corta la conversación, que lo estaba usando.
#[tauri::command]
pub async fn claude_forget_token(chat: State<'_, ClaudeChat>) -> Result<(), String> {
    chat.reset().await;
    token::forget(&KeyringVault)
}

#[tauri::command]
pub async fn claude_send(app: AppHandle, chat: State<'_, ClaudeChat>, text: String) -> Result<(), String> {
    chat.send(&app, &text).await
}

#[tauri::command]
pub async fn claude_stop(app: AppHandle, chat: State<'_, ClaudeChat>) -> Result<(), String> {
    chat.stop(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn claude_new_conversation(chat: State<'_, ClaudeChat>) -> Result<(), String> {
    chat.reset().await;
    Ok(())
}
