use super::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // One row per way a user can prove who they are. `provider` is `local`
        // for now; OIDC and passkeys arrive as new provider values rather than
        // as columns on `users`.
        //
        // `provider_subject` is the stable identifier the provider knows the
        // user by - the `sub` claim for OIDC, the user's own id for `local`.
        // The unique constraint over (provider, provider_subject) is what stops
        // two users binding the same external account.
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                CREATE TABLE user_identities (
                    id               UUID PRIMARY KEY,
                    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    provider         VARCHAR(64) NOT NULL,
                    provider_subject TEXT NOT NULL,
                    credentials      JSONB,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                    last_used_at     TIMESTAMPTZ,
                    CONSTRAINT user_identities_provider_subject_key
                        UNIQUE (provider, provider_subject)
                );

                CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);
                "#,
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("DROP TABLE IF EXISTS user_identities;")
            .await?;

        Ok(())
    }
}
