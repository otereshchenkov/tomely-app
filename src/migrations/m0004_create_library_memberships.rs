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
        // The three roles are values of a type rather than rows in a table: there
        // are exactly three, nothing lets an instance define a fourth, and a
        // lookup table for a closed set buys a join on every read and a seed that
        // can go missing. They are prefixed `library_` because they say what
        // somebody may do *in a library* - an instance-level role, if one ever
        // arrives, is a different question about a different scope and should not
        // have to fight for the word `owner`.
        //
        // - `library_owner`  full control, including sharing it and deleting it
        // - `library_editor` can add, edit and remove books, shelves and series
        // - `library_viewer` can browse the library but change nothing in it
        //
        // Adding a role means `ALTER TYPE library_role ADD VALUE`, in a migration,
        // which is the cost of the database refusing anything else outright.
        //
        // The primary owner gets a row here as well, with `library_owner` and a
        // null `invited_by`, because nobody invited them. That is the whole
        // difference between the primary owner and an owner: permission checks
        // read the role and never look at `libraries.owner_id`.
        //
        // `invited_by` is `ON DELETE SET NULL`: losing the person who invited you
        // must not lose your access. There is no index on `role` - three values
        // are not worth one, and the index this table used to carry was there to
        // back a foreign key that no longer exists.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TYPE library_role AS ENUM (
                    'library_owner',
                    'library_editor',
                    'library_viewer'
                );

                CREATE TABLE library_memberships (
                    id         UUID PRIMARY KEY,
                    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
                    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role       library_role NOT NULL,
                    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
                    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT library_memberships_library_user_key
                        UNIQUE (library_id, user_id)
                );

                CREATE INDEX library_memberships_user_id_idx ON library_memberships (user_id);
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // The table first: it holds a column of the type, so the type cannot go
        // while it stands.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                DROP TABLE IF EXISTS library_memberships;
                DROP TYPE IF EXISTS library_role;
                "#,
            )
            .await?;

        Ok(())
    }
}
