//! Migration CLI: `cargo run --bin migrate -- up | down | status | fresh`.
//!
//! Reads `DATABASE_URL` from the environment (or a local .env).

use sea_orm_migration::cli;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    cli::run_cli(tomely_api::Migrator).await;
}
