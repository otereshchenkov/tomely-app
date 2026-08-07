//! Authentication: how a caller proves who they are.
//!
//! A user is a row in `users`; the ways they can prove it are rows in
//! `user_identities`. Today the only provider is `local` - an Argon2id password
//! hash in the identity's `credentials` blob. OIDC and passkeys arrive later as
//! new `provider` values, not as new columns, and nothing here assumes otherwise.
//!
//! Once proved, the caller carries a JWT. See `jwt.rs` for why there is only one.

pub mod extract;
pub mod jwt;
pub mod password;

pub use extract::CurrentUser;
pub use jwt::{Claims, JwtKeys};
pub use password::{hash_password, verify_dummy_password, verify_password};
