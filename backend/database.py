"""
database.py — Embedded SQLite Storage for NASA SPHEREx Citizen Science Discoveries.

Zero-configuration, thread-safe embedded database managing:
- Candidate discoveries flagged by citizen scientists across the sky
- Community corroboration votes and scientific vetting
- Exporting Minor Planet Center (MPC) & NASA IRSA formatted dossiers
"""

import os
import sqlite3
import datetime
import math
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "discoveries.db")


def get_db_connection():
    """Establish and configure a SQLite connection."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create schema tables if they do not exist and seed initial benchmarks."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 1. Candidates Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                id TEXT PRIMARY KEY,
                ra_deg REAL NOT NULL,
                dec_deg REAL NOT NULL,
                ra_hms TEXT NOT NULL,
                dec_dms TEXT NOT NULL,
                pixel_x REAL NOT NULL,
                pixel_y REAL NOT NULL,
                category TEXT NOT NULL,
                confidence INTEGER DEFAULT 4,
                notes TEXT DEFAULT '',
                observer_callsign TEXT DEFAULT 'Citizen Scientist',
                target_preset TEXT DEFAULT '',
                band_group TEXT DEFAULT 'stacked',
                epoch_label TEXT DEFAULT '',
                upvotes INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)

        # 2. Community Corroboration Votes Table (with voter_id for anti-spam deduplication)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS community_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_id TEXT NOT NULL,
                vote_type TEXT NOT NULL,
                voter_callsign TEXT DEFAULT 'Anonymous Citizen',
                voter_id TEXT DEFAULT '',
                comment TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
            )
        """)

        # Schema migration: ensure voter_id column exists in existing database
        try:
            cursor.execute("ALTER TABLE community_votes ADD COLUMN voter_id TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Prune any orphan votes left from deleted temporary test objects
        cursor.execute("DELETE FROM community_votes WHERE candidate_id NOT IN (SELECT id FROM candidates)")
        conn.commit()

        # Seed initial realistic benchmark discoveries if not present
        seed_initial_discoveries(cursor)
        conn.commit()

    finally:
        conn.close()


def seed_initial_discoveries(cursor: sqlite3.Cursor):
    """Seed community verification examples for NASA benchmark targets."""
    initial_seeds = [
        {
            "id": "SPX-2026-0001",
            "ra_deg": 57.0625,
            "dec_deg": 7.788889,
            "ra_hms": "03h48m15.000s",
            "dec_dms": "+07d47m20.00s",
            "pixel_x": 134.2,
            "pixel_y": 126.8,
            "category": "planet_x",
            "confidence": 5,
            "notes": "90377 Sedna orbital drift confirmed across 4 SPHEREx epochs with distinct H2O/CH4 ice absorption.",
            "observer_callsign": "Dr. Mike Brown (Caltech / Planet 9 Team)",
            "target_preset": "90377 Sedna",
            "band_group": "stacked",
            "epoch_label": "All 4 Epochs Shift & Add Stack",
            "upvotes": 14,
            "created_at": "2026-11-13 10:15:00"
        },
        {
            "id": "SPX-2026-0002",
            "ra_deg": 133.795129,
            "dec_deg": -7.245147,
            "ra_hms": "08h55m10.831s",
            "dec_dms": "-07d14m42.53s",
            "pixel_x": 128.0,
            "pixel_y": 128.0,
            "category": "brown_dwarf",
            "confidence": 5,
            "notes": "WISE 0855 proper-motion dipole. Completely absent in Gaia DR3 (optical dropout confirmed).",
            "observer_callsign": "Backyard Worlds Citizen Science",
            "target_preset": "WISE 0855",
            "band_group": "filter_wise_w2",
            "epoch_label": "Difference Image (E2 - E1)",
            "upvotes": 28,
            "created_at": "2026-11-13 10:45:00"
        },
        {
            "id": "SPX-2026-0003",
            "ra_deg": 162.328,
            "dec_deg": -53.319472,
            "ra_hms": "10h49m18.720s",
            "dec_dms": "-53d19m10.10s",
            "pixel_x": 133.2,
            "pixel_y": 131.8,
            "category": "brown_dwarf",
            "confidence": 5,
            "notes": "Luhman 16 binary companion separation and deep 3.3um methane absorption profile.",
            "observer_callsign": "SPHEREx Science Working Group",
            "target_preset": "Luhman 16",
            "band_group": "filter_ch4_deep",
            "epoch_label": "Epoch 1 (2025-06-15)",
            "upvotes": 9,
            "created_at": "2026-11-13 11:30:00"
        }
    ]

    for s in initial_seeds:
        cursor.execute("""
            INSERT OR IGNORE INTO candidates (
                id, ra_deg, dec_deg, ra_hms, dec_dms, pixel_x, pixel_y,
                category, confidence, notes, observer_callsign, target_preset,
                band_group, epoch_label, upvotes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["ra_deg"], s["dec_deg"], s["ra_hms"], s["dec_dms"],
            s["pixel_x"], s["pixel_y"], s["category"], s["confidence"],
            s["notes"], s["observer_callsign"], s["target_preset"],
            s["band_group"], s["epoch_label"], s["upvotes"], s["created_at"]
        ))


def add_candidate(data: Dict[str, Any]) -> Dict[str, Any]:
    """Store a newly flagged candidate discovery."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cand_id = data.get("id") or f"SPX-2026-{int(datetime.datetime.utcnow().timestamp()) % 100000:05d}"
        created_at = data.get("created_at") or datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        observer = data.get("observer_callsign") or data.get("observer") or "Citizen Scientist"

        # Clear any prior votes associated with this ID
        cursor.execute("DELETE FROM community_votes WHERE candidate_id = ?", (cand_id,))

        cursor.execute("""
            INSERT OR REPLACE INTO candidates (
                id, ra_deg, dec_deg, ra_hms, dec_dms, pixel_x, pixel_y,
                category, confidence, notes, observer_callsign, target_preset,
                band_group, epoch_label, upvotes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cand_id,
            float(data["ra_deg"]),
            float(data["dec_deg"]),
            str(data.get("ra_hms", "")),
            str(data.get("dec_dms", "")),
            float(data.get("pixel_x", 128.0)),
            float(data.get("pixel_y", 128.0)),
            str(data.get("category", "planet_x")),
            int(data.get("confidence", 4)),
            str(data.get("notes", "")),
            observer,
            str(data.get("target_preset", "")),
            str(data.get("band_group", "stacked")),
            str(data.get("epoch_label", "")),
            int(data.get("upvotes", 1)),
            created_at
        ))
        conn.commit()

        cursor.execute("SELECT * FROM candidates WHERE id = ?", (cand_id,))
        row = cursor.fetchone()
        return dict(row)
    finally:
        conn.close()


def get_candidates(
    category: Optional[str] = None,
    ra_deg: Optional[float] = None,
    dec_deg: Optional[float] = None,
    radius_deg: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Query candidates with optional category or coordinate proximity filters."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT * FROM candidates WHERE 1=1"
        params = []

        if category and category != "all":
            query += " AND category = ?"
            params.append(category)

        query += " ORDER BY upvotes DESC, created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = [dict(r) for r in rows]

        # Spatial distance filtering if center and radius requested
        if ra_deg is not None and dec_deg is not None and radius_deg is not None:
            filtered = []
            for c in results:
                dra = (c["ra_deg"] - ra_deg) * math.cos(math.radians(dec_deg))
                ddec = c["dec_deg"] - dec_deg
                dist = math.sqrt(dra**2 + ddec**2)
                if dist <= radius_deg:
                    c["distance_arcmin"] = round(dist * 60.0, 2)
                    filtered.append(c)
            return filtered

        return results
    finally:
        conn.close()


def get_candidate_by_id(candidate_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full candidate details and community votes by ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,))
        row = cursor.fetchone()
        if not row:
            return None
        cand = dict(row)

        cursor.execute("SELECT * FROM community_votes WHERE candidate_id = ? ORDER BY created_at DESC", (candidate_id,))
        cand["votes"] = [dict(v) for v in cursor.fetchall()]
        return cand
    finally:
        conn.close()


def vote_candidate(
    candidate_id: str,
    vote_type: str = "corroborate",
    voter_callsign: str = "Citizen Scientist",
    voter_id: str = "",
    comment: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Cast, deduplicate, or toggle a community corroboration vote on a candidate.
    Prevents vote spamming by verifying prior votes from voter_id or voter_callsign.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 1. Verify candidate exists
        cursor.execute("SELECT id, upvotes FROM candidates WHERE id = ?", (candidate_id,))
        cand_row = cursor.fetchone()
        if not cand_row:
            return None

        # 2. Check for an existing vote by this voter (using voter_id or voter_callsign)
        existing_vote = None
        if voter_id and voter_id.strip():
            cursor.execute(
                "SELECT id, vote_type FROM community_votes WHERE candidate_id = ? AND voter_id = ?",
                (candidate_id, voter_id.strip())
            )
            existing_vote = cursor.fetchone()
        elif voter_callsign and voter_callsign.strip() and voter_callsign != "Citizen Scientist":
            cursor.execute(
                "SELECT id, vote_type FROM community_votes WHERE candidate_id = ? AND voter_callsign = ?",
                (candidate_id, voter_callsign.strip())
            )
            existing_vote = cursor.fetchone()

        # 3. Handle unvote / remove action
        if vote_type in ["unvote", "remove"]:
            if existing_vote:
                cursor.execute("DELETE FROM community_votes WHERE id = ?", (existing_vote["id"],))
                cursor.execute("UPDATE candidates SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", (candidate_id,))
                conn.commit()
            updated = get_candidate_by_id(candidate_id)
            if updated:
                updated["user_voted"] = False
            return updated

        # 4. Handle corroborate action
        if existing_vote:
            # Voter has already corroborated this candidate — block duplicate inflation!
            updated = get_candidate_by_id(candidate_id)
            if updated:
                updated["user_voted"] = True
                updated["already_voted"] = True
            return updated

        # 5. First-time vote: record vote & increment count
        now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO community_votes (candidate_id, vote_type, voter_callsign, voter_id, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (candidate_id, vote_type, voter_callsign, voter_id or "", comment, now))

        cursor.execute("""
            UPDATE candidates SET upvotes = upvotes + 1 WHERE id = ?
        """, (candidate_id,))

        conn.commit()
        updated = get_candidate_by_id(candidate_id)
        if updated:
            updated["user_voted"] = True
        return updated
    finally:
        conn.close()


def delete_candidate(candidate_id: str) -> bool:
    """Remove a candidate discovery from database."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM community_votes WHERE candidate_id = ?", (candidate_id,))
        cursor.execute("DELETE FROM candidates WHERE id = ?", (candidate_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def export_mpc_dossier() -> str:
    """Format full database into a Minor Planet Center (MPC) batch discovery dossier."""
    candidates = get_candidates()
    now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        "COD SPX",
        f"OBS NASA SPHEREx Citizen Science Working Group — Space Apps 2026",
        f"DAT {now_str}",
        f"NUM_CANDIDATES {len(candidates)}",
        "--------------------------------------------------------------------------------",
        "OBJ_ID       RA (J2000)      DEC (J2000)      CONF   VOTES  CATEGORY     OBSERVER",
        "--------------------------------------------------------------------------------"
    ]

    for c in candidates:
        ra_hms = c["ra_hms"].replace("h", " ").replace("m", " ").replace("s", "")
        dec_dms = c["dec_dms"].replace("d", " ").replace("m", " ").replace("s", "")
        cat_short = c["category"].upper()[:10]
        obs = (c.get("observer_callsign") or "Citizen")[:14]
        lines.append(
            f"{c['id']:<12} {ra_hms:<15} {dec_dms:<16} {c['confidence']:<6} {c['upvotes']:<6} {cat_short:<12} {obs}"
        )

    lines.append("--------------------------------------------------------------------------------")
    lines.append("END OF SPHEREx CITIZEN SCIENCE DOSSIER")
    return "\n".join(lines)


# Initialize DB on module import
init_db()
