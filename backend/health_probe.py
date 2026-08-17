import asyncio
import time
from datetime import datetime
try:
    import database as db
    import telemetry_collector as tc
    import diagnostic_suite as ds
except ModuleNotFoundError:
    import backend.database as db
    import backend.telemetry_collector as tc
    import backend.diagnostic_suite as ds

# Lightweight background monitoring probe configuration
PROBE_INTERVAL = 30 # seconds

# Static fallback thresholds if DB is unavailable
LATENCY_THRESHOLD = 150.0 # ms
LOSS_THRESHOLD = 5.0     # %
JITTER_THRESHOLD = 50.0  # ms

async def run_network_health_probe():
    """
    Continuous background loop that performs fast, low-footprint ping
    and DNS lookups to track connection stability.
    If metrics degrade below custom thresholds, it automatically triggers a
    deep Multi-threaded Speed Test + Diagnostic Run.
    """
    print("[Health Probe] Starting Background Network Probe Service...")
    last_diagnostic_time = 0
    
    while True:
        try:
            # 1. Fetch latest dynamic thresholds from DB (use first real user or fallback)
            active_user = await db.users.find_one({"is_google_user": {"$exists": True}})
            if not active_user:
                active_user = await db.users.find_one({})
                
            thresholds = {
                "max_latency": LATENCY_THRESHOLD,
                "max_packet_loss": LOSS_THRESHOLD,
                "max_jitter": JITTER_THRESHOLD,
                "http_failure": True,
                "enable_auto_diagnostics": True
            }
            if active_user and "settings" in active_user and "thresholds" in active_user["settings"]:
                thresholds.update(active_user["settings"]["thresholds"])
                
            if not thresholds["enable_auto_diagnostics"]:
                await asyncio.sleep(PROBE_INTERVAL)
                continue

            # 2. Lightweight ping & HTTP status checks
            ping_stats = ds.run_ping_test(count=3)
            http_stats = ds.run_http_probe()
            
            latency = ping_stats["avg_latency"]
            loss = ping_stats["packet_loss"]
            jitter = ping_stats.get("jitter", 0.0)
            http_ok = http_stats["success"]
            
            degraded = (
                latency > thresholds["max_latency"] or 
                loss > thresholds["max_packet_loss"] or 
                jitter > thresholds["max_jitter"] or 
                (thresholds["http_failure"] and not http_ok)
            )
            
            current_time = time.time()
            cooldown = 300 # 5 minutes cooldown between auto-diagnostics
            
            if degraded and (current_time - last_diagnostic_time > cooldown):
                print(f"[Health Probe] Anomaly Detected (Latency: {latency}ms, Loss: {loss}%, Jitter: {jitter}ms). Running Auto-Diagnostic...")
                last_diagnostic_time = current_time
                
                # Retrieve Telemetry & execute deep suite
                telemetry = tc.collect_telemetry()
                results = ds.execute_diagnostic_suite()
                
                # Save auto-diagnostics to database under System user (user_id="system_user")
                try:
                    from anomaly_detector import detect_anomalies
                    from root_cause_classifier import classify_root_cause
                except ModuleNotFoundError:
                    from backend.anomaly_detector import detect_anomalies
                    from backend.root_cause_classifier import classify_root_cause
                
                # Fetch past diagnostics for "system_user" to calculate EWMA
                past_runs = []
                async for r in db.diagnostics.find({"user_id": "system_user"}).sort("timestamp", -1).limit(20):
                    past_runs.append(r)
                    
                anomalies = detect_anomalies(results, past_runs)
                classification = classify_root_cause(results, anomalies)
                
                diag_record = {
                    "user_id": "system_user",
                    "timestamp": datetime.utcnow(),
                    "ssid": telemetry.get("ssid"),
                    "bssid": telemetry.get("bssid"),
                    "rssi": telemetry.get("rssi"),
                    "snr": telemetry.get("snr"),
                    "channel": telemetry.get("channel"),
                    "frequency_band": telemetry.get("frequency_band"),
                    "download_speed": results.get("download_speed"),
                    "upload_speed": results.get("upload_speed"),
                    "latency": results.get("latency"),
                    "jitter": results.get("jitter"),
                    "packet_loss": results.get("packet_loss"),
                    "dns_time": results.get("dns_time"),
                    "http_probe_success": results.get("http_probe_success"),
                    "anomalies_detected": anomalies,
                    "root_cause": classification.get("root_cause"),
                    "confidence": classification.get("confidence"),
                    "user_summary": classification.get("user_summary"),
                    "technical_summary": classification.get("technical_summary"),
                    "traceroute": results.get("traceroute", [])
                }
                
                await db.diagnostics.insert_one(diag_record)
                print("[Health Probe] Deep Diagnostic Record Saved Successfully.")
                
        except Exception as e:
            print(f"[Health Probe] Error during probe loop: {e}")
            
        await asyncio.sleep(PROBE_INTERVAL)
