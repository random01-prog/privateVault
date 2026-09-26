# My Diary — Personal Memory Vault

A private, single/two-user diary app: text notes (rich text with fonts,
colors, bold/italic/etc.), photos, videos and voice recordings, organized
into folders. Media is stored in Google Drive (in a private "My Diary
Vault" folder your account owns); text/folder data is stored server-side
in `data/app_data.json` for now, and is designed to move to PostgreSQL
later without changing any frontend code.

## Run it locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export FLASK_ENV=development
export FLASK_SECRET_KEY="something-random"
export APP_USERNAME="lavanya"     # optional, defaults to "lavanya"
export APP_PASSWORD="1234"        # optional, defaults to "1234" - change this!

python3 app.py
```

Visit http://127.0.0.1:5000

## Connect Google Drive (for photos/videos/voice)

1. In Google Cloud Console, create a project, enable the **Google Drive API**.
2. Create an OAuth 2.0 Client ID of type **Web application**.
   - Authorized redirect URI (local): `http://127.0.0.1:5000/google/callback`
   - Authorized redirect URI (deployed): `https://your-domain.com/google/callback`
3. Download the client secret JSON and save it here as `credentials.json`
   (already gitignored — never commit it).
4. Log in to the app, then open the sidebar and click **Connect Google Drive**
   (or visit `/google/authorize`). Approve access once.
5. `token.json` is created automatically and reused after that.

**To reset the Google connection:** stop the app, delete `credentials.json`
and/or `token.json`, then repeat the steps above.

## Notes on the current storage

- Folders and text/media *records* (title, type, favorite, trash state, and
  which Drive file backs a memory) live in `data/app_data.json`.
- The actual photo/video/voice **bytes** live in Google Drive, never on this
  server's disk, and are streamed back through `/api/media/<id>` using your
  stored OAuth token — so they stay private, not "anyone with the link".
- When you're ready to add PostgreSQL: swap `data_store.py`'s `load()`/`save()`
  for real queries against tables shaped like `{folders: [...], items: [...]}`;
  nothing else in `app.py` or the frontend needs to change.