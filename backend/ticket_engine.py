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

import os

# Setup Gemini model configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

async def generate_llm_summaries(diag: dict) -> tuple:
    """
    Agent 5: Response Generation.
    Uses Google Gemini (1.5 Flash) to translate raw metric parameters into structured summaries.
    Returns (user_summary, technical_summary).
    """
    if not GEMINI_API_KEY:
        # Fallback to high-fidelity templates if API key is not configured
        return None, None
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        You are an advanced AI network diagnostics agent for an ISP.
        Translate the following network parameters into two outputs:
        1. A plain-language, non-technical explanation for a home user explaining what is wrong and how to solve it.
        2. A concise, highly professional technical ticket description for an ISP operations engineer.

        Network Diagnostics:
        - Root Cause: {diag.get('root_cause')}
        - RSSI (Signal): {diag.get('rssi')} dBm
        - Avg Ping: {diag.get('latency')} ms
        - Packet Loss: {diag.get('packet_loss')}%
        - Jitter: {diag.get('jitter')} ms
        - DNS Resolution time: {diag.get('dns_time')} ms
        - HTTP Probe Success: {diag.get('http_probe_success')}
        - Download Speed: {diag.get('download_speed')} Mbps
        - Upload Speed: {diag.get('upload_speed')} Mbps

        Return the response strictly in this JSON format:
        {{
            "user_summary": "user explanation here",
            "technical_summary": "tech description here"
        }}
        Do not output any markdown code blocks or wrapper text, just the raw JSON object.
        """
        response = model.generate_content(prompt)
        import json
        text = response.text.strip()
        # Clean any accidental markdown backticks
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        data = json.loads(text.strip())
        return data.get("user_summary"), data.get("technical_summary")
    except Exception as e:
        print(f"[LLM Agent] Gemini Generation failed, falling back: {e}")
        return None, None

async def create_diagnostic_ticket(user_id: str, diagnostic_id: str, user_notes: str = ""):
    """
    Packages diagnostic payload, verifies duplicates, generates LLM summaries,
    and creates a support ticket record.
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

    # Invoke Agent 5: Response Generation (Gemini LLM)
    llm_user, llm_tech = await generate_llm_summaries(diag)
    
    # Save descriptions into diagnostic payload
    user_summary = llm_user or diag.get("user_summary", "A minor network fluctuation was detected.")
    technical_summary = llm_tech or diag.get("technical_summary", "General parameters deviated from baseline.")

    # Update diagnostic log with the generated descriptions
    await db.diagnostics.update_one(
        {"_id": ObjectId(diagnostic_id)},
        {"$set": {"user_summary": user_summary, "technical_summary": technical_summary}}
    )

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
