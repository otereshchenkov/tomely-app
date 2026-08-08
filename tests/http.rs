//! The HTTP contract of the setup and auth routes.
//!
//! Backed by `MockDatabase` rather than a real Postgres, so these run under a
//! plain `cargo test`. That covers status codes, request validation and what an
//! absent or bad token does; it does not cover the SQL itself - the advisory
//! lock and the unique indexes need a real database to mean anything.

use std::collections::BTreeMap;
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chrono::{DateTime, FixedOffset, Utc};
use claims::assert_ok;
use http_body_util::BodyExt;
use sea_orm::{ActiveEnum, DatabaseBackend, IntoMockRow, MockDatabase, MockExecResult};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

/// A database row as `MockDatabase` keeps one underneath: columns by name.
///
/// Used where the rows a route reads are not any one entity's `Model` - the
/// libraries projection, which is a `FromQueryResult` shape - and where a single
/// request queries two different tables, since the mock takes one row type for
/// the whole conversation.
type Row<'a> = BTreeMap<&'a str, sea_orm::Value>;

use tomely_api::auth::JwtKeys;
use tomely_api::entities::sea_orm_active_enums::LibraryRole;
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

/// The same user, as the columns `InstanceAdmin` reads them back out of.
///
/// A `BTreeMap` rather than the `Model` above because a request that gets past
/// that extractor goes on to query something else, and `MockDatabase` takes one
/// row type for the whole conversation - so the user has to be expressible in
/// the same shape as whatever follows it.
fn a_user_row(is_instance_admin: bool, is_active: bool) -> Row<'static> {
    let now: sea_orm::Value = Utc::now().fixed_offset().into();

    BTreeMap::from([
        ("id", Uuid::now_v7().into()),
        ("display_name", "Jane Doe".into()),
        ("email", "jane@example.com".into()),
        ("is_active", is_active.into()),
        ("is_instance_admin", is_instance_admin.into()),
        (
            "last_login_at",
            Option::<DateTime<FixedOffset>>::None.into(),
        ),
        ("created_at", now.clone()),
        ("updated_at", now),
    ])
}

/// A router whose database answers each query with the next batch given.
fn app(query_results: Vec<Vec<users::Model>>) -> Router {
    router_over(query_results)
}

/// The same, for routes whose queries do not come back as any one entity's
/// model.
///
/// The library routes project a library joined to a membership down to six
/// columns and a role, which is a `FromQueryResult` shape rather than a `Model` -
/// so the rows go in as the columns `MockDatabase` keeps underneath either way.
/// The catalogue routes use it for a different reason: `InstanceAdmin` reads a
/// `users` row before the handler reads anything else.
fn app_over_rows(query_results: Vec<Vec<Row<'_>>>) -> Router {
    router_over(query_results)
}

fn router_over<T: IntoMockRow>(query_results: Vec<Vec<T>>) -> Router {
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

/// A PUT carrying a bearer token.
fn put_with_token(path: &str, token: &str, body: &Value) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("PUT")
            .uri(path)
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::from(body.to_string()))
    )
}

fn put(path: &str, body: &Value) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("PUT")
            .uri(path)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
    )
}

/// A DELETE carrying a bearer token. No body - there is nothing to say.
fn delete_with_token(path: &str, token: &str) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("DELETE")
            .uri(path)
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
    )
}

fn delete(path: &str) -> Request<Body> {
    assert_ok!(
        Request::builder()
            .method("DELETE")
            .uri(path)
            .body(Body::empty())
    )
}

/// A library the caller is a member of, in the shape the membership join
/// returns it.
fn a_library_row(id: Uuid, owner: Uuid, role: &LibraryRole) -> Row<'static> {
    // `DateTime<Utc>`, matching `LibraryRow`'s own columns - a fixed-offset
    // value here deserializes as a different type and the row silently fails to
    // build, which surfaces as a 500 rather than as anything useful.
    let now: sea_orm::Value = Utc::now().into();

    BTreeMap::from([
        ("id", id.into()),
        ("name", "Loft".into()),
        ("description", Option::<String>::None.into()),
        ("owner_id", owner.into()),
        // A string, because that is what `TryGetable` reads a Postgres enum out
        // of - but the enum's own spelling of it, not the Rust variant name.
        // Anything `LibraryRole` cannot be built from surfaces as a 500 rather
        // than as anything useful.
        ("role", role.to_value().value.into_owned().into()),
        ("created_at", now.clone()),
        ("updated_at", now),
    ])
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
async fn renaming_a_library_needs_a_token() {
    let (status, _) = send(
        app(vec![]),
        put(
            &format!("/libraries/{}", Uuid::now_v7()),
            &json!({ "name": "Loft" }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn deleting_a_library_needs_a_token() {
    let (status, _) = send(
        app(vec![]),
        delete(&format!("/libraries/{}", Uuid::now_v7())),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_library_the_caller_is_not_in_cannot_be_renamed() {
    // The same empty join, and so the same 404 the read path gives, for the same
    // reason: a stranger learns nothing about which ids are real.
    let (status, body) = send(
        app(vec![vec![]]),
        put_with_token(
            &format!("/libraries/{}", Uuid::now_v7()),
            &a_token(),
            &json!({ "name": "Loft" }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "NotFound");
}

#[tokio::test]
async fn a_library_the_caller_is_not_in_cannot_be_deleted() {
    let (status, body) = send(
        app(vec![vec![]]),
        delete_with_token(&format!("/libraries/{}", Uuid::now_v7()), &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "NotFound");
}

#[tokio::test]
async fn a_member_who_is_not_an_owner_may_not_rename_a_library() {
    // A 403 rather than the 404 a non-member gets, and the difference is the
    // point: this caller has already been shown the library, so there is nothing
    // left to hide by pretending it is not there.
    let id = Uuid::now_v7();
    let (status, body) = send(
        app_over_rows(vec![vec![a_library_row(
            id,
            Uuid::now_v7(),
            &LibraryRole::LibraryEditor,
        )]]),
        put_with_token(
            &format!("/libraries/{id}"),
            &a_token(),
            &json!({ "name": "Loft" }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "Forbidden");
}

#[tokio::test]
async fn a_member_who_is_not_an_owner_may_not_delete_a_library() {
    let id = Uuid::now_v7();
    let (status, body) = send(
        app_over_rows(vec![vec![a_library_row(
            id,
            Uuid::now_v7(),
            &LibraryRole::LibraryViewer,
        )]]),
        delete_with_token(&format!("/libraries/{id}"), &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "Forbidden");
}

#[tokio::test]
async fn an_owner_renaming_a_library_still_has_to_give_it_a_name() {
    // Permission is checked before the name is: a caller who may not be here at
    // all should be told that, not corrected on their spelling. Reaching a 400
    // is what proves the owner got past the gate.
    let id = Uuid::now_v7();
    let (status, body) = send(
        app_over_rows(vec![vec![a_library_row(
            id,
            Uuid::now_v7(),
            &LibraryRole::LibraryOwner,
        )]]),
        put_with_token(
            &format!("/libraries/{id}"),
            &a_token(),
            &json!({ "name": "   " }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["message"], "Name is required");
}

/// A media type as its own table stores it.
fn a_media_type_row(id: Uuid) -> Row<'static> {
    let now: sea_orm::Value = Utc::now().fixed_offset().into();

    BTreeMap::from([
        ("id", id.into()),
        ("name", "Light Novel".into()),
        (
            "description",
            Some("Japanese illustrated prose".to_string()).into(),
        ),
        ("created_at", now.clone()),
        ("updated_at", now),
    ])
}

#[tokio::test]
async fn reading_the_catalogue_needs_a_token() {
    for path in ["/media-types", "/genres"] {
        let (status, _) = send(app(vec![]), get(path)).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
}

#[tokio::test]
async fn writing_to_the_catalogue_needs_a_token() {
    let id = Uuid::now_v7();

    for request in [
        post("/media-types", &json!({ "name": "Zine" })),
        put(&format!("/genres/{id}"), &json!({ "name": "Zine" })),
        delete(&format!("/genres/{id}")),
    ] {
        let (status, _) = send(app(vec![]), request).await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
}

#[tokio::test]
async fn anybody_signed_in_may_read_the_catalogue() {
    // Not admin-only, deliberately: the book form draws its media type field
    // from this, so a reader who may never edit the list still needs all of it.
    // A read takes `CurrentUser`, so there is no `users` row to answer first -
    // the list itself is the only query.
    let (status, body) = send(
        app_over_rows(vec![vec![]]),
        get_with_token("/media-types", &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!([]));
}

#[tokio::test]
async fn a_signed_in_user_who_is_not_an_admin_may_not_write_to_the_catalogue() {
    // The token says `admin: true` - `a_token()` signs `a_user()`, who is one -
    // and the row says otherwise. The row wins, which is the whole reason
    // `InstanceAdmin` reads it.
    let (status, body) = send(
        app_over_rows(vec![vec![a_user_row(false, true)]]),
        post_with_token("/genres", &a_token(), &json!({ "name": "Cosy Mystery" })),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "Forbidden");
}

#[tokio::test]
async fn a_deactivated_admin_is_not_authenticated_at_all() {
    // A 401 rather than the 403 a plain user gets: a deactivated account is not
    // somebody who may not do this, it is nobody.
    let (status, body) = send(
        app_over_rows(vec![vec![a_user_row(true, false)]]),
        post_with_token("/genres", &a_token(), &json!({ "name": "Cosy Mystery" })),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Unauthorized");
}

#[tokio::test]
async fn an_admin_adding_a_media_type_still_has_to_name_it() {
    // Permission is checked before the name is - `InstanceAdmin` is an extractor,
    // so it runs before the handler body. Reaching a 400 is what proves the admin
    // got past the gate.
    let (status, body) = send(
        app_over_rows(vec![vec![a_user_row(true, true)]]),
        post_with_token("/media-types", &a_token(), &json!({ "name": "   " })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["message"], "Name is required");
}

#[tokio::test]
async fn renaming_something_that_is_not_there_is_a_404() {
    let id = Uuid::now_v7();
    let (status, body) = send(
        // The admin row, then nothing where the media type would be.
        app_over_rows(vec![vec![a_user_row(true, true)], vec![]]),
        put_with_token(
            &format!("/media-types/{id}"),
            &a_token(),
            &json!({ "name": "Zine" }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "NotFound");
}

#[tokio::test]
async fn deleting_something_that_is_not_there_is_a_404() {
    let id = Uuid::now_v7();
    let (status, _) = send(
        app_over_rows(vec![vec![a_user_row(true, true)], vec![]]),
        delete_with_token(&format!("/genres/{id}"), &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_media_type_carries_a_book_count_the_page_can_draw() {
    // Zero until there is a `books` table, but on the wire now: the list draws a
    // badge from it and refuses delete when it is not zero, so the shape has to
    // be right before the number can become interesting.
    let id = Uuid::now_v7();
    let (status, body) = send(
        app_over_rows(vec![vec![a_media_type_row(id)]]),
        get_with_token("/media-types", &a_token()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body[0]["name"], "Light Novel");
    assert_eq!(body[0]["bookCount"], 0);
    // camelCase on the wire, like every other response here.
    assert!(body[0]["createdAt"].is_string());
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
