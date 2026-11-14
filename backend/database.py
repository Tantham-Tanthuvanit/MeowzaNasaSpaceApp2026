"""
database.py — Supabase storage for citizen-science discoveries and saved sky projects.

Tables (see supabase/migrations/):
- candidates: objects flagged by citizen scientists
- candidate_votes: community corroboration votes (upvotes = number of votes; one per voter_id per candidate)
- projects: saved sky positions shown on the Home map

Also formats the Minor Planet Center (MPC) style dossier export.
"""

import datetime
import math
from typing import Any, Dict, List, Optional

from supabase_client import get_client

CANDIDATE_FIELDS = ("ra_deg", "dec_deg", "ra_hms", "dec_dms", "pixel_x", "pixel_y", "category", "confidence",
                    "notes", "observer_callsign", "band_group", "epoch_label")
PROJECT_FIELDS = ("name", "description", "color", "ra_deg", "dec_deg", "bands")
OWNER_PREFIX = "__owner__:"


def _pack_epoch_owner(epoch_label: Optional[str], voter_id: Optional[str]) -> str:
    clean_epoch = (epoch_label or "").strip()
    clean_voter = (voter_id or "").strip()
    if not clean_voter:
        return clean_epoch
    return f"{OWNER_PREFIX}{clean_voter}\n{clean_epoch}"


def _unpack_owner(row: Dict[str, Any]) -> Optional[str]:
    """Extract the private owner voter_id from the candidate row and restore epoch_label."""
    raw = row.get("epoch_label") or ""
    if raw.startswith(OWNER_PREFIX):
        rest = raw[len(OWNER_PREFIX):]
        owner_id, _, epoch = rest.partition("\n")
        row["epoch_label"] = epoch
        return owner_id or None
    return None


def _with_upvotes(row: Dict[str, Any]) -> Dict[str, Any]:
    """Turn PostgREST's embedded vote count into the API's `upvotes` field."""
    row["upvotes"] = (row.pop("candidate_votes", None) or [{"count": 0}])[0]["count"]
    return row


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

def add_candidate(data: Dict[str, Any]) -> Dict[str, Any]:
    """Store a newly flagged candidate discovery."""
    voter_id = (data.get("voter_id") or "").strip() or None
    row = {k: data[k] for k in CANDIDATE_FIELDS if data.get(k) is not None}
    row["epoch_label"] = _pack_epoch_owner(row.get("epoch_label", ""), voter_id)
    created = get_client().table("candidates").insert(row).execute().data[0]
    _unpack_owner(created)
    created["upvotes"] = 0
    created["user_owned"] = bool(voter_id)
    return created


def get_candidates(
    category: Optional[str] = None,
    ra_deg: Optional[float] = None,
    dec_deg: Optional[float] = None,
    radius_deg: Optional[float] = None,
    voter_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Query candidates with optional category or coordinate proximity filters.
    With voter_id, each candidate also says whether that voter has voted for it (user_voted)
    and owns it (user_owned)."""
    query = get_client().table("candidates").select("*, candidate_votes(count)")
    if category and category != "all":
        query = query.eq("category", category)
    results = [_with_upvotes(r) for r in query.order("created_at", desc=True).execute().data]
    results.sort(key=lambda c: c["upvotes"], reverse=True)  # stable, so newest first within a vote count
    mine = set()
    if voter_id:
        mine = {v["candidate_id"] for v in get_client().table("candidate_votes").select("candidate_id")
                .eq("voter_id", voter_id).execute().data}
    for c in results:
        owner_id = _unpack_owner(c)
        c["user_owned"] = bool(voter_id and owner_id and owner_id == voter_id)
        if voter_id:
            c["user_voted"] = c["id"] in mine

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


def get_candidate_by_id(candidate_id: int, voter_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieve full candidate details and community votes by ID."""
    rows = (get_client().table("candidates").select("*, candidate_votes(*)")
            .eq("id", candidate_id).execute().data)
    if not rows:
        return None
    cand = rows[0]
    owner_id = _unpack_owner(cand)
    cand["user_owned"] = bool(voter_id and owner_id and owner_id == voter_id)
    cand["votes"] = sorted(cand.pop("candidate_votes", []), key=lambda v: v["created_at"], reverse=True)
    for v in cand["votes"]:
        v.pop("voter_id", None)  # private: knowing it would let someone else remove the vote
    cand["upvotes"] = len(cand["votes"])
    return cand


def vote_candidate(
    candidate_id: int,
    voter_id: str,
    vote_type: str = "corroborate",
    voter_callsign: str = "Citizen Scientist",
    comment: str = ""
) -> Optional[Dict[str, Any]]:
    """Cast a community corroboration vote, or take it back with vote_type "unvote".
    A voter counts once per candidate: voting again changes nothing (the database enforces it)."""
    if get_candidate_by_id(candidate_id) is None:
        return None
    votes = get_client().table("candidate_votes")
    if vote_type == "unvote":
        votes.delete().eq("candidate_id", candidate_id).eq("voter_id", voter_id).execute()
    else:
        votes.upsert({
            "candidate_id": candidate_id, "voter_id": voter_id, "vote_type": vote_type,
            "voter_callsign": voter_callsign, "comment": comment,
        }, on_conflict="candidate_id,voter_id", ignore_duplicates=True).execute()
    cand = get_candidate_by_id(candidate_id, voter_id=voter_id)
    cand["user_voted"] = vote_type != "unvote"
    return cand


def delete_candidate(candidate_id: int, voter_id: Optional[str] = None) -> str:
    """Remove a candidate discovery (its votes go with it) if `voter_id` matches its owner.
    Returns 'deleted', 'not_found', or 'forbidden'."""
    rows = get_client().table("candidates").select("id, epoch_label").eq("id", candidate_id).execute().data
    if not rows:
        return "not_found"
    owner_id = _unpack_owner(rows[0])
    clean_voter = (voter_id or "").strip()
    if not clean_voter or not owner_id or owner_id != clean_voter:
        return "forbidden"
    get_client().table("candidates").delete().eq("id", candidate_id).execute()
    return "deleted"


def export_mpc_dossier() -> str:
    """Format full database into a Minor Planet Center (MPC) batch discovery dossier."""
    candidates = get_candidates()
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

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
        obj_id = f"SPX-{c['id']:06d}"
        lines.append(
            f"{obj_id:<12} {ra_hms:<15} {dec_dms:<16} {c['confidence']:<6} {c['upvotes']:<6} {cat_short:<12} {obs}"
        )

    lines.append("--------------------------------------------------------------------------------")
    lines.append("END OF SPHEREx CITIZEN SCIENCE DOSSIER")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

def list_projects() -> List[Dict[str, Any]]:
    return get_client().table("projects").select("*").order("created_at").execute().data


def add_project(data: Dict[str, Any]) -> Dict[str, Any]:
    row = {k: data[k] for k in PROJECT_FIELDS if data.get(k) is not None}
    return get_client().table("projects").insert(row).execute().data[0]


def update_project(project_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    row = {k: data[k] for k in PROJECT_FIELDS if data.get(k) is not None}
    if not row:
        rows = get_client().table("projects").select("*").eq("id", project_id).execute().data
    else:
        rows = get_client().table("projects").update(row).eq("id", project_id).execute().data
    return rows[0] if rows else None


def delete_project(project_id: int) -> bool:
    return bool(get_client().table("projects").delete().eq("id", project_id).execute().data)
