//! Issuing and verifying the tokens the web app carries.
//!
//! One token, no refresh pair: the app is a single self-hosted instance, so the
//! machinery a refresh flow buys is not worth its moving parts yet. `remember_me`
//! only picks between the two lifetimes below.
//!
//! The claims are a convenience for the client, not an authority. Handlers that
//! care about the user re-read the row (see `routes/auth.rs::me`), so a token
//! outliving a deactivated account still cannot do anything.

use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::errors::ErrorKind;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::users;
use crate::error::ApiError;

/// Without "remember me": long enough for a sitting, gone by tomorrow.
const SESSION_TTL: Duration = Duration::hours(12);

/// With "remember me": the browser keeps it in localStorage across restarts.
const REMEMBER_ME_TTL: Duration = Duration::days(30);

/// What the API tells the client about itself, and checks on the way back in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Claims {
    /// The user id.
    pub sub: Uuid,
    pub email: String,
    pub name: String,
    /// `users.is_instance_admin` at the time the token was issued.
    pub admin: bool,
    pub iat: i64,
    pub exp: i64,
}

/// The HMAC keys, derived once at startup rather than per request.
pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
    validation: Validation,
}

impl JwtKeys {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret.as_bytes()),
            decoding: DecodingKey::from_secret(secret.as_bytes()),
            validation: Validation::new(Algorithm::HS256),
        }
    }

    /// Read `JWT_SECRET`, or explain what is missing.
    ///
    /// Deliberately has no fallback. A development default is a default that
    /// reaches production, and a signing secret everyone knows is the same as no
    /// authentication at all.
    pub fn from_env() -> Result<Self, String> {
        match std::env::var("JWT_SECRET") {
            Ok(secret) if !secret.trim().is_empty() => Ok(Self::new(&secret)),
            _ => Err(concat!(
                "JWT_SECRET is not set. Generate one with `openssl rand -base64 48` ",
                "and put it in .env - there is deliberately no default, because a ",
                "shared signing secret is the same as no authentication."
            )
            .to_string()),
        }
    }

    /// Sign a token for `user`, returning it alongside the moment it expires so
    /// the client does not have to decode the token to find out.
    pub fn issue(
        &self,
        user: &users::Model,
        remember_me: bool,
    ) -> Result<(String, DateTime<Utc>), ApiError> {
        let issued_at = Utc::now();
        let expires_at = issued_at
            + if remember_me {
                REMEMBER_ME_TTL
            } else {
                SESSION_TTL
            };

        let claims = Claims {
            sub: user.id,
            email: user.email.clone(),
            name: user.display_name.clone(),
            admin: user.is_instance_admin,
            iat: issued_at.timestamp(),
            exp: expires_at.timestamp(),
        };

        let token = encode(&Header::default(), &claims, &self.encoding)
            .map_err(|e| ApiError::Internal(format!("failed to sign token: {e}")))?;

        Ok((token, expires_at))
    }

    /// Verify a token's signature and expiry.
    ///
    /// Every failure is the same 401. The caller has no business knowing whether
    /// their token was forged, expired or gibberish.
    pub fn verify(&self, token: &str) -> Result<Claims, ApiError> {
        decode::<Claims>(token, &self.decoding, &self.validation)
            .map(|data| data.claims)
            .map_err(|e| match e.kind() {
                ErrorKind::ExpiredSignature => {
                    ApiError::Unauthorized("Session expired".to_string())
                }
                _ => ApiError::Unauthorized("Not authenticated".to_string()),
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use claims::{assert_err, assert_ok};

    fn user() -> users::Model {
        let now = Utc.with_ymd_and_hms(2026, 8, 7, 12, 0, 0).unwrap().into();

        users::Model {
            id: Uuid::now_v7(),
            display_name: "Jane Doe".to_string(),
            email: "jane@example.com".to_string(),
            is_active: true,
            is_instance_admin: true,
            last_login_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn a_token_round_trips_its_claims() {
        let keys = JwtKeys::new("a-test-secret");
        let user = user();

        let (token, expires_at) = assert_ok!(keys.issue(&user, false));
        let claims = assert_ok!(keys.verify(&token));

        assert_eq!(claims.sub, user.id);
        assert_eq!(claims.email, "jane@example.com");
        assert_eq!(claims.name, "Jane Doe");
        assert!(claims.admin);
        assert_eq!(claims.exp, expires_at.timestamp());
    }

    #[test]
    fn remember_me_is_the_longer_lifetime() {
        let keys = JwtKeys::new("a-test-secret");
        let user = user();

        let (_, session) = assert_ok!(keys.issue(&user, false));
        let (_, remembered) = assert_ok!(keys.issue(&user, true));

        assert!(remembered > session);
        assert!(remembered - Utc::now() > Duration::days(29));
        assert!(session - Utc::now() < Duration::days(1));
    }

    #[test]
    fn a_token_signed_with_another_secret_is_rejected() {
        let ours = JwtKeys::new("a-test-secret");
        let theirs = JwtKeys::new("a-different-secret");

        let (token, _) = assert_ok!(theirs.issue(&user(), false));

        let err = assert_err!(ours.verify(&token));
        assert!(matches!(err, ApiError::Unauthorized(_)));
    }

    #[test]
    fn an_expired_token_is_rejected() {
        let keys = JwtKeys::new("a-test-secret");
        let user = user();

        // Sign the claims directly - `issue` will not mint a token in the past.
        let expired = Claims {
            sub: user.id,
            email: user.email.clone(),
            name: user.display_name.clone(),
            admin: user.is_instance_admin,
            iat: (Utc::now() - Duration::hours(2)).timestamp(),
            exp: (Utc::now() - Duration::hours(1)).timestamp(),
        };
        let token = assert_ok!(encode(&Header::default(), &expired, &keys.encoding));

        let err = assert_err!(keys.verify(&token));
        assert!(matches!(err, ApiError::Unauthorized(m) if m == "Session expired"));
    }

    #[test]
    fn gibberish_is_rejected() {
        let keys = JwtKeys::new("a-test-secret");

        assert_err!(keys.verify("not-a-token"));
        assert_err!(keys.verify(""));
    }
}
