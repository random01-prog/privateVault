"""
Database models for Navya Tales.

Three tables:
  - folders      : the folders the user organizes memories into
  - items        : every memory (text note, photo, video, voice recording)
  - google_tokens: the single shared Google Drive OAuth token (replaces
                   token.json — a file on disk doesn't survive redeploys
                   on most hosts, a DB row does)

Media bytes are NOT stored here — only `drive_file_id`, which points at the
actual file living in the user's Google Drive. This table only holds the
metadata your frontend (app.js) already expects.
"""

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Folder(db.Model):
    __tablename__ = "folders"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class Item(db.Model):
    __tablename__ = "items"

    id = db.Column(db.Integer, primary_key=True)

    # Nullable + no ORM cascade: when a folder is deleted, app.py explicitly
    # moves its items to Trash and clears folder_id first, so this is just a
    # safety net at the DB level.
    folder_id = db.Column(
        db.Integer, db.ForeignKey("folders.id", ondelete="SET NULL"), nullable=True
    )

    type = db.Column(db.String(20), nullable=False)  # "text" | "photo" | "video" | "voice"

    title = db.Column(db.String(255))
    content = db.Column(db.Text)       # rich HTML — text memories only
    plain_text = db.Column(db.Text)    # plain-text version, used for search + previews

    file_name = db.Column(db.String(255))
    size_bytes = db.Column(db.BigInteger)
    drive_file_id = db.Column(db.String(255))  # Google Drive file ID — media memories only

    favorite = db.Column(db.Boolean, default=False, nullable=False)
    trashed = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    deleted_at = db.Column(db.DateTime, nullable=True)  # set when moved to Trash


class GoogleToken(db.Model):
    __tablename__ = "google_tokens"

    # Only ever one row (id=1) — this app connects a single Drive account
    # shared by both users, same as the old single token.json file.
    id = db.Column(db.Integer, primary_key=True)
    token_json = db.Column(db.Text, nullable=False)

    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )