//! The instance's vocabulary: media types and genres.
//!
//! Two tables, one module, because they are the same kind of thing - a list of
//! words the whole instance describes its books with - and the validation, the
//! ordering and the delete guard below are shared by both. Splitting them would
//! buy two files that differ by one column.
//!
//! Instance-wide rather than per-library, and deliberately so: a genre that
//! meant something different in each library would make "everything I own of
//! this kind" a question with no answer. That is also what decides who may
//! write here - reading is for anybody signed in, since the book form is the
//! main consumer, and writing is for an instance admin, because a rename here
//! is a rename in everybody's library at once.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use sea_orm::sea_query::{Expr, Func, SimpleExpr};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, IntoActiveModel, NotSet, QueryOrder, Set,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{CurrentUser, InstanceAdmin};
use crate::entities::{genres, media_types};
use crate::error::ApiError;
use crate::state::AppState;

/// Long enough for "Short Story Collection", short enough that the column is not
/// somewhere to paste a paragraph - that is what a media type's description is
/// for.
const MAX_NAME_LENGTH: usize = 120;

const MAX_DESCRIPTION_LENGTH: usize = 2_000;

/// No `GET /{id}` on either resource: both lists are small and the client always
/// holds the whole of one, so a single-row read would have no caller to serve.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/media-types",
            get(list_media_types).post(create_media_type),
        )
        .route(
            "/media-types/{id}",
            put(update_media_type).delete(remove_media_type),
        )
        .route("/genres", get(list_genres).post(create_genre))
        .route("/genres/{id}", put(update_genre).delete(remove_genre))
}

/// How many books use an entry.
///
/// Zero, always, because there is no `books` table to count yet. It is on the
/// wire regardless: the page draws a badge from it and disables delete when it
/// is not zero, so shipping the field now means the list and the guard are
/// finished and start telling the truth the moment books arrive - with nothing
/// above this line to change. Same seam as `app/src/lib/dashboard.ts`, which
/// hands back an empty summary so every card can render its empty state.
const fn book_count() -> i64 {
    0
}

/// Refuse to delete a word books are still filed under.
///
/// Unreachable while `book_count` is zero, and written anyway: it is the rule
/// the page already states out loud, and when the count becomes real this is
/// the one place that has to notice.
fn require_unused(name: &str, books: i64) -> Result<(), ApiError> {
    if books == 0 {
        return Ok(());
    }

    Err(ApiError::Conflict(format!(
        "{name} is still assigned to {books} book{}",
        if books == 1 { "" } else { "s" }
    )))
}

/// Case-insensitive by name, so "manga" and "Manga" sort where a reader expects
/// rather than by codepoint - and so the order the API returns is the order the
/// unique index enforces uniqueness in.
fn by_name<C: ColumnTrait>(name: C) -> SimpleExpr {
    Expr::expr(Func::lower(Expr::col(name)))
}

/// What a request's name and description are once they have been made sense of.
#[derive(Debug)]
struct Fields {
    name: String,
    description: Option<String>,
}

/// Trim, then reject what the column cannot hold.
///
/// A description that is only whitespace is `None`, not `Some("")`: "no
/// description" should have one representation in the database, not two. Genres
/// have no description column and always pass `None` here, which costs them
/// nothing and keeps one set of rules for both.
fn clean(name: &str, description: Option<&str>) -> Result<Fields, ApiError> {
    let name = name.trim();

    if name.is_empty() {
        return Err(ApiError::BadRequest("Name is required".to_string()));
    }
    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Name must be at most {MAX_NAME_LENGTH} characters"
        )));
    }

    let description = description.map(str::trim).filter(|d| !d.is_empty());

    if description.is_some_and(|d| d.chars().count() > MAX_DESCRIPTION_LENGTH) {
        return Err(ApiError::BadRequest(format!(
            "Description must be at most {MAX_DESCRIPTION_LENGTH} characters"
        )));
    }

    Ok(Fields {
        name: name.to_string(),
        description: description.map(str::to_string),
    })
}

/// The editable half of a catalogue entry, as the caller sends it.
///
/// Shared by `POST` and `PUT` because they take the same thing, which is also
/// why the update is a `PUT` rather than a `PATCH`: there is nothing here to
/// patch around, and an absent `description` means "no description" rather than
/// "leave it alone". Genres ignore the field entirely.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogueRequest {
    name: String,
    #[serde(default)]
    description: Option<String>,
}

// -- Media types -------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTypeResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub book_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<media_types::Model> for MediaTypeResponse {
    fn from(row: media_types::Model) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            book_count: book_count(),
            created_at: row.created_at.into(),
            updated_at: row.updated_at.into(),
        }
    }
}

/// Every media type, by name. Any signed-in caller: the book form needs these
/// to draw its media type field at all.
async fn list_media_types(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> Result<Json<Vec<MediaTypeResponse>>, ApiError> {
    let rows = media_types::Entity::find()
        .order_by_asc(by_name(media_types::Column::Name))
        .all(&state.db)
        .await?;

    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

/// Add a media type. A name that already exists - in any casing - comes back as
/// a 409 from `From<DbErr>` and the unique index behind it, with nothing here
/// having to look for it.
async fn create_media_type(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Json(body): Json<CatalogueRequest>,
) -> Result<(StatusCode, Json<MediaTypeResponse>), ApiError> {
    let fields = clean(&body.name, body.description.as_deref())?;

    let row = media_types::ActiveModel {
        id: Set(Uuid::now_v7()),
        name: Set(fields.name),
        description: Set(fields.description),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(row.into())))
}

async fn update_media_type(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Path(id): Path<Uuid>,
    Json(body): Json<CatalogueRequest>,
) -> Result<Json<MediaTypeResponse>, ApiError> {
    let existing = one(media_types::Entity::find_by_id(id).one(&state.db).await?)?;
    let fields = clean(&body.name, body.description.as_deref())?;

    let mut row = existing.into_active_model();
    row.name = Set(fields.name);
    row.description = Set(fields.description);
    // m0005 gives the column a default and there is no trigger behind it, so a
    // row never told it changed goes on claiming it was last touched when it was
    // created.
    row.updated_at = Set(Utc::now().into());

    Ok(Json(row.update(&state.db).await?.into()))
}

async fn remove_media_type(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let row = one(media_types::Entity::find_by_id(id).one(&state.db).await?)?;
    require_unused(&row.name, book_count())?;

    media_types::Entity::delete_by_id(id)
        .exec(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// -- Genres ------------------------------------------------------------------

/// A genre has no description: its name is the whole of it. `bookCount` is here
/// for the same reason it is on a media type - the page draws the same row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenreResponse {
    pub id: Uuid,
    pub name: String,
    pub book_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<genres::Model> for GenreResponse {
    fn from(row: genres::Model) -> Self {
        Self {
            id: row.id,
            name: row.name,
            book_count: book_count(),
            created_at: row.created_at.into(),
            updated_at: row.updated_at.into(),
        }
    }
}

async fn list_genres(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> Result<Json<Vec<GenreResponse>>, ApiError> {
    let rows = genres::Entity::find()
        .order_by_asc(by_name(genres::Column::Name))
        .all(&state.db)
        .await?;

    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

async fn create_genre(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Json(body): Json<CatalogueRequest>,
) -> Result<(StatusCode, Json<GenreResponse>), ApiError> {
    // `None` rather than the body's description: a genre has nowhere to put one,
    // and quietly dropping it is better than pretending it was stored.
    let fields = clean(&body.name, None)?;

    let row = genres::ActiveModel {
        id: Set(Uuid::now_v7()),
        name: Set(fields.name),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(row.into())))
}

async fn update_genre(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Path(id): Path<Uuid>,
    Json(body): Json<CatalogueRequest>,
) -> Result<Json<GenreResponse>, ApiError> {
    let existing = one(genres::Entity::find_by_id(id).one(&state.db).await?)?;
    let fields = clean(&body.name, None)?;

    let mut row = existing.into_active_model();
    row.name = Set(fields.name);
    row.updated_at = Set(Utc::now().into());

    Ok(Json(row.update(&state.db).await?.into()))
}

async fn remove_genre(
    State(state): State<AppState>,
    InstanceAdmin(_): InstanceAdmin,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let row = one(genres::Entity::find_by_id(id).one(&state.db).await?)?;
    require_unused(&row.name, book_count())?;

    genres::Entity::delete_by_id(id).exec(&state.db).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The 404 for an id that is not there.
///
/// Every write below reads the row first - to have a name for the delete guard's
/// message, and so that editing something already deleted says so rather than
/// failing somewhere further down.
fn one<T>(found: Option<T>) -> Result<T, ApiError> {
    found.ok_or_else(|| ApiError::NotFound("No such entry".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    use claims::{assert_err, assert_none, assert_ok, assert_some_eq};

    #[test]
    fn a_name_is_trimmed_and_a_blank_description_is_dropped() {
        let fields = assert_ok!(clean("  Light Novel  ", Some("   ")));

        assert_eq!(fields.name, "Light Novel");
        assert_none!(fields.description);
    }

    #[test]
    fn a_description_survives_when_it_says_something() {
        let fields = assert_ok!(clean("Manhwa", Some("  Korean comic / webtoon  ")));

        assert_some_eq!(fields.description, "Korean comic / webtoon");
    }

    #[test]
    fn a_name_that_is_only_whitespace_is_no_name() {
        assert_err!(clean("   ", None));
        assert_err!(clean("", None));
    }

    #[test]
    fn the_column_limits_are_enforced_in_characters_not_bytes() {
        // 120 multi-byte characters fit; 121 do not.
        assert_ok!(clean(&"é".repeat(MAX_NAME_LENGTH), None));
        assert_err!(clean(&"é".repeat(MAX_NAME_LENGTH + 1), None));

        let long = "é".repeat(MAX_DESCRIPTION_LENGTH + 1);
        assert_err!(clean("Manga", Some(&long)));
    }

    #[test]
    fn an_entry_nothing_points_at_may_go() {
        assert_ok!(require_unused("Novel", 0));
    }

    #[test]
    fn an_entry_books_are_filed_under_may_not() {
        // A 409 rather than a 403: the caller is allowed to delete media types,
        // this one just is not in a state to be deleted, and the message says
        // what would have to change first.
        let err = assert_err!(require_unused("Novel", 3));
        assert!(matches!(err, ApiError::Conflict(m) if m == "Novel is still assigned to 3 books"));

        let one = assert_err!(require_unused("Novel", 1));
        assert!(matches!(one, ApiError::Conflict(m) if m == "Novel is still assigned to 1 book"));
    }

    #[test]
    fn nothing_is_using_anything_yet() {
        // The seam, asserted: when `books` lands and this stops being zero, this
        // test is the thing that fails and points at everywhere that assumed it.
        assert_eq!(book_count(), 0);
    }
}
