use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use sea_orm::sea_query::{Expr, Func};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, ExprTrait, ModelTrait, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{CurrentUser, verify_dummy_password, verify_password};
use crate::entities::{user_identities, users};
use crate::error::ApiError;
use crate::state::AppState;

/// The `user_identities.provider` value for a password on this instance.
pub const LOCAL_PROVIDER: &str = "local";

/// Where the password hash lives inside `user_identities.credentials`.
pub const PASSWORD_HASH_KEY: &str = "password_hash";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/me", get(me))
}

/// The user as the client is allowed to see them.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: Uuid,
    pub display_name: String,
    pub email: String,
    pub is_instance_admin: bool,
}

impl From<users::Model> for UserResponse {
    fn from(user: users::Model) -> Self {
        Self {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            is_instance_admin: user.is_instance_admin,
        }
    }
}

/// What both `POST /setup` and `POST /auth/login` hand back.
///
/// `expiresAt` is redundant with the token's own `exp`, but it saves the client
/// decoding a token it otherwise only ever passes along.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginRequest {
    email: String,
    password: String,
    #[serde(default)]
    remember_me: bool,
}

/// The one message every failed login gets.
///
/// Unknown address, wrong password, deactivated account, an identity from some
/// other provider - all the same, so the response cannot be used to work out
/// which addresses have accounts.
fn invalid_credentials() -> ApiError {
    ApiError::Unauthorized("Invalid email or password".to_string())
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<SessionResponse>, ApiError> {
    let email = body.email.trim();

    // `lower(email)` rather than `email`: it matches the functional unique index
    // from m0001, so this is an index lookup and it treats Alex@ and alex@ as the
    // same person the way the index does.
    let user = users::Entity::find()
        .filter(Expr::expr(Func::lower(Expr::col(users::Column::Email))).eq(email.to_lowercase()))
        .one(&state.db)
        .await?;

    let Some(user) = user.filter(|u| u.is_active) else {
        // No account, or a disabled one. Verify anyway: returning here without
        // hashing would make an unknown address measurably faster to reject.
        verify_dummy_password(&body.password);
        return Err(invalid_credentials());
    };

    let identity = user
        .find_related(user_identities::Entity)
        .filter(user_identities::Column::Provider.eq(LOCAL_PROVIDER))
        .one(&state.db)
        .await?;

    let Some(identity) = identity else {
        // A user who only has, say, an OIDC identity cannot sign in with a
        // password - and should not learn that from the timing either.
        verify_dummy_password(&body.password);
        return Err(invalid_credentials());
    };

    let stored_hash = identity
        .credentials
        .as_ref()
        .and_then(|c| c.get(PASSWORD_HASH_KEY))
        .and_then(|h| h.as_str());

    let Some(stored_hash) = stored_hash else {
        verify_dummy_password(&body.password);
        return Err(invalid_credentials());
    };

    if !verify_password(&body.password, stored_hash) {
        return Err(invalid_credentials());
    }

    let (token, expires_at) = state.jwt.issue(&user, body.remember_me)?;
    let now = Utc::now().into();

    // Best-effort bookkeeping, but a failure here is a real database problem, so
    // let it surface rather than swallowing it.
    user_identities::ActiveModel {
        id: Set(identity.id),
        last_used_at: Set(Some(now)),
        ..Default::default()
    }
    .update(&state.db)
    .await?;

    let user = users::ActiveModel {
        id: Set(user.id),
        last_login_at: Set(Some(now)),
        ..Default::default()
    }
    .update(&state.db)
    .await?;

    Ok(Json(SessionResponse {
        token,
        expires_at,
        user: user.into(),
    }))
}

/// Who the bearer of this token is, according to the database rather than the
/// token.
///
/// Re-reading the row is the point: it is what makes deactivating a user take
/// effect immediately instead of whenever their token happens to expire.
async fn me(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
) -> Result<Json<UserResponse>, ApiError> {
    let user = users::Entity::find_by_id(claims.sub)
        .one(&state.db)
        .await?
        .filter(|u| u.is_active)
        .ok_or_else(|| ApiError::Unauthorized("Not authenticated".to_string()))?;

    Ok(Json(user.into()))
}
