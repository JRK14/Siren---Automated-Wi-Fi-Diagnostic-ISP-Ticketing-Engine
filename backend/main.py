import asyncio
import json
import random
import datetime
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from bson import ObjectId

try:
    import database as db
    import auth
    import telemetry_collector as tc
    import diagnostic_suite as ds
    import anomaly_detector as ad
    import root_cause_classifier as rc
    import ticket_engine as te
    import isp_service_desk as sd
    from health_probe import run_network_health_probe
except ModuleNotFoundError:
    import backend.database as db
    import backend.auth as auth
    import backend.telemetry_collector as tc
    import backend.diagnostic_suite as ds
    import backend.anomaly_detector as ad
    import backend.root_cause_classifier as rc
    import backend.ticket_engine as te
    import backend.isp_service_desk as sd
    from backend.health_probe import run_network_health_probe

app = FastAPI(title="PS-S03 Wi-Fi Diagnostic & ISP Ticketing Engine")

# Configure CORS for local & hosted deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Pydantic schemas for REST endpoints
class UserSignUp(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    id_token: str

class DiagnosticTrigger(BaseModel):
    network_ssid: str
    custom_anomaly: str = None

class TicketCreateRequest(BaseModel):
    diagnostic_id: str
    user_notes: str = ""

class TicketRespondRequest(BaseModel):
    response_text: str

class ThresholdConfig(BaseModel):
    max_latency: float = 150.0
    max_jitter: float = 50.0
    max_packet_loss: float = 5.0
    http_failure: bool = True
    enable_auto_diagnostics: bool = True

# User extraction helper
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = auth.verify_token(token)
    if token_data is None or token_data.user_id is None:
        raise credentials_exception
    
    try:
        user = await db.users.find_one({"_id": ObjectId(token_data.user_id)})
    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception
    return db.helper_id(user)

# Active WebSocket connections list
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

# Background task loop startup
@app.on_event("startup")
async def startup_event():
    # Setup default System test user on boot if db is empty
    sys_user = await db.users.find_one({"email": "testuser@gmail.com"})
    if not sys_user:
        hashed = auth.get_password_hash("password123")
        user_record = {
            "email": "testuser@gmail.com",
            "hashed_password": hashed,
            "is_google_user": False,
            "created_at": datetime.datetime.utcnow()
        }
        await db.users.insert_one(user_record)
        print("[Startup] Seeded test user.")
        
    # Launch background network health probe daemon
    asyncio.create_task(run_network_health_probe())

# ----------------- AUTHENTICATION ENDPOINTS -----------------

@app.post("/api/auth/signup", status_code=201)
async def signup(payload: UserSignUp):
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        if existing.get("hashed_password"):
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        else:
            # Google user signing up with a password for the first time
            hashed = auth.get_password_hash(payload.password)
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"hashed_password": hashed}}
            )
            return {"message": "Password successfully added to your Google account"}
    
    hashed = auth.get_password_hash(payload.password)
    user_record = {
        "email": payload.email,
        "hashed_password": hashed,
        "is_google_user": False,
        "created_at": datetime.datetime.utcnow()
    }
    await db.users.insert_one(user_record)
    return {"message": "User registered successfully"}

@app.post("/api/auth/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email})
    if not user or not user.get("hashed_password") or not auth.verify_password(payload.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    user_id_str = str(user["_id"])
    access_token = auth.create_access_token(data={"sub": user["email"], "user_id": user_id_str})
    return {"access_token": access_token, "token_type": "bearer", "email": user["email"]}

@app.post("/api/auth/google")
async def google_authenticate(payload: GoogleAuthRequest):
    google_data = auth.verify_google_oauth_token(payload.id_token)
    if not google_data:
        raise HTTPException(status_code=401, detail="Google authentication failed")
        
    email = google_data["email"]
    
    # Auto-register user if not present, or link Google connection if they exist
    user = await db.users.find_one({"email": email})
    if not user:
        user_record = {
            "email": email,
            "is_google_user": True,
            "created_at": datetime.datetime.utcnow()
        }
        result = await db.users.insert_one(user_record)
        user_id_str = str(result.inserted_id)
    else:
        # Mark as google user if not already set, keeping the password
        if not user.get("is_google_user"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"is_google_user": True}}
            )
        user_id_str = str(user["_id"])
        
    access_token = auth.create_access_token(data={"sub": email, "user_id": user_id_str})
    return {"access_token": access_token, "token_type": "bearer", "email": email}

# ----------------- SETTINGS & THRESHOLDS -----------------

@app.get("/api/settings/thresholds", response_model=ThresholdConfig)
async def get_thresholds(user: dict = Depends(get_current_user)):
    """Fetches user-specific performance auto-diagnostic thresholds."""
    settings = await db.users.find_one({"_id": ObjectId(user["id"])}, {"settings": 1})
    if settings and "settings" in settings and "thresholds" in settings["settings"]:
        return ThresholdConfig(**settings["settings"]["thresholds"])
    return ThresholdConfig() # return defaults

@app.post("/api/settings/thresholds")
async def update_thresholds(payload: ThresholdConfig, user: dict = Depends(get_current_user)):
    """Updates user-specific performance thresholds."""
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"settings.thresholds": payload.dict()}}
    )
    return {"message": "Settings updated successfully", "thresholds": payload.dict()}

# ----------------- TELEMETRY & DIAGNOSTICS ENDPOINTS -----------------

@app.get("/api/telemetry/live")
def get_live_telemetry(user: dict = Depends(get_current_user)):
    """Fetches real-time environmental Wi-Fi RF telemetry."""
    return tc.collect_telemetry()

@app.get("/api/wifi/scan")
def scan_networks(user: dict = Depends(get_current_user)):
    """Scans and retrieves list of all visible regional Access Points."""
    return tc.scan_nearby_networks()

@app.post("/api/diagnostics/run")
async def trigger_diagnostics(payload: DiagnosticTrigger, user: dict = Depends(get_current_user)):
    """Triggers diagnostic test suite (speed test, latency, DNS, traceroute)."""
    telemetry = tc.collect_telemetry()
    results = ds.execute_diagnostic_suite(custom_anomaly=payload.custom_anomaly)
    
    # Merge live RF telemetry into the diagnostic results to ensure anomaly detection,
    # ML root-cause classification, and frontend views use accurate client-side data.
    results.update(telemetry)
    
    # Fetch historical diagnostic logs for EWMA calculations
    history = []
    async for r in db.diagnostics.find({"user_id": user["id"]}).sort("timestamp", -1).limit(20):
        history.append(r)
    
    # Run anomaly detection
    anomalies = ad.detect_anomalies(results, history)
    
    # Run root cause classifier
    classification = rc.classify_root_cause(results, anomalies)
    
    # Save diagnostic log to MongoDB database
    record = {
        "user_id": user["id"],
        "timestamp": datetime.datetime.utcnow(),
        "ssid": payload.network_ssid,
        "bssid": telemetry.get("bssid"),
        "rssi": telemetry.get("rssi"),
        "snr": telemetry.get("snr"),
        "channel": telemetry.get("channel"),
        "frequency_band": telemetry.get("frequency_band"),
        "download_speed": results["download_speed"],
        "upload_speed": results["upload_speed"],
        "latency": results["latency"],
        "jitter": results["jitter"],
        "packet_loss": results["packet_loss"],
        "dns_time": results["dns_time"],
        "http_probe_success": results["http_probe_success"],
        "anomalies_detected": anomalies,
        "root_cause": classification["root_cause"],
        "confidence": classification["confidence"],
        "user_summary": classification["user_summary"],
        "technical_summary": classification["technical_summary"],
        "traceroute": results["traceroute"]
    }
    
    result = await db.diagnostics.insert_one(record)
    inserted_id = str(result.inserted_id)
    
    return {
        "diagnostic_id": inserted_id,
        "metrics": results,
        "anomalies": anomalies,
        "classification": classification,
        "timestamp": record["timestamp"]
    }

@app.get("/api/diagnostics/history")
async def get_diagnostics_history(user: dict = Depends(get_current_user)):
    """Retrieves history of diagnostic scans for graphs."""
    records = []
    async for r in db.diagnostics.find({"user_id": user["id"]}).sort("timestamp", -1).limit(30):
        records.append(db.helper_id(r))
        
    output = []
    for r in records:
        output.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "ssid": r.get("ssid"),
            "download_speed": r.get("download_speed"),
            "upload_speed": r.get("upload_speed"),
            "latency": r.get("latency"),
            "jitter": r.get("jitter"),
            "packet_loss": r.get("packet_loss"),
            "dns_time": r.get("dns_time"),
            "root_cause": r.get("root_cause"),
            "confidence": r.get("confidence"),
            "user_summary": r.get("user_summary"),
            "anomalies": r.get("anomalies_detected") if r.get("anomalies_detected") is not None else []
        })
    return output

# ----------------- ISP TICKETING SYSTEM ENDPOINTS -----------------

@app.post("/api/tickets")
async def raise_support_ticket(payload: TicketCreateRequest, user: dict = Depends(get_current_user)):
    """Submits a diagnostic payload to auto-create a support ticket."""
    try:
        new_ticket = await te.create_diagnostic_ticket(
            user_id=user["id"],
            diagnostic_id=payload.diagnostic_id,
            user_notes=payload.user_notes
        )
        
        # Closed Loop: Trigger simulated ISP support team reply asynchronously after ticket creation
        asyncio.create_task(simulate_isp_auto_reply(new_ticket["id"]))
        
        return {
            "ticket_id": new_ticket["ticket_id"],
            "status": new_ticket["status"],
            "severity": new_ticket["severity"],
            "created_at": new_ticket["created_at"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    """Lists all support tickets for the authenticated subscriber."""
    tickets = []
    async for t in db.tickets.find({"user_id": user["id"]}).sort("created_at", -1):
        tickets.append(db.helper_id(t))
        
    output = []
    for t in tickets:
        diag = await db.diagnostics.find_one({"_id": ObjectId(t["diagnostic_id"])})
        output.append({
            "ticket_id": t["ticket_id"],
            "status": t["status"],
            "severity": t["severity"],
            "user_notes": t.get("user_notes", ""),
            "created_at": t["created_at"],
            "isp_response": t.get("isp_response"),
            "isp_responded_at": t.get("isp_responded_at"),
            "diagnostic": {
                "root_cause": diag.get("root_cause") if diag else "Unknown",
                "download_speed": diag.get("download_speed") if diag else 0,
                "latency": diag.get("latency") if diag else 0,
                "packet_loss": diag.get("packet_loss") if diag else 0,
                "rssi": diag.get("rssi") if diag else -50
            }
        })
    return output

async def simulate_isp_auto_reply(ticket_db_id: str):
    """Simulates an ISP support response arriving in the background after 8 seconds."""
    await asyncio.sleep(8)
    try:
        ticket = await db.tickets.find_one({"_id": ObjectId(ticket_db_id)})
        if ticket:
            diag = await db.diagnostics.find_one({"_id": ObjectId(ticket["diagnostic_id"])})
            diag_dict = {
                "root_cause": diag.get("root_cause") if diag else "Default",
                "metrics": {
                    "rssi": diag.get("rssi") if diag else -55.0,
                    "packet_loss": diag.get("packet_loss") if diag else 0.0
                }
            }
            # Generate ISP reply details
            reply = sd.generate_isp_response(diag_dict)
            await db.tickets.update_one(
                {"_id": ObjectId(ticket_db_id)},
                {
                    "$set": {
                        "isp_response": reply["isp_response"],
                        "status": "Resolved",
                        "isp_responded_at": datetime.datetime.utcnow(),
                        "updated_at": datetime.datetime.utcnow()
                    }
                }
            )
            print(f"[ISP Simulator] Auto-reply posted for Ticket {ticket['ticket_id']}")
    except Exception as e:
        print(f"[ISP Simulator] Error posting response: {e}")

# ----------------- REAL-TIME LIVE DASHBOARD (WEBSOCKETS) -----------------

# Cache for real speed measurements to avoid constant bandwidth usage
_speed_cache = {"download": 0.0, "upload": 0.0, "timestamp": 0}
SPEED_CACHE_TTL = 60  # seconds — re-measure every 60s

def _measure_real_speed():
    """
    Measures real download/upload throughput using Cloudflare CDN endpoints.
    Works identically on macOS, Windows, and Linux (standard HTTP requests).
    Returns (download_mbps, upload_mbps).
    """
    import time as _time
    download_mbps = 0.0
    upload_mbps = 0.0
    
    # Download test: fetch ~5MB chunk from Cloudflare CDN
    try:
        import requests as _req
        dl_start = _time.time()
        dl_res = _req.get("https://speed.cloudflare.com/__down?bytes=5000000", timeout=10.0)
        dl_elapsed = _time.time() - dl_start
        if dl_res.ok and dl_elapsed > 0:
            download_mbps = round((len(dl_res.content) * 8.0) / (dl_elapsed * 1_000_000.0), 1)
    except Exception:
        pass
    
    # Upload test: send ~1MB payload to Cloudflare CDN
    try:
        import requests as _req
        upload_payload = b'0' * 1_000_000  # 1MB
        ul_start = _time.time()
        ul_res = _req.post("https://speed.cloudflare.com/__up", data=upload_payload, timeout=10.0)
        ul_elapsed = _time.time() - ul_start
        if ul_res.ok and ul_elapsed > 0:
            upload_mbps = round((len(upload_payload) * 8.0) / (ul_elapsed * 1_000_000.0), 1)
    except Exception:
        pass
    
    return download_mbps, upload_mbps

# Global flag to prevent concurrent background speed tests
_speed_test_running = False

async def _bg_speed_test_worker():
    """Asynchronous background worker that updates the global speed cache."""
    global _speed_cache, _speed_test_running
    _speed_test_running = True
    try:
        # Run synchronous measurement in a thread pool to avoid blocking the event loop
        loop = asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            dl, ul = await loop.run_in_executor(pool, _measure_real_speed)
        
        if dl > 0:
            _speed_cache["download"] = dl
            _speed_cache["upload"] = ul
            _speed_cache["timestamp"] = import_time_module()
            print(f"[Speed Worker] Updated speed cache: DL {dl} Mbps, UL {ul} Mbps")
    except Exception as e:
        print(f"[Speed Worker] Background speed test failed: {e}")
    finally:
        _speed_test_running = False

@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """Streams live connection telemetry to the active dashboard every 3 seconds."""
    global _speed_cache, _speed_test_running
    await manager.connect(websocket)
    try:
        while True:
            # Check if cache is expired and no background test is currently running
            current_time = import_time_module()
            if (current_time - _speed_cache["timestamp"] > SPEED_CACHE_TTL) and not _speed_test_running:
                # Trigger the speed test asynchronously in the background
                asyncio.create_task(_bg_speed_test_worker())

            # Run telemetry + quick probe in executor to avoid blocking event loop
            import concurrent.futures
            loop = asyncio.get_event_loop()
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                telemetry_future = loop.run_in_executor(executor, tc.collect_telemetry)
                probe_future = loop.run_in_executor(executor, ds.quick_probe)
                
                telemetry = await telemetry_future
                probe = await probe_future
            
            # Calculate a health score dynamically for real-time widgets
            rssi = telemetry["rssi"]
            snr = telemetry["snr"]
            latency = probe["latency"]
            packet_loss = probe["packet_loss"]
            jitter = probe["jitter"]
            
            # Health score: weighted composite of signal + latency + packet loss
            signal_score = max(0, min(100, int((rssi + 100) * 1.4)))
            latency_score = max(0, min(100, int(100 - min(100, latency) * 0.8)))
            loss_score = max(0, min(100, int(100 - packet_loss * 5)))
            health_score = max(0, min(100, int(signal_score * 0.35 + latency_score * 0.35 + loss_score * 0.2 + snr * 0.3)))
            
            # Use real measured speed if available, otherwise heuristic fallback
            if _speed_cache["download"] > 0:
                est_download = _speed_cache["download"]
                est_upload = _speed_cache["upload"]
            else:
                # Heuristic fallback only if real measurement hasn't completed yet
                factor = max(0.05, 1.0 - (packet_loss / 100.0) - (min(100.0, latency) / 200.0))
                est_download = round(350.0 * factor * (0.93 + (signal_score / 1000.0)), 1)
                est_upload = round(50.0 * factor * (0.93 + (signal_score / 1000.0)), 1)
            
            payload = {
                "telemetry": telemetry,
                "health_score": health_score,
                "live_metrics": {
                    "download_speed": est_download,
                    "upload_speed": est_upload,
                    "latency": latency,
                    "jitter": jitter,
                    "packet_loss": packet_loss,
                    "dns_time": probe["dns_time"],
                    "http_ok": probe["http_ok"]
                },
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
            
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

def import_time_module():
    """Returns current unix timestamp. Isolated for testability."""
    import time as _t
    return _t.time()
