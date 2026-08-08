use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // What kind of thing a book is - a novel, a manga, a textbook. Instance-
        // wide rather than per-library: the same shelf of manga does not stop
        // being manga because it was filed somewhere else, and a vocabulary that
        // forked per library would make "everything I own of this kind" a
        // question with no answer.
        //
        // A table rather than a `media_type` enum, unlike `library_role` in
        // m0004, and the difference is who decides. There are exactly three
        // roles and nothing should let an instance invent a fourth; media types
        // are the opposite - what somebody collects is theirs to name, and the
        // seed below is a starting point rather than the set.
        //
        // `lower(name)` is unique for the reason m0001 gives for `users.email`:
        // "Manga" and "manga" are one entry, and the column keeps the spelling
        // as it was typed. The violation reaches the caller as a 409 through
        // `From<DbErr>` without a handler having to look for it.
        //
        // The seed uses `gen_random_uuid()` rather than the UUIDv7 the handlers
        // mint. A migration has no application code to call, nothing ever orders
        // on these ids, and the alternative is fourteen hard-coded literals for
        // no gain.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE media_types (
                    id          UUID PRIMARY KEY,
                    name        TEXT NOT NULL,
                    description TEXT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE UNIQUE INDEX media_types_name_key ON media_types (lower(name));

                INSERT INTO media_types (id, name, description) VALUES
                    (gen_random_uuid(), 'Anthology', 'Collection of works by multiple authors'),
                    (gen_random_uuid(), 'Art Book', 'Illustration or art collection'),
                    (gen_random_uuid(), 'Comic Book', 'American/Western comic book issue'),
                    (gen_random_uuid(), 'Graphic Novel', 'Long-form comic narrative in book format'),
                    (gen_random_uuid(), 'Light Novel', 'Japanese illustrated prose novel (e.g. SAO, Re:Zero)'),
                    (gen_random_uuid(), 'Magazine', 'Periodical publication'),
                    (gen_random_uuid(), 'Manga', 'Japanese comic book / graphic novel'),
                    (gen_random_uuid(), 'Manhua', 'Chinese comic'),
                    (gen_random_uuid(), 'Manhwa', 'Korean comic / webtoon'),
                    (gen_random_uuid(), 'Non-Fiction', 'Factual prose — biography, history, science, etc.'),
                    (gen_random_uuid(), 'Novel', 'Full-length fiction or non-fiction book'),
                    (gen_random_uuid(), 'RPG Sourcebook', 'Tabletop role-playing game supplement or core rulebook'),
                    (gen_random_uuid(), 'Short Story Collection', 'Anthology of short fiction by one author'),
                    (gen_random_uuid(), 'Textbook', 'Educational or academic text');
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS media_types;")
            .await?;

        Ok(())
    }
}
