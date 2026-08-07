use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::{HeaderValue, Method, header};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use tomely_api::{auth::JwtKeys, db, routes, state::AppState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("tomely_api=debug,tower_http=debug,info")),
        )
        .init();

    // Both of these fail here rather than at the first request that needs them:
    // a server that cannot reach Postgres or cannot sign a token has nothing to
    // offer, and finding that out at boot beats finding it out from a 500.
    let jwt = Arc::new(JwtKeys::from_env()?);

    let db = db::connect().await?;
    tracing::info!("connected to the database");

    let app = routes::router(AppState { db, jwt })
        .layer(cors_layer()?)
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    // 0.0.0.0, not 127.0.0.1: inside a container the port has to be reachable
    // from outside the container.
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("listening on http://{addr}");

    axum::serve(listener, app).await?;

    Ok(())
}

/// In development the web app is same-origin (the Vite dev server proxies /api
/// here), so CORS never comes up. It matters once the two run as separate
/// containers on separate origins - hence CORS_ORIGIN.
fn cors_layer() -> Result<CorsLayer, Box<dyn std::error::Error>> {
    let layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    Ok(match std::env::var("CORS_ORIGIN") {
        Ok(origins) if !origins.trim().is_empty() => {
            let parsed = origins
                .split(',')
                .map(|o| HeaderValue::from_str(o.trim()))
                .collect::<Result<Vec<_>, _>>()?;
            layer.allow_origin(AllowOrigin::list(parsed))
        }
        _ => layer.allow_origin(AllowOrigin::any()),
    })
}
