//! Libraries, and who may see them.
//!
//! Access is a row in `library_memberships` and nothing else. There is no
//! "instance admin sees everything" shortcut here on purpose: an admin can
//! administer the instance, which is not the same as reading everybody's
//! shelves.
//!
//! The person who creates a library is its *primary owner*: recorded on
//! `libraries.owner_id`, which is the one thing that cannot be revoked, and
//! given an ordinary membership with `library_owner` like anyone else they later
//! share it with. Permission checks read the membership, so a primary owner and
//! an owner are the same thing to every caller but this one.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use sea_orm::sea_query::{Expr, Func};
use sea_orm::{
    ActiveEnum, ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, FromQueryResult,
    JoinType, NotSet, QueryFilter, QueryOrder, QuerySelect, RelationTrait, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::entities::sea_orm_active_enums::LibraryRole;
use crate::entities::{libraries, library_memberships};
use crate::error::ApiError;
use crate::state::AppState;

/// Long enough for "Books I lent Dad and would like back", short enough that the
/// column is not a place to paste an essay - that is what the description is for.
const MAX_NAME_LENGTH: usize = 120;

const MAX_DESCRIPTION_LENGTH: usize = 2_000;

/// A role as the wire spells it, which is how the database spells it.
///
/// `LibraryRole` is generated with a plain `Serialize`, which would write the Rust
/// variant name - `LibraryOwner` - rather than the `library_owner` that m0004's
/// `library_role` type holds and that the client matches on. `to_value()` carries
/// the `string_value` behind each variant, so it is the one spelling of the three
/// there ever needs to be.
fn wire_name(role: &LibraryRole) -> String {
    role.to_value().value.into_owned()
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/libraries", get(list).post(create))
        .route("/libraries/{id}", get(one).put(update).delete(remove))
}

/// A library as one of its members sees it.
///
/// `role` and `isPrimaryOwner` are properties of the *caller*, not of the row,
/// which is what lets the client draw the crown and decide what to offer without
/// a second request.
///
/// `role` is a `String` rather than a `LibraryRole` for the reason `wire_name`
/// gives: serializing the generated enum would put its Rust variant name on the
/// wire instead of the value the database and the client both say.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub is_primary_owner: bool,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One row of the libraries-joined-to-membership query.
///
/// A hand-rolled projection rather than `find_also_related`, because the only
/// thing wanted from the membership is the caller's role.
#[derive(Debug, FromQueryResult)]
struct LibraryRow {
    id: Uuid,
    name: String,
    description: Option<String>,
    owner_id: Uuid,
    role: LibraryRole,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl LibraryRow {
    fn into_response(self, caller: Uuid) -> LibraryResponse {
        LibraryResponse {
            is_primary_owner: self.owner_id == caller,
            id: self.id,
            name: self.name,
            description: self.description,
            owner_id: self.owner_id,
            role: wire_name(&self.role),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Every library `caller` is a member of, by name.
///
/// Generic over the connection so it works inside the create transaction, where
/// the new rows are not visible to anyone else yet.
async fn visible_to<C: ConnectionTrait>(
    db: &C,
    caller: Uuid,
    only: Option<Uuid>,
) -> Result<Vec<LibraryRow>, ApiError> {
    let mut query = libraries::Entity::find()
        .join(
            JoinType::InnerJoin,
            libraries::Relation::LibraryMemberships.def(),
        )
        .filter(library_memberships::Column::UserId.eq(caller));

    if let Some(id) = only {
        query = query.filter(libraries::Column::Id.eq(id));
    }

    Ok(query
        .select_only()
        .columns([
            libraries::Column::Id,
            libraries::Column::Name,
            libraries::Column::Description,
            libraries::Column::OwnerId,
            libraries::Column::CreatedAt,
            libraries::Column::UpdatedAt,
        ])
        .column_as(library_memberships::Column::Role, "role")
        // Table-qualified so the ordering says which `name` it means, whatever
        // else the join grows a column of that name. Case-insensitive, so "attic"
        // and "Attic" sort where a reader expects rather than by codepoint.
        .order_by_asc(Expr::expr(Func::lower(Expr::col((
            libraries::Entity,
            libraries::Column::Name,
        )))))
        .into_model::<LibraryRow>()
        .all(db)
        .await?)
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
) -> Result<Json<Vec<LibraryResponse>>, ApiError> {
    let rows = visible_to(&state.db, claims.sub, None).await?;

    Ok(Json(
        rows.into_iter()
            .map(|row| row.into_response(claims.sub))
            .collect(),
    ))
}

/// One library as `caller` sees it, or the 404 a stranger gets.
///
/// A non-member gets a 404 rather than a 403: whether a given library exists is
/// not something a stranger should be able to probe for. Factored out because
/// every path that acts on a single library starts here, and that 404 is the
/// load-bearing part of all of them.
async fn visible_one<C: ConnectionTrait>(
    db: &C,
    caller: Uuid,
    id: Uuid,
) -> Result<LibraryRow, ApiError> {
    visible_to(db, caller, Some(id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| ApiError::NotFound("No such library".to_string()))
}

/// The gate on changing a library at all.
///
/// The role comes from the *membership*, never from `libraries.owner_id`. The
/// primary owner holds an ordinary owner membership like anybody else, so this
/// covers them without knowing they exist - and the moment one check
/// special-cases `owner_id`, every future one has to as well.
///
/// A 403 rather than the 404 a non-member gets, and the difference is not an
/// inconsistency: this is only ever reached through `visible_one`, so the
/// caller has already been shown the library exists. Naming the rule tells them
/// nothing they could not see, and it is the only answer they can act on.
fn require_owner(role: &LibraryRole) -> Result<(), ApiError> {
    if *role == LibraryRole::LibraryOwner {
        return Ok(());
    }

    Err(ApiError::Forbidden(
        "Only an owner can change or delete a library".to_string(),
    ))
}

/// One library, if the caller is in it.
async fn one(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryResponse>, ApiError> {
    let row = visible_one(&state.db, claims.sub, id).await?;

    Ok(Json(row.into_response(claims.sub)))
}

/// The editable half of a library, as the caller sends it.
///
/// Shared by `POST` and `PUT` because they take the same thing: a library has
/// exactly two fields anyone can set, and both requests always carry both. That
/// is also why the update is a `PUT` rather than a `PATCH` - there is nothing
/// here to patch around, and an absent `description` means "no description"
/// rather than "leave it alone".
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryRequest {
    name: String,
    #[serde(default)]
    description: Option<String>,
}

/// What a request's name and description are once they have been made sense of.
#[derive(Debug)]
struct LibraryFields {
    name: String,
    description: Option<String>,
}

/// Trim, then reject what the column cannot hold.
///
/// A description that is only whitespace is `None`, not `Some("")`: "no
/// description" should have one representation in the database, not two.
fn clean(name: &str, description: Option<&str>) -> Result<LibraryFields, ApiError> {
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

    Ok(LibraryFields {
        name: name.to_string(),
        description: description.map(str::to_string),
    })
}

/// Create a library and put its creator in it.
///
/// Both writes or neither: a library nobody is a member of is invisible to
/// everyone including the person who just made it, which is worse than the
/// request failing.
async fn create(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Json(body): Json<LibraryRequest>,
) -> Result<(StatusCode, Json<LibraryResponse>), ApiError> {
    let fields = clean(&body.name, body.description.as_deref())?;

    let txn = state.db.begin().await?;

    let library = libraries::ActiveModel {
        id: Set(Uuid::now_v7()),
        name: Set(fields.name),
        description: Set(fields.description),
        owner_id: Set(claims.sub),
        created_at: NotSet,
        updated_at: NotSet,
    }
    .insert(&txn)
    .await?;

    library_memberships::ActiveModel {
        id: Set(Uuid::now_v7()),
        library_id: Set(library.id),
        user_id: Set(claims.sub),
        role: Set(LibraryRole::LibraryOwner),
        // Nobody invited them - that is what makes this the primary owner.
        invited_by: Set(None),
        joined_at: NotSet,
    }
    .insert(&txn)
    .await?;

    txn.commit().await?;

    Ok((
        StatusCode::CREATED,
        Json(LibraryResponse {
            id: library.id,
            name: library.name,
            description: library.description,
            owner_id: library.owner_id,
            is_primary_owner: true,
            role: wire_name(&LibraryRole::LibraryOwner),
            created_at: library.created_at.into(),
            updated_at: library.updated_at.into(),
        }),
    ))
}

/// Rename a library, or change what it says about itself.
///
/// A `PUT` because it is one: the two fields here are everything anyone may
/// edit, the form that sends it always has both on screen, and `clean` - where
/// the rules live - takes both or neither. A request that leaves `description`
/// out therefore *clears* it rather than preserving it.
///
/// Permission before validation on purpose. A viewer who submits a blank name
/// should be told they may not be here at all, not corrected on the spelling of
/// a change that was never going to happen.
///
/// Last write wins. There is no version column and no `If-Match`, so two people
/// renaming at once means the slower one's name is the one that sticks - which
/// is worth knowing about rather than worth solving while a library has exactly
/// one member.
async fn update(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(id): Path<Uuid>,
    Json(body): Json<LibraryRequest>,
) -> Result<Json<LibraryResponse>, ApiError> {
    let row = visible_one(&state.db, claims.sub, id).await?;
    require_owner(&row.role)?;

    let fields = clean(&body.name, body.description.as_deref())?;

    let library = libraries::ActiveModel {
        id: Set(id),
        name: Set(fields.name),
        description: Set(fields.description),
        // m0003 gives the column a default and there is no trigger behind it, so
        // a row never told it changed goes on claiming it was last touched when
        // it was created.
        updated_at: Set(Utc::now().into()),
        ..Default::default()
    }
    .update(&state.db)
    .await?;

    // Rebuilt as a row rather than as a response directly, so `isPrimaryOwner`
    // stays derived in exactly one place. The role is the one just read: nothing
    // in this request could have changed it, and asking again would be a second
    // trip for an answer already in hand.
    Ok(Json(
        LibraryRow {
            id: library.id,
            name: library.name,
            description: library.description,
            owner_id: library.owner_id,
            role: row.role,
            created_at: library.created_at.into(),
            updated_at: library.updated_at.into(),
        }
        .into_response(claims.sub),
    ))
}

/// Delete a library and everything hanging off it.
///
/// No transaction: `library_memberships.library_id` is `ON DELETE CASCADE`
/// (m0004), so the memberships go in the same statement. Books and shelves
/// should carry the same cascade when they arrive, rather than this growing a
/// hand-rolled teardown.
///
/// 204 rather than the row that was deleted: there is nothing left to describe,
/// and the caller already had it.
///
/// Named `remove` rather than `delete` so it cannot collide with
/// `axum::routing::delete` if that is ever imported here.
async fn remove(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let row = visible_one(&state.db, claims.sub, id).await?;
    require_owner(&row.role)?;

    libraries::Entity::delete_by_id(id).exec(&state.db).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    use claims::{assert_err, assert_none, assert_ok, assert_some_eq};

    #[test]
    fn a_name_is_trimmed_and_a_blank_description_is_dropped() {
        let fields = assert_ok!(clean("  Shelf by the window  ", Some("   ")));

        assert_eq!(fields.name, "Shelf by the window");
        assert_none!(fields.description);
    }

    #[test]
    fn a_description_survives_when_it_says_something() {
        let fields = assert_ok!(clean("Loft", Some("  Boxes I have not opened  ")));

        assert_some_eq!(fields.description, "Boxes I have not opened");
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
        assert_err!(clean("Loft", Some(&long)));
    }

    #[test]
    fn an_owner_may_change_a_library() {
        assert_ok!(require_owner(&LibraryRole::LibraryOwner));
    }

    #[test]
    fn an_editor_or_a_viewer_may_not() {
        // Refused rather than hidden: they can already see the library, so
        // pretending it is not there would tell them nothing and help nobody.
        assert!(matches!(
            require_owner(&LibraryRole::LibraryEditor),
            Err(ApiError::Forbidden(_))
        ));
        assert!(matches!(
            require_owner(&LibraryRole::LibraryViewer),
            Err(ApiError::Forbidden(_))
        ));
    }

    #[test]
    fn the_roles_are_spelled_the_same_everywhere() {
        // These strings are the values of the `library_role` type in m0004 and
        // the union `app/src/lib/libraries.ts` matches on, so the variant names
        // are not the only thing that has to agree. Renaming one of them is a
        // migration and a change to the client, not a rename.
        assert_eq!(wire_name(&LibraryRole::LibraryOwner), "library_owner");
        assert_eq!(wire_name(&LibraryRole::LibraryEditor), "library_editor");
        assert_eq!(wire_name(&LibraryRole::LibraryViewer), "library_viewer");
    }
}
