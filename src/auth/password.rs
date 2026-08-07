//! Password hashing for the `local` identity provider.
//!
//! Argon2id with the crate's default parameters, stored as a PHC string. The
//! string carries its own salt, algorithm and cost parameters, so the cost can be
//! raised later and old hashes keep verifying without a schema change.

use argon2::Argon2;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};

use crate::error::ApiError;

/// Hash a password for storage in `user_identities.credentials`.
pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);

    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| ApiError::Internal(format!("failed to hash password: {e}")))
}

/// Check a password against a stored PHC string.
///
/// A malformed stored hash is a `false`, not an error: the caller turns every
/// failed verification into the same 401, and a corrupt row must not be
/// distinguishable from a wrong password.
pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Spend the same time a real verification would, and learn nothing.
///
/// Called on the login path when no account matches, so that "no such email"
/// costs the same as "wrong password" and the difference cannot be timed to
/// enumerate which addresses have accounts.
///
/// Hashing rather than verifying against a stored dummy: `verify_password` runs
/// the same single Argon2 pass with the same default parameters, so the cost
/// matches, and this way there is no fallible constant to build and keep in step
/// with the current parameters.
pub fn verify_dummy_password(password: &str) {
    let _ = hash_password(password);
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use claims::assert_ok;

    use super::*;

    #[test]
    fn a_hash_verifies_against_its_own_password() {
        let hash = assert_ok!(hash_password("correct horse battery staple"));

        assert!(verify_password("correct horse battery staple", &hash));
    }

    #[test]
    fn a_wrong_password_does_not_verify() {
        let hash = assert_ok!(hash_password("correct horse battery staple"));

        assert!(!verify_password("Correct horse battery staple", &hash));
        assert!(!verify_password("", &hash));
    }

    #[test]
    fn the_same_password_hashes_differently_every_time() {
        // i.e. the salt is doing its job - two users with the same password must
        // not share a hash.
        let first = assert_ok!(hash_password("hunter2hunter2"));
        let second = assert_ok!(hash_password("hunter2hunter2"));

        assert_ne!(first, second);
        assert!(verify_password("hunter2hunter2", &first));
        assert!(verify_password("hunter2hunter2", &second));
    }

    #[test]
    fn a_hash_is_a_phc_string() {
        let hash = assert_ok!(hash_password("hunter2hunter2"));

        assert!(hash.starts_with("$argon2id$"), "unexpected hash: {hash}");
    }

    #[test]
    fn a_corrupt_stored_hash_is_a_failed_verification_not_a_panic() {
        assert!(!verify_password("anything", "not-a-phc-string"));
        assert!(!verify_password("anything", ""));
    }

    #[test]
    fn the_dummy_path_costs_what_a_real_verification_costs() {
        // The point of `verify_dummy_password` is entirely its cost: if it ever
        // became a no-op, an unknown email would return measurably faster than a
        // wrong password and the pair could be used to enumerate accounts. Only
        // the clock can catch that, so the bound is deliberately loose - it is
        // there to catch "does no work at all", not to measure anything.
        let hash = assert_ok!(hash_password("a real password"));

        let started = Instant::now();
        verify_password("a real password", &hash);
        let real = started.elapsed();

        let started = Instant::now();
        verify_dummy_password("a real password");
        let dummy = started.elapsed();

        assert!(
            dummy * 4 >= real,
            "the dummy path took {dummy:?} against a real {real:?} - it is not doing the work"
        );
    }
}
