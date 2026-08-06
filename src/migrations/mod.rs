//! Schema migrations - the source of truth for the database.
//!
//! Add a migration as `mXXXX_what_it_does.rs` next to this file, declare it
//! below, and register it in `migrations()`. The established style is raw SQL
//! through `manager.get_connection().execute_unprepared(...)` rather than the
//! schema-builder DSL, so the migration reads like the DDL it runs.
//!
//! Apply with `cargo run --bin migrate -- up`, then regenerate the entities in
//! `src/entities/` - never edit those by hand.

pub use sea_orm_migration::prelude::*;

mod m0001_create_users;
mod m0002_create_user_identities;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m0001_create_users::Migration),
            Box::new(m0002_create_user_identities::Migration),
        ]
    }
}
