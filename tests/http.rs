//! The HTTP contract of the setup and auth routes.
//!
//! Backed by `MockDatabase` rather than a real Postgres, so these run under a
//! plain `cargo test`. That covers status codes, request validation and what an
//! absent or bad token does; it does not cover the SQL itself - the advisory
//! lock and the unique indexes need a real database to mean anything.

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chrono::Utc;
use claims::assert_ok;
use http_body_util::BodyExt;
use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use tomely_api::auth::JwtKeys;
use tomely_api::entities::users;
use tomely_api::{routes, state::AppState};

const SECRET: &str = "a-secret-for-tests";

fn a_user() -> users::Model {
    let now = Utc::now().into();

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

/// A router whose database answers each query with the next batch given.
fn app(query_results: Vec<Vec<users::Model>>) -> Router {
    let db = MockDatabase::new(DatabaseBackend::Postgres)
        .append_query_results(query_results)
        // For statements that return no rows - /health's `SELECT 1`, the setup
        // transaction's advisory lock - the mock still wants an answer.
        .append_exec_results([MockExecResult {
            last_insert_id: 0,
            rows_affected: 1,
        }])
        .into_connection();

    routes::router(AppState {
        db,
        jwt: Arc::new(JwtKeys::new(SECRET)),
    })
}

async fn send(app: Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = assert_ok!(app.oneshot(request).await);
    let status = response.status();
    let body = assert_ok!(response.into_body().collect().await).to_bytes();

    // Every route in this app answers with JSON, including the error paths.
    let json = if body.is_empty() {
        Value::Null
    } else {
        assert_ok!(serde_json::from_slice(&body))
    };

    (status, json)
}

fn get(path: &str) -> Request<Body> {
    assert_ok!(Request::builder().uri(path).body(Body::empty()))
}

/// A GET carrying a bearer token.
fn get_with_token(path: &str, token: &str) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .uri(path)
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
    )
}

fn post(path: &str, body: &Value) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("POST")
            .uri(path)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
    )
}

/// A POST carrying a bearer token.
fn post_with_token(path: &str, token: &str, body: &Value) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("POST")
            .uri(path)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::from(body.to_string()))
    )
}

/// A token for `a_user()`, for the routes that only care that there is one.
fn a_token() -> String {
    let (token, _) = assert_ok!(JwtKeys::new(SECRET).issue(&a_user(), false));
    token
}

#[tokio::test]
async fn setup_status_reports_an_empty_instance_as_unconfigured() {
    let (status, body) = send(app(vec![vec![]]), get("/setup/status")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "initialized": false }));
}

#[tokio::test]
async fn setup_status_reports_an_instance_with_a_user_as_configured() {
    let (status, body) = send(app(vec![vec![a_user()]]), get("/setup/status")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "initialized": true }));
}

#[tokio::test]
async fn setup_status_needs_no_token() {
    // The client has to be able to ask this before it can possibly have one.
    let (status, _) = send(app(vec![vec![]]), get("/setup/status")).await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn setup_rejects_a_short_password() {
    let (status, body) = send(
        app(vec![]),
        post(
            "/setup",
            &json!({
                "displayName": "Jane Doe",
                "email": "jane@example.com",
                "password": "short",
            }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "BadRequest");
    assert_eq!(body["message"], "Password must be at least 8 characters");
}

#[tokio::test]
async fn setup_rejects_a_nonsense_email() {
    let (status, body) = send(
        app(vec![]),
        post(
            "/setup",
            &json!({
                "displayName": "Jane Doe",
                "email": "not-an-email",
                "password": "a good password",
            }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["message"], "That does not look like an email address");
}

#[tokio::test]
async fn setup_rejects_a_blank_display_name() {
    let (status, body) = send(
        app(vec![]),
        post(
            "/setup",
            &json!({
                "displayName": "   ",
                "email": "jane@example.com",
                "password": "a good password",
            }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["message"], "Display name is required");
}

#[tokio::test]
async fn me_refuses_a_caller_with_no_token() {
    let (status, body) = send(app(vec![]), get("/auth/me")).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Unauthorized");
    assert_eq!(body["message"], "Not authenticated");
}

#[tokio::test]
async fn me_refuses_a_token_that_is_not_one() {
    let (status, _) = send(app(vec![]), get_with_token("/auth/me", "nonsense")).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_refuses_a_token_signed_with_a_different_secret() {
    let (forged, _) = assert_ok!(JwtKeys::new("not-our-secret").issue(&a_user(), false));

    let (status, _) = send(
        app(vec![vec![a_user()]]),
        get_with_token("/auth/me", &forged),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_returns_the_user_behind_a_valid_token() {
    let user = a_user();
    let (token, _) = assert_ok!(JwtKeys::new(SECRET).issue(&user, false));

    let (status, body) = send(
        app(vec![vec![user.clone()]]),
        get_with_token("/auth/me", &token),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    // camelCase, and no hint of the credentials table.
    assert_eq!(
        body,
        json!({
            "id": user.id,
            "displayName": "Jane Doe",
            "email": "jane@example.com",
            "isInstanceAdmin": true,
        })
    );
}

#[tokio::test]
async fn me_refuses_a_valid_token_for_a_deactivated_user() {
    // The token is still perfectly good; the account behind it is not. This is
    // why /auth/me re-reads the row instead of trusting the claims.
    let mut user = a_user();
    let (token, _) = assert_ok!(JwtKeys::new(SECRET).issue(&user, false));
    user.is_active = false;

    let (status, _) = send(app(vec![vec![user]]), get_with_token("/auth/me", &token)).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_gives_an_unknown_address_nothing_to_go_on() {
    let (status, body) = send(
        app(vec![vec![]]),
        post(
            "/auth/login",
            &json!({ "email": "nobody@example.com", "password": "whatever" }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // Deliberately the same message a wrong password gets, so the response
    // cannot be used to find out which addresses have accounts.
    assert_eq!(body["message"], "Invalid email or password");
}

#[tokio::test]
async fn libraries_are_not_listed_to_a_caller_with_no_token() {
    // Access to a library is a membership row, and an anonymous caller has none.
    let (status, body) = send(app(vec![]), get("/libraries")).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["message"], "Not authenticated");
}

#[tokio::test]
async fn creating_a_library_needs_a_token() {
    let (status, _) = send(app(vec![]), post("/libraries", &json!({ "name": "Loft" }))).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_library_needs_a_name() {
    let (status, body) = send(
        app(vec![]),
        post_with_token("/libraries", &a_token(), &json!({ "name": "   " })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["message"], "Name is required");
}

#[tokio::test]
async fn a_library_the_caller_is_not_in_does_not_exist_as_far_as_they_know() {
    // No membership row, so the join comes back empty. A 404 rather than a 403:
    // a stranger should not be able to probe for which ids are real.
    let (status, body) = send(
        app(vec![vec![]]),
        get_with_token(&format!("/libraries/{}", Uuid::now_v7()), &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "NotFound");
}

#[tokio::test]
async fn health_still_works() {
    let (status, body) = send(app(vec![]), get("/health")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({
            "status": "ok",
            "database": "ok",
            "version": env!("CARGO_PKG_VERSION"),
        })
    );
}
