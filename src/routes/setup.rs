//! First-run setup.
//!
//! An instance with no rows in `users` has not been claimed yet. The web app
//! asks `GET /setup/status`, and if the answer is `false` it sends the visitor to
//! the setup wizard, which posts here exactly once to create the instance owner.
//! After that this endpoint is closed for good.

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use sea_orm::{ActiveModelTrait, ConnectionTrait, EntityTrait, NotSet, Set, TransactionTrait};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::auth::hash_password;
use crate::entities::{user_identities, users};
use crate::error::ApiError;
use crate::routes::auth::{LOCAL_PROVIDER, PASSWORD_HASH_KEY, SessionResponse};
use crate::state::AppState;

/// Arbitrary but fixed. Any connection running setup takes this advisory lock,
/// so two simultaneous requests cannot both find an empty table.
const SETUP_LOCK_KEY: i64 = 918_273_645;

/// Short enough to be no protection at all on its own, but it stops the obvious
/// mistake. Length is the only rule: composition rules push people toward
/// `Passw0rd!` and no further.
const MIN_PASSWORD_LENGTH: usize = 8;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/setup/status", get(status))
        .route("/setup", post(create))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SetupStatus {
    initialized: bool,
}

/// Public by necessity: the client has to be able to ask this before it has any
/// way to authenticate. It leaks only whether the instance has been claimed,
/// which is exactly what the login page reveals anyway.
async fn status(State(state): State<AppState>) -> Result<Json<SetupStatus>, ApiError> {
    Ok(Json(SetupStatus {
        initialized: instance_is_claimed(&state.db).await?,
    }))
}

async fn instance_is_claimed<C: ConnectionTrait>(db: &C) -> Result<bool, ApiError> {
    // The existence of any user is the whole question; no need to count them.
    Ok(users::Entity::find().one(db).await?.is_some())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetupRequest {
    display_name: String,
    email: String,
    password: String,
}

/// Create the instance owner.
///
/// The first account is an admin by definition - there is nobody else to grant
/// it - so `is_instance_admin` is set here and nowhere else yet.
async fn create(
    State(state): State<AppState>,
    Json(body): Json<SetupRequest>,
) -> Result<(StatusCode, Json<SessionResponse>), ApiError> {
    let display_name = body.display_name.trim();
    let email = body.email.trim();

    if display_name.is_empty() {
        return Err(ApiError::BadRequest("Display name is required".to_string()));
    }
    if !looks_like_an_email(email) {
        return Err(ApiError::BadRequest(
            "That does not look like an email address".to_string(),
        ));
    }
    if body.password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )));
    }

    // Hash before opening the transaction: Argon2 is deliberately slow, and
    // holding the setup lock across it would serialise nothing useful.
    let password_hash = hash_password(&body.password)?;

    let txn = state.db.begin().await?;

    // Check-then-insert is a race without this. Two requests arriving together
    // would both see an empty table and both create an owner; the lock makes the
    // second one wait and then find the first one's row. It is released when the
    // transaction ends, either way.
    txn.execute_unprepared(&format!("SELECT pg_advisory_xact_lock({SETUP_LOCK_KEY});"))
        .await?;

    if instance_is_claimed(&txn).await? {
        return Err(ApiError::Conflict(
            "This instance is already set up".to_string(),
        ));
    }

    let user = users::ActiveModel {
        id: Set(Uuid::now_v7()),
        display_name: Set(display_name.to_string()),
        email: Set(email.to_string()),
        is_active: Set(true),
        is_instance_admin: Set(true),
        last_login_at: NotSet,
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&txn)
    .await?;

    user_identities::ActiveModel {
        id: Set(Uuid::now_v7()),
        user_id: Set(user.id),
        provider: Set(LOCAL_PROVIDER.to_string()),
        // For `local` the provider is us, so the subject is the user's own id -
        // see the note in m0002.
        provider_subject: Set(user.id.to_string()),
        credentials: Set(Some(json!({ PASSWORD_HASH_KEY: password_hash }))),
        created_at: NotSet,
        updated_at: NotSet,
        last_used_at: NotSet,
    }
    .insert(&txn)
    .await?;

    txn.commit().await?;

    // Sign the owner in on the spot, so the wizard's last step is already
    // authenticated and "Go to dashboard" does not bounce off the login page.
    let (token, expires_at) = state.jwt.issue(&user, true)?;

    Ok((
        StatusCode::CREATED,
        Json(SessionResponse {
            token,
            expires_at,
            user: user.into(),
        }),
    ))
}

/// Enough to catch a typo, not an attempt at RFC 5322.
///
/// The address is only ever used as a login handle here; nothing is sent to it,
/// so a stricter check would reject real addresses for no gain.
fn looks_like_an_email(candidate: &str) -> bool {
    match candidate.split_once('@') {
        Some((local, domain)) => {
            !local.is_empty()
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
                && !candidate.contains(char::is_whitespace)
        }
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plausible_addresses_are_accepted() {
        assert!(looks_like_an_email("jane@example.com"));
        assert!(looks_like_an_email("jane.doe+books@mail.example.co.uk"));
    }

    #[test]
    fn obvious_mistakes_are_rejected() {
        assert!(!looks_like_an_email(""));
        assert!(!looks_like_an_email("jane"));
        assert!(!looks_like_an_email("jane@"));
        assert!(!looks_like_an_email("@example.com"));
        assert!(!looks_like_an_email("jane@localhost"));
        assert!(!looks_like_an_email("jane@example."));
        assert!(!looks_like_an_email("jane@.com"));
        assert!(!looks_like_an_email("jane doe@example.com"));
    }
}
