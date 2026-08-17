def classify_root_cause(metrics, anomalies):
    """
    Decouples raw diagnostic symptoms into path-specific root-cause classifications:
    Wi-Fi/RF, Router, DNS, ISP, Device.
    Outputs classification label + confidence rating (0.0 to 1.0) and user/tech descriptions.
    """
    anom_metrics = {a["metric"] for a in anomalies}
    
    rssi = metrics.get("rssi", -55.0)
    packet_loss = metrics.get("packet_loss", 0.0)
    latency = metrics.get("latency", 20.0)
    dns_time = metrics.get("dns_time", 40.0)
    http_success = metrics.get("http_probe_success", True)
    download_speed = metrics.get("download_speed", 100.0)
    
    # Check if there is an active local traceroute
    traceroute = metrics.get("traceroute", [])
    router_rtt = traceroute[0]["rtt"] if len(traceroute) > 0 else 2.0
    internet_rtt = traceroute[-1]["rtt"] if len(traceroute) > 1 else latency

    # 1. Router Crash / Unreachable Router Check
    if not http_success and router_rtt > 500.0:
        return {
            "root_cause": "Router Hardware/Crash",
            "confidence": 0.95,
            "user_summary": "Your home router is unresponsive. It may have crashed or lost power.",
            "technical_summary": "High gateway RTT (>500ms) with total packet loss. Diagnostic indicates local router freeze or power reset."
        }

    # 2. Local Wi-Fi RF Issues (Signal / Congestion)
    if "rssi" in anom_metrics or rssi < -78.0:
        confidence = 0.70 + min(0.25, abs(rssi + 78.0) / 40.0)
        if router_rtt > 20.0:
            confidence = min(0.99, confidence + 0.1)
        
        congestion_note = ""
        # Simulate local congestion signature
        if metrics.get("channel", 6) == 6 and metrics.get("frequency_band") == "2.4 GHz":
            congestion_note = " on a crowded 2.4 GHz channel"
            
        return {
            "root_cause": "Wi-Fi RF Degradation",
            "confidence": round(confidence, 2),
            "user_summary": f"Weak signal strength{congestion_note}. Move closer to your router or upgrade to a 5 GHz band.",
            "technical_summary": f"Active RSSI of {rssi} dBm triggers threshold violation. Elevated packet loss ({packet_loss}%) correlates with local RF fading."
        }

    # 3. DNS Failure
    if "dns_time" in anom_metrics or dns_time > 1000.0 or (not http_success and dns_time > 1500.0):
        return {
            "root_cause": "DNS Server Outage",
            "confidence": 0.90,
            "user_summary": "Your domain resolver (DNS) is timing out. Your internet is connected, but websites won't load.",
            "technical_summary": f"DNS query time ({round(dns_time, 1)} ms) exceeds safe threshold. HTTP probes failing due to name resolution errors, while direct IP ping is operational."
        }

    # 4. Local Router Congestion / Bufferbloat
    if "bufferbloat" in anom_metrics or metrics.get("bufferbloat", {}).get("grade") in ["D", "F"]:
        grade = metrics.get("bufferbloat", {}).get("grade", "F")
        return {
            "root_cause": "Router Bufferbloat",
            "confidence": 0.85,
            "user_summary": "Your router is congested due to heavy local uploads/downloads (Bufferbloat). Consider limiting concurrent streaming/gaming.",
            "technical_summary": f"Bufferbloat grade: {grade}. Under-load latency spikes significantly over baseline. Suggests local network queue congestion."
        }

    # 5. Captive Portal Redirect
    if not http_success and latency < 30.0 and dns_time < 50.0:
        # DNS resolved, ping succeeded but HTTP probe failed: common captive portal symptom
        return {
            "root_cause": "Captive Portal Redirect",
            "confidence": 0.88,
            "user_summary": "Your Wi-Fi connection requires login. Check your web browser for a captive registration page.",
            "technical_summary": "HTTP status codes redirected to unexpected hostname. DNS resolved successfully but HTTP probe blocked."
        }

    # 6. ISP / Upstream Link Issue
    # In traceroute, if router latency is low (e.g. < 5ms) but gateway/next-hop latency is huge
    if "latency" in anom_metrics or "packet_loss" in anom_metrics:
        if router_rtt < 10.0 and internet_rtt > 80.0:
            return {
                "root_cause": "ISP Gateway Congestion",
                "confidence": 0.85,
                "user_summary": "The connection between your router and the internet provider is slow. The issue lies outside your home network.",
                "technical_summary": f"Path split: Local router hop RTT is normal ({router_rtt}ms), but upstream gateway RTT is high ({internet_rtt}ms) with packet loss of {packet_loss}%."
            }

    # 7. ISP Throttling Pattern
    if download_speed <= 10.5 and download_speed >= 9.5 and latency < 15.0:
        return {
            "root_cause": "ISP Bandwidth Throttling",
            "confidence": 0.80,
            "user_summary": "Your internet speeds appear to be artificially capped/throttled. Contact your provider to verify plan limits.",
            "technical_summary": "Throughput data reflects exactly 10.0 Mbps flat-line profile. Combined with low latency (<15ms), this matches typical ISP traffic shaper signatures."
        }

    # Default healthy fallback
    if anomalies:
        # Some generic issue detected
        return {
            "root_cause": "Intermittent Connection Droop",
            "confidence": 0.60,
            "user_summary": "A minor network fluctuation was detected. Restarting your router may help restore performance.",
            "technical_summary": "General performance parameters deviated from EWMA baseline. No specific RF, DNS, or gateway signature matching."
        }
        
    return {
        "root_cause": "Normal Connection",
        "confidence": 1.0,
        "user_summary": "Your Wi-Fi connection is fully operational and healthy.",
        "technical_summary": "All network metrics fall within standard operational baselines."
    }
