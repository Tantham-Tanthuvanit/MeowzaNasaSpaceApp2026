"""
supabase_client.py — The backend's one Supabase connection.

Reads SUPABASE_URL and SUPABASE_SECRET_KEY from backend/.env (see .env.example).
The secret key bypasses RLS, so it must only ever live on the server.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

BUCKET = "sky-cutouts"


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in backend/.env")
    return create_client(url, key)
