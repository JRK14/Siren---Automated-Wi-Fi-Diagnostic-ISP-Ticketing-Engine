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
import requests
import json

# Setup OpenRouter config
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

async def generate_llm_summaries(diag: dict) -> tuple:
    """
    Agent 5: Response Generation.
    Uses OpenRouter (google/gemini-2.5-flash) to translate raw metric parameters.
    Falls back completely silently if the API fails, times out, or returns bad data.
    """
    if not OPENROUTER_API_KEY:
        return None, None
        
    try:
        # Construct OpenAI-compatible OpenRouter payload
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://siren-wifi.com",
            "X-Title": "Siren WiFi Diagnostics",
            "Content-Type": "application/json"
        }
        
        prompt = f"""
        You are an advanced AI network diagnostics assistant.
        Analyze these network parameters:
        - Root Cause Class: {diag.get('root_cause')}
        - RSSI: {diag.get('rssi')} dBm
        - Latency: {diag.get('latency')} ms
        - Packet Loss: {diag.get('packet_loss')}%
        - Jitter: {diag.get('jitter')} ms
        - DNS Resolution time: {diag.get('dns_time')} ms
        - HTTP Probe: {diag.get('http_probe_success')}
        - Speed (Download/Upload): {diag.get('download_speed')}/{diag.get('upload_speed')} Mbps

        Return a JSON object containing:
        1. "user_summary": A clear, non-technical explanation for a home user explaining what is wrong and how to solve it. Keep it friendly.
        2. "technical_summary": A concise technical ticket description for an ISP operations engineer.

        Format strictly as raw JSON, e.g.:
        {{
            "user_summary": "...",
            "technical_summary": "..."
        }}
        Do not wrap in markdown or backticks.
        """
        
        # Use google/gemini-2.5-flash: the cheapest, fastest, and most efficient quality model on OpenRouter
        data = {
            "model": "google/gemini-2.5-flash",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "timeout": 6.0
        }
        
        # Run request inside a thread pool or call synchronously (low weight)
        response = requests.post(url, headers=headers, json=data, timeout=8.0)
        
        if response.status_code == 200:
            res_json = response.json()
            content = res_json["choices"][0]["message"]["content"].strip()
            
            # Remove any markdown JSON wrappers if returned
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
                
            parsed = json.loads(content.strip())
            return parsed.get("user_summary"), parsed.get("technical_summary")
            
    except Exception as e:
        # Silent failure: log to backend stdout, user never sees any outage
        print(f"[LLM Agent] OpenRouter transaction failed: {e}. Falling back silently.")
        
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
