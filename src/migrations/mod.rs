//! Schema migrations - the source of truth for the database.
//!
//! Add a migration as `mXXXX_what_it_does.rs` next to this file, declare it
//! below, and register it in `migrations()`. The established style is raw SQL
//! through `manager.get_connection().execute_unprepared(...)` rather than the
//! schema-builder DSL, so the migration reads like the DDL it runs.
//!
//! Apply with `cargo run --bin migrate -- up`, then regenerate the entities in
//! `src/entities/` - never edit those by hand.

// `rust_2018_idioms` wants `&SchemaManager<'_>`, but these signatures belong to
// `MigrationTrait` and go through `#[async_trait]`, which makes that lifetime
// early-bound and stops the impl matching the trait (E0195). The elided form is
// the only one that compiles, so the lint is off for every migration in here
// rather than being worked around in each one.
#![allow(
    elided_lifetimes_in_paths,
    reason = "async_trait requires the elided form in MigrationTrait impls"
)]

pub use sea_orm_migration::prelude::*;

mod m0001_create_users;
mod m0002_create_user_identities;
mod m0003_create_roles;
mod m0004_create_libraries;
mod m0005_create_library_memberships;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m0001_create_users::Migration),
            Box::new(m0002_create_user_identities::Migration),
            Box::new(m0003_create_roles::Migration),
            Box::new(m0004_create_libraries::Migration),
            Box::new(m0005_create_library_memberships::Migration),
        ]
    }
}
