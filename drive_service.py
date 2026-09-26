"""
All Google Drive / OAuth logic lives here, isolated from app.py.

Flow:
  1. GET /google/authorize  -> build_authorization_url() -> redirect user to Google
  2. GET /google/callback   -> finish_authorization()    -> saves the token to Postgres
  3. Every upload/download/delete reuses the saved token, refreshing it
     automatically when it expires.

The OAuth token itself is stored as a single row in the `google_tokens`
table (see models.py) rather than a token.json file — most deploy hosts
wipe local disk on every redeploy/restart, but a DB row survives.

credentials.json (the OAuth *client secret*, not the user's token) still
needs to exist on disk wherever this runs — on Render that's done via a
Secret File, locally it just sits in the project root.

All media files are stored inside a single Drive folder named
"Navya Tales Vault" (created automatically the first time it's needed),
owned by whichever Google account you connect.
"""

import io
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from models import GoogleToken, db

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
VAULT_FOLDER_NAME = "Navya Tales Vault"

# Legacy path: only used once, to migrate an existing local token.json (if
# any) into the DB the first time this runs. Not written to going forward.
LEGACY_TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")

# Fixed row id — this app connects a single shared Drive account, same as
# the old single token.json file.
TOKEN_ROW_ID = 1

# Cached for the life of the process so we don't look it up on every request.
_vault_folder_id_cache = None


def has_client_credentials():
    """Whether credentials.json (the OAuth client secret) exists."""
    return os.path.exists(CREDENTIALS_FILE)


def _load_credentials():
    token_row = db.session.get(GoogleToken, TOKEN_ROW_ID)

    if not token_row and os.path.exists(LEGACY_TOKEN_FILE):
        # One-time migration: reuse whatever's already connected locally so
        # you don't have to redo the Google consent screen.
        with open(LEGACY_TOKEN_FILE) as fh:
            _save_credentials_json(fh.read())
        token_row = db.session.get(GoogleToken, TOKEN_ROW_ID)

    if not token_row:
        return None

    creds = Credentials.from_authorized_user_info(json.loads(token_row.token_json), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        _save_credentials(creds)

    return creds


def _save_credentials(creds):
    _save_credentials_json(creds.to_json())


def _save_credentials_json(token_json):
    token_row = db.session.get(GoogleToken, TOKEN_ROW_ID)

    if token_row:
        token_row.token_json = token_json
    else:
        token_row = GoogleToken(id=TOKEN_ROW_ID, token_json=token_json)
        db.session.add(token_row)

    db.session.commit()


def is_connected():
    creds = _load_credentials()
    return bool(creds and creds.valid)


def build_authorization_url(redirect_uri):
    """
    Starts the OAuth flow.

    Returns (auth_url, state, code_verifier). All three must be handed back
    to finish_authorization() later — Flow objects generate a fresh PKCE
    code_verifier internally, and since the authorize step and the callback
    step use two *separate* Flow instances (the app can't hold one in memory
    across a redirect), the verifier has to be carried through explicitly
    (e.g. stashed in the session) or Google will reject the token exchange
    with "invalid_grant: Missing code verifier".
    """
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=redirect_uri
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # forces a refresh_token every time, useful while testing
    )
    return auth_url, state, flow.code_verifier


def finish_authorization(authorization_response_url, redirect_uri, state, code_verifier):
    """
    Completes the OAuth flow.

    code_verifier must be the exact value returned by build_authorization_url()
    for this same login attempt (round-tripped via the session) — it's what
    proves this token exchange belongs to the authorize request that started
    it (PKCE).
    """
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=redirect_uri, state=state
    )
    flow.code_verifier = code_verifier
    flow.fetch_token(authorization_response=authorization_response_url)
    _save_credentials(flow.credentials)


def _get_service():
    creds = _load_credentials()
    if not creds:
        raise RuntimeError("Google Drive is not connected.")
    return build("drive", "v3", credentials=creds)


def _get_vault_folder_id(service):
    global _vault_folder_id_cache

    if _vault_folder_id_cache:
        return _vault_folder_id_cache

    query = (
        f"name = '{VAULT_FOLDER_NAME}' and "
        "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    results = service.files().list(q=query, spaces="drive", fields="files(id, name)").execute()
    matches = results.get("files", [])

    if matches:
        _vault_folder_id_cache = matches[0]["id"]
        return _vault_folder_id_cache

    metadata = {"name": VAULT_FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"}
    created = service.files().create(body=metadata, fields="id").execute()
    _vault_folder_id_cache = created["id"]
    return _vault_folder_id_cache


def upload_file(file_storage, title):
    """
    file_storage: a Werkzeug FileStorage (request.files['file'])
    Returns {"id": drive_file_id, "size": bytes}
    """
    service = _get_service()
    folder_id = _get_vault_folder_id(service)

    raw_bytes = file_storage.read()
    media = MediaIoBaseUpload(
        io.BytesIO(raw_bytes),
        mimetype=file_storage.mimetype or "application/octet-stream",
        resumable=False,
    )
    metadata = {"name": file_storage.filename or title, "parents": [folder_id]}

    created = (
        service.files()
        .create(body=metadata, media_body=media, fields="id, size, mimeType")
        .execute()
    )

    size = int(created.get("size") or len(raw_bytes))
    return {"id": created["id"], "size": size}


def download_file(file_id):
    """Returns (BytesIO positioned at 0, mimetype)."""
    service = _get_service()

    meta = service.files().get(fileId=file_id, fields="mimeType").execute()
    request_obj = service.files().get_media(fileId=file_id)

    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request_obj)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    buffer.seek(0)
    return buffer, meta.get("mimeType", "application/octet-stream")


def delete_file(file_id):
    service = _get_service()
    service.files().delete(fileId=file_id).execute()