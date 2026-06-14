"""One-off: backfill short AI titles for existing campaigns.

Run from crm-backend/api with the venv:
    .venv/Scripts/python.exe -m scripts.backfill_titles          # rename long names
    .venv/Scripts/python.exe -m scripts.backfill_titles --force  # rename all
    .venv/Scripts/python.exe -m scripts.backfill_titles --dry    # preview only

Uses the same engine/config/Groq as the app, so it targets whatever DATABASE_URL
points to (the live Supabase Postgres here). The service's generate_title falls
back to a clean word-boundary trim if the LLM is unavailable.
"""

import sys

from sqlmodel import Session, select

from app.lib.db import engine
from app.models import Campaign
from app.services import ai_service
from app.services.campaign_service import _looks_auto_derived


def main() -> None:
    force = "--force" in sys.argv
    dry = "--dry" in sys.argv

    with Session(engine) as session:
        campaigns = list(session.exec(select(Campaign)).all())
        changes = []
        for c in campaigns:
            if not force and not _looks_auto_derived(c.name, c.goal):
                continue
            new_title = ai_service.generate_title(c.goal).text
            if not new_title or new_title == c.name:
                continue
            changes.append((c, new_title))

        print(f"Scanned {len(campaigns)} campaigns; {len(changes)} to update.\n")
        for c, new_title in changes:
            print(f"  #{c.id}")
            print(f"    old: {c.name!r}")
            print(f"    new: {new_title!r}\n")

        if dry:
            print("Dry run — nothing written.")
            return

        for c, new_title in changes:
            c.name = new_title
            session.add(c)
        if changes:
            session.commit()
        print(f"Committed {len(changes)} rename(s).")


if __name__ == "__main__":
    main()
