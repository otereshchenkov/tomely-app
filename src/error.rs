use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use sea_orm::{DbErr, SqlErr};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    Conflict(String),

    #[error("{0}")]
    Internal(String),
}

impl ApiError {
    const fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    const fn kind(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "BadRequest",
            Self::Unauthorized(_) => "Unauthorized",
            Self::NotFound(_) => "NotFound",
            Self::Conflict(_) => "Conflict",
            Self::Internal(_) => "InternalServer",
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // A 500 is our bug, so it goes to the log in full and to the client as a
        // fixed string; the 4xx messages are written for the caller and are safe
        // to return verbatim.
        if let Self::Internal(detail) = &self {
            tracing::error!(error = %detail, "request failed");
            return (
                self.status(),
                Json(json!({ "error": self.kind(), "message": "Internal server error" })),
            )
                .into_response();
        }

        (
            self.status(),
            Json(json!({ "error": self.kind(), "message": self.to_string() })),
        )
            .into_response()
    }
}

/// Turn database failures into the response the caller deserves.
///
/// Constraint violations are the caller's fault, not the server's - a duplicate
/// key or a dangling foreign key is a 4xx. Without this they would all surface
/// as opaque 500s.
impl From<DbErr> for ApiError {
    fn from(err: DbErr) -> Self {
        if let DbErr::RecordNotFound(msg) = &err {
            return Self::NotFound(msg.clone());
        }

        match err.sql_err() {
            Some(SqlErr::UniqueConstraintViolation(detail)) => {
                Self::Conflict(format!("Already exists: {detail}"))
            }
            Some(SqlErr::ForeignKeyConstraintViolation(detail)) => {
                Self::BadRequest(format!("Referenced record does not exist: {detail}"))
            }
            _ => Self::Internal(err.to_string()),
        }
    }
}
