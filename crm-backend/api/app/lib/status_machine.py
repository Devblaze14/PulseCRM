"""
status_machine — the rules for advancing a Communication's status safely.

Callbacks from the channel can arrive OUT OF ORDER (the simulator deliberately
scrambles them) and can be DUPLICATED (retries). This module encodes the policy
that keeps status monotonic and correct:

  * Each status has a RANK. We only ever move a Communication FORWARD: an
    incoming event advances status only if its rank is higher than the current
    rank. A late OPENED arriving after CLICKED is recorded as a raw event (audit
    log) but must NOT pull the status back from CLICKED to OPENED.
  * FAILED is a terminal side-branch, not part of the linear funnel. We treat a
    FAILED as overriding only the pre-delivery states; once a message is clearly
    progressing (DELIVERED+), a stray FAILED is ignored. (Simplification noted in
    the README — a real system might model partial failures differently.)
"""

from __future__ import annotations

from app.models import CommStatus

# Linear funnel ranks. Higher = further along.
RANK: dict[CommStatus, int] = {
    CommStatus.QUEUED: 0,
    CommStatus.SENT: 1,
    CommStatus.DELIVERED: 2,
    CommStatus.OPENED: 3,
    CommStatus.READ: 4,
    CommStatus.CLICKED: 5,
    CommStatus.CONVERTED: 6,
}


def next_status(current: CommStatus, incoming: CommStatus) -> CommStatus:
    """Return the status the Communication should hold after `incoming`.

    Never regresses. Returns `current` unchanged when the incoming event is older
    (lower rank) or a no-op.
    """
    # FAILED handling: only meaningful before real delivery progress.
    if incoming == CommStatus.FAILED:
        if current in (CommStatus.QUEUED, CommStatus.SENT):
            return CommStatus.FAILED
        return current  # already progressing → ignore a late/stray FAILED

    # If we're currently FAILED but a genuine delivery event shows up, trust the
    # positive signal and move into the funnel (delivery clearly happened).
    if current == CommStatus.FAILED:
        return incoming if incoming in RANK else current

    # Linear funnel: advance only on strictly higher rank.
    if RANK.get(incoming, -1) > RANK.get(current, -1):
        return incoming
    return current
