//! Transporte Streamable HTTP de MCP: un POST por mensaje JSON-RPC en `127.0.0.1`, con un token
//! bearer que solo conoce la app (y el Claude que lanza). Sin flujo SSE: cada respuesta va en JSON.

use std::convert::Infallible;
use std::future::Future;

use http_body_util::{BodyExt, Full, Limited};
use hyper::body::{Bytes, Incoming};
use hyper::header::{ALLOW, AUTHORIZATION, CONTENT_TYPE, ORIGIN};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde_json::Value;
use tokio::net::TcpListener;

pub const HOST: &str = "127.0.0.1";
pub const PATH: &str = "/mcp";
/// Tamaño máximo de un mensaje del cliente.
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;
const LOCAL_ORIGINS: &[&str] = &["http://127.0.0.1", "http://localhost", "https://127.0.0.1", "https://localhost"];

/// Si la petición puede pasar, o el código con el que se rechaza. Un `Origin` que no sea local se
/// rechaza: así una página web no puede llegar al servidor (DNS rebinding).
fn check(method: &Method, path: &str, authorization: Option<&str>, origin: Option<&str>, token: &str) -> Result<(), StatusCode> {
    if path != PATH {
        return Err(StatusCode::NOT_FOUND);
    }
    if origin.is_some_and(|o| !LOCAL_ORIGINS.iter().any(|local| o == *local || o.starts_with(&format!("{local}:")))) {
        return Err(StatusCode::FORBIDDEN);
    }
    if authorization != Some(format!("Bearer {token}").as_str()) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    if method != Method::POST {
        return Err(StatusCode::METHOD_NOT_ALLOWED);
    }
    Ok(())
}

fn empty(status: StatusCode) -> Response<Full<Bytes>> {
    let mut response = Response::new(Full::new(Bytes::new()));
    *response.status_mut() = status;
    if status == StatusCode::METHOD_NOT_ALLOWED {
        response.headers_mut().insert(ALLOW, "POST".parse().expect("valid header"));
    }
    response
}

fn json(value: &Value) -> Response<Full<Bytes>> {
    let mut response = Response::new(Full::new(Bytes::from(value.to_string())));
    response.headers_mut().insert(CONTENT_TYPE, "application/json".parse().expect("valid header"));
    response
}

async fn respond<H, F>(request: Request<Incoming>, token: &str, handler: H) -> Result<Response<Full<Bytes>>, Infallible>
where
    H: Fn(Bytes) -> F,
    F: Future<Output = Option<Value>>,
{
    let header = |name| request.headers().get(name).and_then(|v| v.to_str().ok());
    if let Err(status) = check(request.method(), request.uri().path(), header(AUTHORIZATION), header(ORIGIN), token) {
        return Ok(empty(status));
    }
    let Ok(body) = Limited::new(request.into_body(), MAX_BODY_BYTES).collect().await else {
        return Ok(empty(StatusCode::PAYLOAD_TOO_LARGE));
    };
    Ok(match handler(body.to_bytes()).await {
        Some(reply) => json(&reply),
        // Notificaciones y respuestas del cliente: aceptadas, sin cuerpo.
        None => empty(StatusCode::ACCEPTED),
    })
}

/// Atiende `listener` para siempre: cada mensaje autorizado pasa a `handler`.
pub async fn serve<H, F>(listener: TcpListener, token: String, handler: H)
where
    H: Fn(Bytes) -> F + Clone + Send + Sync + 'static,
    F: Future<Output = Option<Value>> + Send + 'static,
{
    loop {
        let Ok((stream, _)) = listener.accept().await else { continue };
        let (token, handler) = (token.clone(), handler.clone());
        tauri::async_runtime::spawn(async move {
            let service = service_fn(move |request| {
                let (token, handler) = (token.clone(), handler.clone());
                async move { respond(request, &token, handler).await }
            });
            let _ = http1::Builder::new().serve_connection(TokioIo::new(stream), service).await;
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "secreto";
    const AUTH: Option<&str> = Some("Bearer secreto");

    #[test]
    fn only_authorized_local_posts_to_the_mcp_path_pass() {
        assert_eq!(check(&Method::POST, PATH, AUTH, None, TOKEN), Ok(()));
        assert_eq!(check(&Method::POST, PATH, AUTH, Some("http://localhost:5173"), TOKEN), Ok(()));
        assert_eq!(check(&Method::POST, "/otro", AUTH, None, TOKEN), Err(StatusCode::NOT_FOUND));
        assert_eq!(check(&Method::POST, PATH, Some("Bearer otro"), None, TOKEN), Err(StatusCode::UNAUTHORIZED));
        assert_eq!(check(&Method::POST, PATH, None, None, TOKEN), Err(StatusCode::UNAUTHORIZED));
        assert_eq!(check(&Method::GET, PATH, AUTH, None, TOKEN), Err(StatusCode::METHOD_NOT_ALLOWED));
    }

    #[test]
    fn foreign_origins_are_forbidden() {
        assert_eq!(check(&Method::POST, PATH, AUTH, Some("https://evil.example"), TOKEN), Err(StatusCode::FORBIDDEN));
        assert_eq!(check(&Method::POST, PATH, AUTH, Some("http://localhost.evil.example"), TOKEN), Err(StatusCode::FORBIDDEN));
    }
}
