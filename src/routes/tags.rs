//! A library's own tags.
//!
//! The words a reader invents for their own shelves, as opposed to the words the
//! instance agrees on - which are `media_types` and `genres` next door in
//! `catalogue.rs`. That module argues a genre has to be instance-wide or
//! "everything I own of this kind" is a question with no answer; a tag is the
//! mirror image, and lives in one library because two people's "to read" mean
//! two different things.
//!
//! Which is also what decides who may write here. A catalogue is gated on
//! `InstanceAdmin` because a rename there is a rename in everybody's library at
//! once; a tag rename is a rename in one, so the gate is membership of that one:
//! **reading takes any member**, and **writing takes an owner or an editor** -
//! `member_role` and `require_editor`, both from `libraries.rs`, which is where
//! every question about who may do what in a library is answered.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use sea_orm::sea_query::{Expr, Func};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, IntoActiveModel, NotSet, QueryFilter, QueryOrder,
    Set,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::entities::tags;
use crate::error::ApiError;
use crate::routes::libraries::{member_role, require_editor};
use crate::state::AppState;

/// Shorter than the catalogue's 120 on purpose: a tag is drawn as a chip beside
/// a book, and one that wraps to a second line is a tag nobody will pick twice.
const MAX_NAME_LENGTH: usize = 60;

/// The colours a tag may be, which are Mantine's own named colours.
///
/// A name rather than a hex value, because the client renders it as
/// `var(--mantine-color-{name}-6)` and gets the light and the dark theme's
/// version of it for free. A stored `#4c6ef5` would be one of those two and
/// wrong in the other.
///
/// Validated here rather than constrained in the schema, for the reason m0007
/// gives: this is a UI palette, and the day the client wants a fifteenth colour
/// should not be a day with a migration in it. `TAG_COLORS` in
/// `app/src/lib/tags.ts` is the same list, in the order the swatches are drawn.
const COLORS: [&str; 14] = [
    "red", "orange", "yellow", "lime", "green", "teal", "cyan", "blue", "indigo", "violet",
    "grape", "pink", "gray", "dark",
];

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/libraries/{library_id}/tags", get(list).post(create))
        .route(
            "/libraries/{library_id}/tags/{id}",
            put(update).delete(remove),
        )
}

/// A tag as the wire spells it.
///
/// No count of what is filed under it, unlike a catalogue entry's `bookCount`.
/// That field exists because the catalogue page draws a badge from it and
/// refuses to delete above zero; this page does neither - deleting a tag is
/// *defined* as taking it off everything it is on - so a permanently-zero number
/// here would be a field with nobody to read it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagResponse {
    pub id: Uuid,
    pub library_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<tags::Model> for TagResponse {
    fn from(row: tags::Model) -> Self {
        Self {
            id: row.id,
            library_id: row.library_id,
            name: row.name,
            color: row.color,
            created_at: row.created_at.into(),
            updated_at: row.updated_at.into(),
        }
    }
}

/// The editable half of a tag, as the caller sends it.
///
/// Shared by `POST` and `PUT`, and a `PUT` rather than a `PATCH` for the reason
/// `catalogue.rs` gives: there is nothing here to patch around, and an absent
/// `color` means "no colour" rather than "leave it alone".
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TagRequest {
    name: String,
    #[serde(default)]
    color: Option<String>,
}

/// What a request is once it has been made sense of.
#[derive(Debug)]
struct Fields {
    name: String,
    color: Option<String>,
}

/// Trim, then reject what the column cannot hold and what the palette does not
/// have.
///
/// A colour that is only whitespace is `None`, not `Some("")`: "no colour" is a
/// real state - the tag draws a hollow dot - and it should have one
/// representation in the database rather than two.
fn clean(name: &str, color: Option<&str>) -> Result<Fields, ApiError> {
    let name = name.trim();

    if name.is_empty() {
        return Err(ApiError::BadRequest("Name is required".to_string()));
    }
    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(ApiError::BadRequest(format!(
            "Name must be at most {MAX_NAME_LENGTH} characters"
        )));
    }

    let color = color.map(str::trim).filter(|c| !c.is_empty());

    if color.is_some_and(|c| !COLORS.contains(&c)) {
        return Err(ApiError::BadRequest("That is not a tag colour".to_string()));
    }

    Ok(Fields {
        name: name.to_string(),
        color: color.map(str::to_string),
    })
}

/// One tag of this library, or a 404.
///
/// Filtered on `library_id` as well as the id, which is the load-bearing half:
/// without it a member of one library could reach a tag in another by quoting
/// its id, and `member_role` above would have cheerfully approved them for the
/// library in the path. A tag id is only ever meaningful inside its own library.
async fn one(state: &AppState, library_id: Uuid, id: Uuid) -> Result<tags::Model, ApiError> {
    tags::Entity::find_by_id(id)
        .filter(tags::Column::LibraryId.eq(library_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| ApiError::NotFound("No such tag".to_string()))
}

/// Every tag in the library, by name.
///
/// Any member: the book form is the main consumer, and a viewer browsing what is
/// on a shelf needs to read the words it is filed under.
///
/// Case-insensitive ordering, matching the `lower(name)` half of m0007's unique
/// index - so the order the API returns is the order uniqueness is enforced in.
async fn list(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(library_id): Path<Uuid>,
) -> Result<Json<Vec<TagResponse>>, ApiError> {
    member_role(&state.db, claims.sub, library_id).await?;

    let rows = tags::Entity::find()
        .filter(tags::Column::LibraryId.eq(library_id))
        .order_by_asc(Expr::expr(Func::lower(Expr::col(tags::Column::Name))))
        .all(&state.db)
        .await?;

    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

/// Add a tag. A name this library already has - in any casing - comes back as a
/// 409 from `From<DbErr>` and m0007's unique index behind it, with nothing here
/// having to look for it.
async fn create(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(library_id): Path<Uuid>,
    Json(body): Json<TagRequest>,
) -> Result<(StatusCode, Json<TagResponse>), ApiError> {
    // Permission before validation, as `libraries.rs::update` does: a viewer who
    // submits a blank name should be told they may not be here at all, not
    // corrected on the spelling of a change that was never going to happen.
    require_editor(&member_role(&state.db, claims.sub, library_id).await?)?;

    let fields = clean(&body.name, body.color.as_deref())?;

    let row = tags::ActiveModel {
        id: Set(Uuid::now_v7()),
        library_id: Set(library_id),
        name: Set(fields.name),
        color: Set(fields.color),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(row.into())))
}

/// Rename a tag, or recolour it. Both at once is the same request.
async fn update(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path((library_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<TagRequest>,
) -> Result<Json<TagResponse>, ApiError> {
    require_editor(&member_role(&state.db, claims.sub, library_id).await?)?;

    let existing = one(&state, library_id, id).await?;
    let fields = clean(&body.name, body.color.as_deref())?;

    let mut row = existing.into_active_model();
    row.name = Set(fields.name);
    row.color = Set(fields.color);
    // m0007 gives the column a default and there is no trigger behind it, so a
    // row never told it changed goes on claiming it was last touched when it was
    // created.
    row.updated_at = Set(Utc::now().into());

    Ok(Json(row.update(&state.db).await?.into()))
}

/// Delete a tag.
///
/// No usage guard, unlike `catalogue.rs::require_unused`, and the difference is
/// what the page promises: a catalogue entry books are filed under may not be
/// deleted, whereas deleting a tag *means* taking it off every book, shelf, loan
/// and member that carried it. The rows that will need cascading do not exist
/// yet; when they do, the foreign key carries it the way m0004's does, not a
/// hand-rolled teardown here.
async fn remove(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path((library_id, id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    require_editor(&member_role(&state.db, claims.sub, library_id).await?)?;

    // Read it first so deleting something already gone says so, rather than
    // answering 204 for a row that was never there.
    one(&state, library_id, id).await?;

    tags::Entity::delete_by_id(id).exec(&state.db).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    use claims::{assert_err, assert_none, assert_ok, assert_some_eq};

    #[test]
    fn a_name_is_trimmed() {
        let fields = assert_ok!(clean("  heroic  ", None));

        assert_eq!(fields.name, "heroic");
        assert_none!(fields.color);
    }

    #[test]
    fn a_colour_survives_when_it_is_one() {
        let fields = assert_ok!(clean("war", Some("  red  ")));

        assert_some_eq!(fields.color, "red");
    }

    #[test]
    fn a_blank_colour_is_no_colour() {
        // Not `Some("")`: a tag with no colour draws a hollow dot, and that
        // state should have one spelling in the database rather than two.
        assert_none!(assert_ok!(clean("heroic", Some("   "))).color);
    }

    #[test]
    fn a_colour_off_the_palette_is_refused() {
        assert!(matches!(
            clean("heroic", Some("#4c6ef5")),
            Err(ApiError::BadRequest(_))
        ));
        assert!(matches!(
            clean("heroic", Some("chartreuse")),
            Err(ApiError::BadRequest(_))
        ));
        // Named colours are matched exactly - the client sends what this list
        // holds, and "Red" is a typo rather than a spelling of red.
        assert_err!(clean("heroic", Some("Red")));
    }

    #[test]
    fn a_name_that_is_only_whitespace_is_no_name() {
        assert_err!(clean("   ", None));
        assert_err!(clean("", None));
    }

    #[test]
    fn the_column_limit_is_enforced_in_characters_not_bytes() {
        assert_ok!(clean(&"é".repeat(MAX_NAME_LENGTH), None));
        assert_err!(clean(&"é".repeat(MAX_NAME_LENGTH + 1), None));
    }
}
