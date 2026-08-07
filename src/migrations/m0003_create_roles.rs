use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

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

                INSERT INTO roles (id, name, description, is_system) VALUES
                    (
                        '019fdd98-9008-7c9a-9c93-8a3643b2dec2',
                        'owner',
                        'Full control of the library, including sharing it and deleting it.',
                        TRUE
                    ),
                    (
                        '019fdd98-9008-7fa1-bb03-f871ae30df7f',
                        'editor',
                        'Can add, edit and remove books, shelves and series.',
                        TRUE
                    ),
                    (
                        '019fdd98-9008-71e4-a996-5a0c364f7cf0',
                        'viewer',
                        'Can browse the library but cannot change anything in it.',
                        TRUE
                    );
                "#,
            )
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
