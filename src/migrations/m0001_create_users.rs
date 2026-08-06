use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Email uniqueness is case-insensitive: `Alex@example.com` and
        // `alex@example.com` are the same person. A functional index does that
        // without pulling in the citext extension, and the column keeps the
        // address as the user typed it.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE users (
                    id                UUID PRIMARY KEY,
                    display_name      TEXT NOT NULL,
                    email             TEXT NOT NULL,
                    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
                    is_instance_admin BOOLEAN NOT NULL DEFAULT FALSE,
                    last_login_at     TIMESTAMPTZ,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE UNIQUE INDEX users_email_key ON users (lower(email));
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS users;")
            .await?;

        Ok(())
    }
}
