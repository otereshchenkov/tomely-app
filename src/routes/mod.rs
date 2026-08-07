use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::ConnectionTrait;
use serde::Serialize;

use crate::error::ApiError;
use crate::state::AppState;

pub mod auth;
pub mod setup;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .merge(setup::router())
        .merge(auth::router())
        .with_state(state)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Health {
    status: &'static str,
    database: &'static str,
}

/// Liveness plus a real round trip to Postgres, so a healthy response means the
/// whole path works rather than just that the process is up.
async fn health(State(state): State<AppState>) -> Result<Json<Health>, ApiError> {
    state.db.execute_unprepared("SELECT 1").await?;

    Ok(Json(Health {
        status: "ok",
        database: "ok",
    }))
}
