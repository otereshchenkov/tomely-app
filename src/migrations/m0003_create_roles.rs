use super::*;

use uuid::Uuid;

#[derive(DeriveMigrationName)]
pub struct Migration;

/// The roles every instance starts with.
///
/// Referenced by name from the API - see `OWNER_ROLE` in `routes/libraries.rs` -
/// which is what lets their ids be generated per installation rather than fixed
/// here. Renaming one of these breaks that lookup; adding a role does not.
const SYSTEM_ROLES: [(&str, &str); 3] = [
    (
        "owner",
        "Full control of the library, including sharing it and deleting it.",
    ),
    (
        "editor",
        "Can add, edit and remove books, shelves and series.",
    ),
    (
        "viewer",
        "Can browse the library but cannot change anything in it.",
    ),
];

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // What somebody is allowed to do, as rows rather than as an enum in the
        // code: the plan is for people to define their own roles later, and a
        // Postgres enum or a Rust `enum` would have to be migrated for each one.
        // `is_system` marks the three that ship with the instance - they are
        // referenced by name from the API and must not be renamed or deleted.
        //
        // Uniqueness on `lower(name)` for the same reason as `users_email_key`
        // in m0001: a user-defined "Owner" would otherwise sit alongside the
        // system `owner` and lookups by name would become ambiguous.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE roles (
                    id          UUID PRIMARY KEY,
                    name        VARCHAR(64) NOT NULL,
                    description TEXT,
                    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE UNIQUE INDEX roles_name_key ON roles (lower(name));
                "#,
            )
            .await?;

        // A separate statement, because the ids are minted here rather than
        // written down: two installations should not share role ids, so that
        // nothing anywhere can come to depend on a particular one.
        //
        // Generated with `Uuid::now_v7()` rather than in SQL because Postgres
        // only grew `uuidv7()` in 18, and `gen_random_uuid()` would put v4s in a
        // schema where every other id is a v7.
        let values = SYSTEM_ROLES
            .iter()
            .map(|(name, description)| {
                format!(
                    "('{}', '{name}', '{}', TRUE)",
                    Uuid::now_v7(),
                    // These carry no apostrophes today. Doubling them anyway, so
                    // that adding a role with one does not quietly produce
                    // invalid SQL.
                    description.replace('\'', "''"),
                )
            })
            .collect::<Vec<_>>()
            .join(", ");

        manager
            .get_connection()
            .execute_unprepared(&format!(
                "INSERT INTO roles (id, name, description, is_system) VALUES {values};"
            ))
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS roles;")
            .await?;

        Ok(())
    }
}
