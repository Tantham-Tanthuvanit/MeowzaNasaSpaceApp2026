"""
supabase_client.py — The backend's one Supabase connection.

Reads SUPABASE_URL and a key from backend/.env (optional, git-ignored, private overrides) and then
backend/public.env (committed, shared settings). Values already set win, so .env beats public.env.

- SUPABASE_PUBLISHABLE_KEY (sb_publishable_...): the normal setup. The key is public and is in
  public.env. The backend signs in as a Supabase anonymous user, so row-level security knows
  who it is: everyone can read, and you can only change or delete the flags, votes and projects
  you made. The session is kept in backend/.supabase-session.json, so you stay the same user
  after a restart. Delete that file and you become a new user (your old rows become read-only).
- SUPABASE_SECRET_KEY (sb_secret_...): optional, for the project owners only, in backend/.env. It
  bypasses RLS and is used instead when it is set. Never commit or share it.
"""

import json
import os
import threading
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client
from supabase_auth import SyncSupportedStorage

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "public.env"))

BUCKET = "sky-cutouts"
SESSION_FILE = os.path.join(os.path.dirname(__file__), ".supabase-session.json")


class FileSessionStorage(SyncSupportedStorage):
    """Keeps the auth session in a local JSON file. The library rewrites it on every token refresh."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.lock = threading.Lock()

    def _read(self) -> dict:
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _write(self, data: dict) -> None:
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, self.path)
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    def get_item(self, key: str) -> Optional[str]:
        with self.lock:
            return self._read().get(key)

    def set_item(self, key: str, value: str) -> None:
        with self.lock:
            data = self._read()
            data[key] = value
            self._write(data)

    def remove_item(self, key: str) -> None:
        with self.lock:
            data = self._read()
            if data.pop(key, None) is not None:
                self._write(data)


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not (secret_key or publishable_key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are missing (backend/public.env)")
    if secret_key:
        return create_client(url, secret_key)

    client = create_client(url, publishable_key, ClientOptions(
        storage=FileSessionStorage(SESSION_FILE), persist_session=True, auto_refresh_token=True))
    client.auth.initialize_from_storage()  # reuse the saved session, refreshing it if it has expired
    if client.auth.get_session() is None:
        try:
            client.auth.sign_in_anonymously()
        except Exception as e:
            raise RuntimeError(f"Could not sign in to Supabase anonymously: {e}. "
                               "Anonymous sign-ins must be on in the Supabase project.") from e
    return client


def current_user_id() -> Optional[str]:
    """The signed-in anonymous user's id, or None when running with the secret key."""
    session = get_client().auth.get_session()
    return session.user.id if session else None
