//! The extractors that turn a bearer token into a caller.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::TypedHeader;
use axum_extra::headers::Authorization;
use axum_extra::headers::authorization::Bearer;
use sea_orm::EntityTrait;

use crate::auth::jwt::Claims;
use crate::entities::users;
use crate::error::ApiError;
use crate::state::AppState;

/// A verified caller. Ask for it in a handler's arguments and the route is
/// authenticated; leave it out and the route is public.
///
/// The claims inside describe the user *as of when the token was signed*. Where
/// that matters - anything acting on the user's current name, admin flag or
/// active status - read the row instead.
pub struct CurrentUser(pub Claims);

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // A missing header, a malformed one and a bad token are all the same 401:
        // an unauthenticated caller learns nothing about why.
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| ApiError::Unauthorized("Not authenticated".to_string()))?;

        state.jwt.verify(bearer.token()).map(CurrentUser)
    }
}

/// A verified caller who administers this instance, as the `users` row says so
/// right now. Ask for it instead of `CurrentUser` and the route is admin-only.
///
/// It reads the row rather than trusting `claims.admin`, and that is the whole
/// point of it existing: the flag in a token is a photograph of the moment it
/// was signed, and a "remember me" token lives for thirty days. Somebody whose
/// admin rights were taken away this morning still carries a token that says
/// otherwise, and so does somebody whose account was deactivated.
///
/// A caller with no usable token gets the same 401 `CurrentUser` gives. A real,
/// signed-in user who simply is not an admin gets a 403 - they already know who
/// they are, so naming the rule tells them nothing they could not work out, and
/// it is the only answer they can act on.
pub struct InstanceAdmin(pub users::Model);

impl FromRequestParts<AppState> for InstanceAdmin {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let CurrentUser(claims) = CurrentUser::from_request_parts(parts, state).await?;

        let user = users::Entity::find_by_id(claims.sub)
            .one(&state.db)
            .await?
            .filter(|user| user.is_active);

        // A token for a user who has since been deleted or deactivated is no
        // better than no token at all, and is answered the same way.
        let Some(user) = user else {
            return Err(ApiError::Unauthorized("Not authenticated".to_string()));
        };

        if !user.is_instance_admin {
            return Err(ApiError::Forbidden(
                "Only an instance admin can change this".to_string(),
            ));
        }

        Ok(Self(user))
    }
}
