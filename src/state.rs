use std::sync::Arc;

use sea_orm::DatabaseConnection;

use crate::auth::JwtKeys;

/// Shared across every handler. `DatabaseConnection` is itself a pool handle and
/// the keys sit behind an `Arc`, so cloning this is cheap.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    /// Derived once at startup - building the HMAC keys per request would be
    /// pure waste.
    pub jwt: Arc<JwtKeys>,
}
