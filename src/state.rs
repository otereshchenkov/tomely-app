use sea_orm::DatabaseConnection;

/// Shared across every handler. `DatabaseConnection` is itself a pool handle,
/// so cloning this is cheap.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
}
