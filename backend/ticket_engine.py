import random
import string
from datetime import datetime, timedelta
from bson import ObjectId
try:
    import database as db
except ModuleNotFoundError:
    import backend.database as db

def generate_ticket_id():
    """Generates a unique reference ticket ID, e.g., NET-9C2A4F."""
    chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"NET-{chars}"

async def check_for_duplicate_ticket(user_id: str, root_cause: str, window_hours: int = 24) -> bool:
    """
    Checks if a user already has an active (non-Closed) ticket
    for the exact same root cause raised within a time window.
    """
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    
    # In MongoDB, we can perform a quick find querying by user_id and matching status/cause
    # Since diagnostics are linked to tickets, we can find tickets first, then look up the diagnostics.
    # But since each ticket has the diagnostic embedded or referenced, let's look up tickets for the user.
    async for ticket in db.tickets.find({
        "user_id": user_id,
        "status": {"$ne": "Closed"},
        "created_at": {"$gte": cutoff}
    }):
        # Find the diagnostic corresponding to the ticket
        diag = await db.diagnostics.find_one({"_id": ObjectId(ticket["diagnostic_id"])})
        if diag and diag.get("root_cause") == root_cause:
            return True
            
    return False

async def create_diagnostic_ticket(user_id: str, diagnostic_id: str, user_notes: str = ""):
    """
    Packages diagnostic payload, verifies duplicates, and creates
    a support ticket record.
    """
    diag = await db.diagnostics.find_one({"_id": ObjectId(diagnostic_id)})
    if not diag:
        raise ValueError("Diagnostic record not found")
        
    # Deduplication check
    if await check_for_duplicate_ticket(user_id, diag["root_cause"]):
        raise ValueError(f"A ticket for '{diag['root_cause']}' is already open. Duplicate ticket suppressed.")

    # Determine Severity based on root cause & anomalies
    severity = "LOW"
    root_cause = diag.get("root_cause", "")
    if root_cause in ["ISP Gateway Congestion", "Router Hardware/Crash"]:
        severity = "CRITICAL"
    elif root_cause in ["DNS Server Outage", "ISP Bandwidth Throttling"]:
        severity = "HIGH"
    elif root_cause in ["Wi-Fi RF Degradation", "Router Bufferbloat"]:
        severity = "MEDIUM"

    ticket_id = generate_ticket_id()
    new_ticket = {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "diagnostic_id": str(diag["_id"]),
        "severity": severity,
        "status": "Open",
        "user_notes": user_notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "isp_response": None,
        "isp_responded_at": None
    }
    
    result = await db.tickets.insert_one(new_ticket)
    new_ticket["id"] = str(result.inserted_id)
    return new_ticket
