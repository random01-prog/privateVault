"""
All Google Drive / OAuth logic lives here, isolated from app.py.

Flow:
  1. GET /google/authorize  -> build_authorization_url() -> redirect user to Google
  2. GET /google/callback   -> finish_authorization()    -> saves token.json
  3. Every upload/download/delete reuses the saved token, refreshing it
     automatically when it expires.

All media files are stored inside a single Drive folder named
"My Diary Vault" (created automatically the first time it's needed), owned
by whichever Google account you connect.
"""

import io
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
VAULT_FOLDER_NAME = "My Diary Vault"

# Cached for the life of the process so we don't look it up on every request.
_vault_folder_id_cache = None


def has_client_credentials():
    """Whether credentials.json (the OAuth client secret) exists."""
    return os.path.exists(CREDENTIALS_FILE)


def _load_credentials():
    if not os.path.exists(TOKEN_FILE):
        return None

    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        _save_credentials(creds)

    return creds


def _save_credentials(creds):
    with open(TOKEN_FILE, "w") as fh:
        fh.write(creds.to_json())


def is_connected():
    creds = _load_credentials()
    return bool(creds and creds.valid)


def build_authorization_url(redirect_uri):
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=redirect_uri
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # forces a refresh_token every time, useful while testing
    )
    return auth_url, state


def finish_authorization(authorization_response_url, redirect_uri, state):
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=redirect_uri, state=state
    )
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