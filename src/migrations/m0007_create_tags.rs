use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // The words a reader invents for their own shelves, as opposed to the
        // words the instance agrees on - which are `media_types` and `genres`.
        //
        // Per library, and that is the whole of the difference. m0006 argues a
        // genre must be instance-wide because "everything I own of this kind"
        // would otherwise be a question with no answer; a tag is the mirror
        // image. Two people's "to read" mean two different things, and a shared
        // list would make one of them wrong. So the same name may exist in two
        // libraries and mean whatever each owner wants.
        //
        // `lower(name)` unique, narrowed to the library: m0005's rule scoped to
        // the only place a tag is a shared word. "Heroic" and "heroic" are one
        // tag here and two rows in two libraries, and the violation reaches the
        // caller as a 409 through `From<DbErr>` with no handler looking for it.
        //
        // The `::text` on `library_id` is load-bearing and is not a conversion.
        // Written as `(library_id, lower(name))` the index has one ordinary key
        // column, and `sea-orm-cli generate entity` reads that as "library_id is
        // unique" - one tag per library, which is the opposite of the point -
        // and downgrades the relation to `has_one`. Casting makes the whole key
        // an expression, so the index is invisible to codegen exactly as
        // `media_types_name_key` is, and the entity comes out plain. uuid to
        // text is injective, so the rule it enforces is unchanged.
        //
        // Hence the separate `library_id` index: an all-expression key cannot
        // serve "every tag in this library", which is the only read there is.
        //
        // `color` is nullable TEXT rather than an enum, unlike `library_role` in
        // m0004, and for the reason m0005 gives for `media_types`: who decides.
        // The values are a UI palette the client is free to revise, not a closed
        // set the database should be enforcing, and a tag with no colour at all
        // is a real state rather than a missing one. `routes/tags.rs` validates
        // against the palette so a typo cannot land.
        //
        // No seed. A library starts with no tags and stays that way until
        // somebody has an opinion, which is the opposite of the catalogues.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE tags (
                    id         UUID PRIMARY KEY,
                    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
                    name       TEXT NOT NULL,
                    color      TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE UNIQUE INDEX tags_library_name_key
                    ON tags ((library_id::text), lower(name));

                CREATE INDEX tags_library_id_idx ON tags (library_id);
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS tags;")
            .await?;

        Ok(())
    }
}
