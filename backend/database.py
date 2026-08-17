import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables (supports running from root or backend directory)
if not load_dotenv():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/parallax_diagnostics")

# Initialize Motor Client (with 5-second connection timeout to prevent long hangs)
client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client.get_default_database()

# Collections
users = db["users"]
diagnostics = db["diagnostics"]
tickets = db["tickets"]

# Counter for ticket IDs to keep them sequential/formatted if needed
counters = db["counters"]

async def get_next_sequence(name: str) -> int:
    """Helper to generate auto-incrementing integer IDs if needed."""
    ret = await counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return ret["seq"]

def helper_id(doc: dict) -> dict:
    """Converts MongoDB _id (ObjectId) to string 'id' for API compatibility."""
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc
