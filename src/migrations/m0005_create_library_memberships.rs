use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Who can see a library, and as what. One row per person per library -
        // hence the unique constraint - so "what may this caller do here?" is a
        // single lookup with no special cases.
        //
        // The primary owner gets a row here as well, with the `owner` role and a
        // null `invited_by`, because nobody invited them. That is the whole
        // difference between the primary owner and an owner: permission checks
        // read the role and never look at `libraries.owner_id`.
        //
        // `invited_by` is `ON DELETE SET NULL`: losing the person who invited you
        // must not lose your access. `role_id` is `RESTRICT`, so a role that is
        // still in use cannot be deleted out from under a membership.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE library_memberships (
                    id         UUID PRIMARY KEY,
                    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
                    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT library_memberships_library_user_key
                        UNIQUE (library_id, user_id)
                );

                CREATE INDEX library_memberships_user_id_idx ON library_memberships (user_id);
                CREATE INDEX library_memberships_role_id_idx ON library_memberships (role_id);
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS library_memberships;")
            .await?;

        Ok(())
    }
}
