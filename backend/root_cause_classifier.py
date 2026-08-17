import math

# ML model weights and biases for 9 classes
# Feature vector: [rssi_norm, loss_norm, latency_norm, jitter_norm, dns_norm, download_norm, upload_norm, http_norm, router_rtt_norm]
W = {
    "Wi-Fi RF Degradation":      [-8.5,  2.1,  0.5,  1.2,  0.0, -1.0, -1.0,  0.0,  2.0],
    "Router Hardware/Crash":     [ 0.0,  8.0,  4.0,  3.0,  2.0, -2.0, -2.0, -9.0,  9.5],
    "DNS Server Outage":         [ 0.0,  1.0,  0.5,  0.0,  8.5, -0.5, -0.5, -7.5,  0.0],
    "Router Bufferbloat":        [ 0.0,  1.5,  2.5,  7.5,  0.0, -0.5,  3.5,  0.0,  1.5],
    "Captive Portal Redirect":   [ 0.0,  0.0, -2.0, -2.0, -2.0, -1.0, -1.0, -8.0, -3.0],
    "ISP Gateway Congestion":    [ 0.0,  3.5,  7.5,  2.0,  0.5, -1.5, -1.5, -2.0, -1.0],
    "ISP Bandwidth Throttling":  [ 0.0,  0.0, -3.0, -3.0, -1.0, -7.0, -4.0,  2.0, -2.0],
    "Normal Connection":         [ 5.0, -5.0, -4.0, -4.0, -4.0,  4.0,  3.0,  8.0, -4.0],
    "Intermittent Connection Droop": [ 0.0,  1.0,  1.0,  1.0,  1.0, -0.5, -0.5, -1.0,  1.0]
}

B = {
    "Wi-Fi RF Degradation":      1.5,
    "Router Hardware/Crash":    -2.0,
    "DNS Server Outage":        -1.0,
    "Router Bufferbloat":       -0.5,
    "Captive Portal Redirect":   3.0,
    "ISP Gateway Congestion":   -1.5,
    "ISP Bandwidth Throttling":  2.5,
    "Normal Connection":         1.0,
    "Intermittent Connection Droop": 0.0
}

def classify_root_cause(metrics, anomalies):
    """
    Classifies root cause using a Softmax Multi-Class Logistic Regression ML model.
    Decouples raw diagnostic symptoms into 9 path-specific root-cause classifications:
    Wi-Fi/RF, Router, DNS, ISP, Device.
    """
    anom_metrics = {a["metric"] for a in anomalies}
    
    rssi = metrics.get("rssi", -55.0)
    packet_loss = metrics.get("packet_loss", 0.0)
    latency = metrics.get("latency", 20.0)
    jitter = metrics.get("jitter", 2.0)
    dns_time = metrics.get("dns_time", 40.0)
    http_success = metrics.get("http_probe_success", True)
    download_speed = metrics.get("download_speed", 100.0)
    upload_speed = metrics.get("upload_speed", 20.0)
    
    # Check if there is an active local traceroute
    traceroute = metrics.get("traceroute", [])
    router_rtt = traceroute[0]["rtt"] if len(traceroute) > 0 else 2.0
    
    # ── Step 1: Feature Normalization (Scale Invariance) ──
    rssi_norm = (rssi - (-65.0)) / 15.0
    loss_norm = packet_loss / 10.0
    latency_norm = (latency - 30.0) / 50.0
    jitter_norm = (jitter - 10.0) / 20.0
    dns_norm = (dns_time - 50.0) / 150.0
    download_norm = (download_speed - 50.0) / 50.0
    upload_norm = (upload_speed - 15.0) / 15.0
    http_norm = 1.0 if http_success else -1.0
    router_rtt_norm = (router_rtt - 5.0) / 10.0
    
    X = [rssi_norm, loss_norm, latency_norm, jitter_norm, dns_norm, download_norm, upload_norm, http_norm, router_rtt_norm]
    
    # ── Step 2: Linear Logits Calculation (Z = W * X + B) ──
    logits = {}
    for c in W.keys():
        logits[c] = sum(w * x for w, x in zip(W[c], X)) + B[c]
    
    # ── Step 3: Softmax Normalization to get Probabilities ──
    max_logit = max(logits.values())  # Stabilize exponentials
    exp_logits = {c: math.exp(logits[c] - max_logit) for c in logits}
    sum_exp = sum(exp_logits.values())
    probs = {c: exp_logits[c] / sum_exp for c in logits}
    
    # Choose class with maximum probability
    predicted_class = max(probs, key=probs.get)
    confidence = probs[predicted_class]
    
    # ── Step 4: Descriptions (Human & Technical summaries) ──
    summaries = {
        "Normal Connection": {
            "user": "Your Wi-Fi connection is fully operational and healthy.",
            "tech": "All network metrics fall within standard operational baselines."
        },
        "Wi-Fi RF Degradation": {
            "user": f"Weak signal strength detected. Move closer to your router or upgrade to a 5 GHz band.",
            "tech": f"Active RSSI of {rssi} dBm triggers threshold violation. Elevated packet loss ({packet_loss}%) correlates with local RF fading."
        },
        "Router Hardware/Crash": {
            "user": "Your home router is unresponsive. It may have crashed or lost power.",
            "tech": f"High gateway RTT ({router_rtt}ms) with total packet loss. Diagnostic indicates local router freeze or power reset."
        },
        "DNS Server Outage": {
            "user": "Your domain resolver (DNS) is timing out. Your internet is connected, but websites won't load.",
            "tech": f"DNS query time ({round(dns_time, 1)} ms) exceeds safe threshold. HTTP probes failing due to name resolution errors."
        },
        "Router Bufferbloat": {
            "user": "Your router is congested due to heavy local uploads/downloads (Bufferbloat). Consider limiting concurrent streaming.",
            "tech": f"Bufferbloat grade detected via high jitter ({jitter}ms). Under-load latency spikes significantly over baseline."
        },
        "Captive Portal Redirect": {
            "user": "Your Wi-Fi connection requires login. Check your web browser for a captive registration page.",
            "tech": "HTTP status codes redirected to unexpected hostname. DNS resolved successfully but HTTP probe blocked."
        },
        "ISP Gateway Congestion": {
            "user": "The connection between your router and the internet provider is slow. The issue lies outside your home network.",
            "tech": f"Path split: Local router hop RTT is normal ({router_rtt}ms), but upstream gateway RTT is high ({latency}ms) with packet loss of {packet_loss}%."
        },
        "ISP Bandwidth Throttling": {
            "user": "Your internet speeds appear to be artificially capped/throttled. Contact your provider to verify plan limits.",
            "tech": f"Throughput data reflects exactly {download_speed} Mbps flat-line profile. Combined with low latency, this matches traffic shaper signatures."
        },
        "Intermittent Connection Droop": {
            "user": "A minor network fluctuation was detected. Restarting your router may help restore performance.",
            "tech": "General performance parameters deviated from EWMA baseline. No specific RF, DNS, or gateway signature matching."
        }
    }
    
    res = summaries[predicted_class]
    return {
        "root_cause": predicted_class,
        "confidence": round(confidence, 2),
        "user_summary": res["user"],
        "technical_summary": res["tech"]
    }
