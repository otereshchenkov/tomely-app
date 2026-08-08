use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // What a book is about, as opposed to what kind of thing it is - which
        // is `media_types` next door. The two are separate because they answer
        // different questions and a book has one of the first and any number of
        // the second.
        //
        // A fixed list rather than free text, unlike tags: a genre is a shared
        // word, and letting every book invent one is how a library ends up with
        // "sci-fi", "Sci Fi" and "SF" as three different shelves. The list is
        // still the instance's to edit - shared, not fixed forever.
        //
        // No description column. A genre's name is the whole of it, and a
        // description nobody fills in is a column that only ever renders blank.
        // Adding one later is a single `ALTER TABLE`.
        //
        // `lower(name)` unique and `gen_random_uuid()` for the seed, both for
        // the reasons m0005 gives.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE genres (
                    id         UUID PRIMARY KEY,
                    name       TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE UNIQUE INDEX genres_name_key ON genres (lower(name));

                INSERT INTO genres (id, name) VALUES
                    (gen_random_uuid(), 'Action'),
                    (gen_random_uuid(), 'Adventure'),
                    (gen_random_uuid(), 'Biography'),
                    (gen_random_uuid(), 'Children''s'),
                    (gen_random_uuid(), 'Comedy'),
                    (gen_random_uuid(), 'Crime'),
                    (gen_random_uuid(), 'Drama'),
                    (gen_random_uuid(), 'Fantasy'),
                    (gen_random_uuid(), 'Graphic Novel'),
                    (gen_random_uuid(), 'Historical'),
                    (gen_random_uuid(), 'Horror'),
                    (gen_random_uuid(), 'Literary Fiction'),
                    (gen_random_uuid(), 'Manga'),
                    (gen_random_uuid(), 'Mystery'),
                    (gen_random_uuid(), 'Poetry'),
                    (gen_random_uuid(), 'Romance'),
                    (gen_random_uuid(), 'Science Fiction'),
                    (gen_random_uuid(), 'Self-Help'),
                    (gen_random_uuid(), 'Slice of Life'),
                    (gen_random_uuid(), 'Sports'),
                    (gen_random_uuid(), 'Supernatural'),
                    (gen_random_uuid(), 'Thriller'),
                    (gen_random_uuid(), 'Travel'),
                    (gen_random_uuid(), 'Western'),
                    (gen_random_uuid(), 'Young Adult');
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS genres;")
            .await?;

        Ok(())
    }
}
