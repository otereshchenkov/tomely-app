use std::time::Duration;

use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};

/// Open the connection pool.
///
/// Sized for a long-lived server process, unlike the one-or-two connections a
/// Lambda wanted: the pool is shared by every concurrent request handler and
/// stays warm for the life of the container.
pub async fn connect() -> Result<DatabaseConnection, DbErr> {
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| DbErr::Custom("DATABASE_URL is not set".to_string()))?;

    let mut opt = ConnectOptions::new(url);
    opt.max_connections(10)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(5))
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .sqlx_logging(false);

    Database::connect(opt).await
}
