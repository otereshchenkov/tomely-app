use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // A library is the container everything else hangs off - books, shelves,
        // loans - so it is the first domain table.
        //
        // `owner_id` is the *primary* owner: whoever created it. It is not the
        // access check - that is a row in `library_memberships`, which the owner
        // gets too - it is the record of who cannot be removed from their own
        // library. `ON DELETE RESTRICT` rather than `CASCADE` for the same
        // reason: deleting a user must not silently take a library full of books
        // with it. Handing one over has to be deliberate, and that endpoint does
        // not exist yet.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE libraries (
                    id          UUID PRIMARY KEY,
                    name        TEXT NOT NULL,
                    description TEXT,
                    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE INDEX libraries_owner_id_idx ON libraries (owner_id);
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS libraries;")
            .await?;

        Ok(())
    }
}
