import os
from datetime import datetime
from functools import wraps

from dotenv import load_dotenv
from flask import (
    Flask, abort, jsonify, redirect, render_template,
    request, send_file, session, url_for
)
from werkzeug.middleware.proxy_fix import ProxyFix

import drive_service as drive
from models import Folder, Item, db

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-this-secret-key")

# Codespaces (and most cloud dev environments) terminate HTTPS at a proxy and
# forward plain HTTP to this app. Without this, url_for(..., _external=True)
# would generate http:// URLs, which won't match what's registered with
# Google — causing exactly the redirect_uri_mismatch error you're seeing.
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/my_diary"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()  # safe to run every startup — only creates what's missing


# =============================================================
# AUTH  (1–2 users, configured via environment variables)
# =============================================================

def _valid_users():
    users = {os.getenv("APP_USERNAME", "lavanya"): os.getenv("APP_PASSWORD", "1234")}

    username2 = os.getenv("APP_USERNAME2")
    password2 = os.getenv("APP_PASSWORD2")
    if username2 and password2:
        users[username2] = password2

    return users


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user" not in session:
            if request.path.startswith("/api/") or request.path.startswith("/google/"):
                return jsonify({"error": "Not authenticated."}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


@app.route("/")
@login_required
def home():
    return render_template("dashboard.html", username=session.get("user"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        if _valid_users().get(username) == password:
            session["user"] = username
            return redirect(url_for("home"))

        return render_template("login.html", error="Incorrect username or password")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# =============================================================
# SERIALIZATION
# =============================================================

def _iso(dt):
    return dt.isoformat() if dt else None


def serialize_folder(folder):
    return {
        "id": folder.id,
        "name": folder.name,
        "createdAt": _iso(folder.created_at),
        "updatedAt": _iso(folder.updated_at),
    }


def serialize_item(item):
    return {
        "id": item.id,
        "folderId": item.folder_id,
        "type": item.type,
        "title": item.title,
        "content": item.content,
        "plainText": item.plain_text,
        "fileName": item.file_name,
        "size": item.size_bytes,
        "favorite": item.favorite,
        "trashed": item.trashed,
        "createdAt": _iso(item.created_at),
        "updatedAt": _iso(item.updated_at),
        "deletedAt": _iso(item.deleted_at),
    }


# =============================================================
# /api/data
# =============================================================

@app.route("/api/data")
@login_required
def api_data():
    folders = Folder.query.order_by(Folder.created_at.asc()).all()
    items = Item.query.order_by(Item.created_at.desc()).all()
    return jsonify({
        "folders": [serialize_folder(f) for f in folders],
        "items": [serialize_item(i) for i in items],
    })


# =============================================================
# FOLDERS
# =============================================================

@app.route("/api/folders", methods=["POST"])
@login_required
def create_folder():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Folder name is required."}), 400

    folder = Folder(name=name)
    db.session.add(folder)
    db.session.commit()
    return jsonify(serialize_folder(folder)), 201


@app.route("/api/folders/<int:folder_id>", methods=["PATCH"])
@login_required
def rename_folder(folder_id):
    folder = Folder.query.get_or_404(folder_id)
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Folder name cannot be empty."}), 400

    folder.name = name
    folder.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(serialize_folder(folder))


@app.route("/api/folders/<int:folder_id>", methods=["DELETE"])
@login_required
def delete_folder(folder_id):
    folder = Folder.query.get_or_404(folder_id)

    if Folder.query.count() <= 1:
        return jsonify({"error": "You need at least one folder."}), 400

    now = datetime.utcnow()
    # Move this folder's memories to Trash rather than deleting them.
    Item.query.filter_by(folder_id=folder.id).update({
        "trashed": True,
        "deleted_at": now,
        "folder_id": None,
    })

    db.session.delete(folder)
    db.session.commit()
    return jsonify({"success": True})


# =============================================================
# ITEMS — text memories
# =============================================================

@app.route("/api/items", methods=["POST"])
@login_required
def create_text_item():
    data = request.get_json(force=True, silent=True) or {}

    folder_id = data.get("folderId")
    title = (data.get("title") or "Untitled").strip()
    content = data.get("content") or ""
    plain_text = (data.get("plainText") or "").strip()

    if not folder_id or not db.session.get(Folder, folder_id):
        return jsonify({"error": "A valid folder is required."}), 400

    if not plain_text:
        return jsonify({"error": "Please write something before saving."}), 400

    item = Item(
        folder_id=folder_id, type="text",
        title=title, content=content, plain_text=plain_text,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(serialize_item(item)), 201


@app.route("/api/items/<int:item_id>", methods=["PATCH"])
@login_required
def update_item(item_id):
    item = Item.query.get_or_404(item_id)
    data = request.get_json(force=True, silent=True) or {}

    if "title" in data:
        item.title = data["title"]
    if "content" in data:
        item.content = data["content"]
    if "plainText" in data:
        item.plain_text = data["plainText"]
    if "favorite" in data:
        item.favorite = bool(data["favorite"])
    if "trashed" in data:
        trashed = bool(data["trashed"])
        item.trashed = trashed
        item.deleted_at = datetime.utcnow() if trashed else None

    item.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(serialize_item(item))


@app.route("/api/items/<int:item_id>", methods=["DELETE"])
@login_required
def delete_item(item_id):
    item = Item.query.get_or_404(item_id)

    if item.drive_file_id:
        try:
            drive.delete_file(item.drive_file_id)
        except Exception as exc:  # Drive hiccup shouldn't block deleting the record
            app.logger.warning("Could not delete Drive file %s: %s", item.drive_file_id, exc)

    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True})


# =============================================================
# ITEMS — media memories (photo / video / voice)
# =============================================================

@app.route("/api/upload", methods=["POST"])
@login_required
def upload_media():
    folder_id = request.form.get("folderId")
    media_type = request.form.get("type") or "photo"
    title = request.form.get("title") or "Untitled"
    uploaded_file = request.files.get("file")

    if not folder_id or not db.session.get(Folder, folder_id):
        return jsonify({"error": "A valid folder is required."}), 400
    if not uploaded_file:
        return jsonify({"error": "Please choose a file first."}), 400

    if not drive.is_connected():
        # 409 is what app.js checks for to prompt "Connect Google Drive".
        return jsonify({"error": "Google Drive isn't connected yet."}), 409

    try:
        result = drive.upload_file(uploaded_file, title)
    except Exception:
        app.logger.exception("Google Drive upload failed")
        return jsonify({"error": "Could not upload to Google Drive."}), 502

    item = Item(
        folder_id=folder_id,
        type=media_type,
        title=title,
        file_name=uploaded_file.filename,
        size_bytes=result["size"],
        drive_file_id=result["id"],
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(serialize_item(item)), 201


@app.route("/api/media/<int:item_id>")
@login_required
def stream_media(item_id):
    item = Item.query.get_or_404(item_id)

    if not item.drive_file_id:
        abort(404)

    try:
        file_stream, mimetype = drive.download_file(item.drive_file_id)
    except Exception:
        app.logger.exception("Could not stream Drive file for item %s", item_id)
        abort(404)

    return send_file(
        file_stream, mimetype=mimetype,
        download_name=item.file_name or "file", conditional=True,
    )


# =============================================================
# GOOGLE DRIVE CONNECTION
# =============================================================

@app.route("/google/status")
@login_required
def google_status():
    return jsonify({
        "hasClientCredentials": drive.has_client_credentials(),
        "connected": drive.is_connected(),
    })


@app.route("/google/authorize")
@login_required
def google_authorize():
    if not drive.has_client_credentials():
        return "credentials.json is missing — see README.md.", 500

    redirect_uri = url_for("google_callback", _external=True)
    auth_url, state, code_verifier = drive.build_authorization_url(redirect_uri)

    # Both must survive the round trip to Google and back, so they're
    # stashed in the session rather than kept on a local Flow object
    # (which doesn't persist across the redirect).
    session["google_oauth_state"] = state
    session["google_oauth_code_verifier"] = code_verifier

    return redirect(auth_url)


@app.route("/google/callback")
@login_required
def google_callback():
    redirect_uri = url_for("google_callback", _external=True)
    state = session.get("google_oauth_state")
    code_verifier = session.get("google_oauth_code_verifier")

    drive.finish_authorization(request.url, redirect_uri, state, code_verifier)

    # Clean up now that the flow is done — nothing left to protect.
    session.pop("google_oauth_state", None)
    session.pop("google_oauth_code_verifier", None)

    return redirect(url_for("home"))


if __name__ == "__main__":
    debug = os.getenv("FLASK_ENV", "production") == "development"
    app.run(debug=debug)