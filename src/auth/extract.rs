//! The extractor that turns a bearer token into a caller.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::TypedHeader;
use axum_extra::headers::Authorization;
use axum_extra::headers::authorization::Bearer;

use crate::auth::jwt::Claims;
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
