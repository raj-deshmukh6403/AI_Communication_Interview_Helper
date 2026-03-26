"""
session_naming.py — Auto-generate unique human-readable session names
=====================================================================
Format: "Software Engineer @ Google — Mar 24, 2026 · Session 3"
"""

from datetime import datetime


def generate_session_name(
    position: str,
    company_name: str = None,
    session_number: int = 1,
) -> str:
    """
    Generate a unique readable session name.

    Examples:
      "Software Engineer @ Google — Mar 24, 2026 · Session 3"
      "Backend Developer — Mar 24, 2026 · Session 1"
    """
    date_str = datetime.utcnow().strftime("%b %d, %Y")

    if company_name:
        base = f"{position} @ {company_name}"
    else:
        base = position

    return f"{base} — {date_str} · Session {session_number}"


async def get_next_session_number(db, user_id: str) -> int:
    """
    Count how many sessions this user already has to generate the next number.
    """
    count = await db.sessions.count_documents({"user_id": user_id})
    return count + 1