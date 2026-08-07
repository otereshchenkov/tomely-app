//! Libraries, and who may see them.
//!
//! Access is a row in `library_memberships` and nothing else. There is no
//! "instance admin sees everything" shortcut here on purpose: an admin can
//! administer the instance, which is not the same as reading everybody's
//! shelves.
//!
//! The person who creates a library is its *primary owner*: recorded on
//! `libraries.owner_id`, which is the one thing that cannot be revoked, and
//! given an ordinary membership with the `owner` role like anyone else they
//! later share it with. Permission checks read the membership, so a primary
//! owner and an owner are the same thing to every caller but this one.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use sea_orm::sea_query::{Expr, Func};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, FromQueryResult, JoinType, NotSet,
    QueryFilter, QueryOrder, QuerySelect, RelationTrait, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::CurrentUser;
use crate::entities::{libraries, library_memberships, roles};
use crate::error::ApiError;
use crate::state::AppState;

/// The system role a library's creator is given.
///
/// Looked up by name rather than by the id m0003 seeds, so the roles table stays
/// the source of truth and nothing here has to be migrated when it changes.
pub const OWNER_ROLE: &str = "owner";

/// Long enough for "Books I lent Dad and would like back", short enough that the
/// column is not a place to paste an essay - that is what the description is for.
const MAX_NAME_LENGTH: usize = 120;

const MAX_DESCRIPTION_LENGTH: usize = 2_000;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/libraries", get(list).post(create))
        .route("/libraries/{id}", get(one))
}

/// A library as one of its members sees it.
///
/// `role` and `isPrimaryOwner` are properties of the *caller*, not of the row,
/// which is what lets the client draw the crown and decide what to offer without
/// a second request.
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
/// thing wanted from the other two tables is the role's name.
#[derive(Debug, FromQueryResult)]
struct LibraryRow {
    id: Uuid,
    name: String,
    description: Option<String>,
    owner_id: Uuid,
    role: String,
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
            role: self.role,
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
        .join(
            JoinType::InnerJoin,
            library_memberships::Relation::Roles.def(),
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
        .column_as(roles::Column::Name, "role")
        // Table-qualified: `roles` has a `name` too, and an unqualified one here
        // is an ambiguous column reference that Postgres refuses outright.
        // Ordered case-insensitively so "attic" and "Attic" sort where a reader
        // expects, rather than by codepoint.
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

/// One library, if the caller is in it.
///
/// A non-member gets a 404 rather than a 403: whether a given library exists is
/// not something a stranger should be able to probe for.
async fn one(
    State(state): State<AppState>,
    CurrentUser(claims): CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<LibraryResponse>, ApiError> {
    let row = visible_to(&state.db, claims.sub, Some(id))
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| ApiError::NotFound("No such library".to_string()))?;

    Ok(Json(row.into_response(claims.sub)))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateLibraryRequest {
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
    Json(body): Json<CreateLibraryRequest>,
) -> Result<(StatusCode, Json<LibraryResponse>), ApiError> {
    let fields = clean(&body.name, body.description.as_deref())?;

    let txn = state.db.begin().await?;

    // Seeded by m0003. Missing means the migrations did not all run, which is an
    // instance problem rather than something the caller did wrong.
    let owner_role = roles::Entity::find()
        .filter(roles::Column::Name.eq(OWNER_ROLE))
        .one(&txn)
        .await?
        .ok_or_else(|| {
            ApiError::Internal(format!(
                "The '{OWNER_ROLE}' role is missing from the database"
            ))
        })?;

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
        role_id: Set(owner_role.id),
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
            role: owner_role.name,
            created_at: library.created_at.into(),
            updated_at: library.updated_at.into(),
        }),
    ))
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
}
