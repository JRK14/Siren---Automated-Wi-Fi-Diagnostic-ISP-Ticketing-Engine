import numpy as np

class EWMAAnomalyDetector:
    """
    Exponentially Weighted Moving Average (EWMA) to establish household baseline
    and flag deviations.
    """
    def __init__(self, alpha=0.2):
        self.alpha = alpha
        self.means = {}
        self.vars = {}

    def update_baseline(self, metric_name, value):
        """Updates mean and variance baselines with new diagnostic metrics."""
        if metric_name not in self.means:
            self.means[metric_name] = value
            self.vars[metric_name] = 0.0
            return

        old_mean = self.means[metric_name]
        # Update mean
        self.means[metric_name] = (1 - self.alpha) * old_mean + self.alpha * value
        # Update variance
        diff = value - old_mean
        old_var = self.vars[metric_name]
        self.vars[metric_name] = (1 - self.alpha) * old_var + self.alpha * (diff ** 2)

    def get_z_score(self, metric_name, value):
        """Returns standard z-score relative to the baseline."""
        if metric_name not in self.means:
            return 0.0
        
        mean = self.means[metric_name]
        std = np.sqrt(self.vars[metric_name]) if metric_name in self.vars else 0.0
        
        if std < 0.01:
            return 0.0
            
        return (value - mean) / std

def detect_anomalies(current_metrics, history_records, threshold_config=None):
    """
    11-signal anomaly taxonomy per PDF specification.
    Performs EWMA + z-score + static threshold checks.
    Returns list of active anomalies.
    
    Anomaly Types:
    1. Weak signal (RSSI)
    2. High latency / packet loss
    3. DNS latency / failure
    4. Bufferbloat / jitter
    5. Channel congestion
    6. Roaming / mesh handoff failure
    7. Asymmetric up/down latency
    8. ISP throttling pattern
    9. DHCP lease failure
    10. Captive portal / no real internet
    11. Router crash / uptime reset
    """
    detector = EWMAAnomalyDetector(alpha=0.15)
    
    # Establish baseline from past 20 records
    metrics_to_track = ["latency", "jitter", "packet_loss", "download_speed", "upload_speed"]
    for record in history_records[-20:]:
        if isinstance(record, dict):
            for m in metrics_to_track:
                val = record.get(m)
                if val is not None:
                    detector.update_baseline(m, val)
        else:
            for m in metrics_to_track:
                val = getattr(record, m, None)
                if val is not None:
                    detector.update_baseline(m, val)
                
    anomalies = []
    
    # Standard static thresholds (fallbacks)
    thresholds = {
        "max_latency": 100.0,
        "max_jitter": 20.0,
        "max_packet_loss": 3.0,
        "min_download": 30.0,
        "min_upload": 5.0,
        "max_dns_time": 400.0,
        "min_rssi": -78.0
    }
    
    if threshold_config:
        thresholds.update(threshold_config)

    # === 1. Weak Signal (RSSI) ===
    rssi = current_metrics.get("rssi", -55.0)
    if rssi < thresholds["min_rssi"]:
        anomalies.append({
            "metric": "rssi",
            "type": "weak_signal",
            "value": rssi,
            "threshold": thresholds["min_rssi"],
            "severity": "HIGH" if rssi < -85 else "MEDIUM",
            "description": f"Weak Wi-Fi signal strength ({rssi} dBm)"
        })

    # === 2. High Latency / Packet Loss ===
    lat = current_metrics.get("latency", 20.0)
    lat_z = detector.get_z_score("latency", lat)
    if lat > thresholds["max_latency"] or lat_z > 3.0:
        anomalies.append({
            "metric": "latency",
            "type": "high_latency",
            "value": lat,
            "z_score": round(lat_z, 2),
            "threshold": thresholds["max_latency"],
            "severity": "HIGH" if lat > 150 or lat_z > 5.0 else "MEDIUM",
            "description": f"Elevated network latency ({round(lat, 1)} ms)"
        })

    loss = current_metrics.get("packet_loss", 0.0)
    if loss > thresholds["max_packet_loss"]:
        anomalies.append({
            "metric": "packet_loss",
            "type": "high_packet_loss",
            "value": loss,
            "threshold": thresholds["max_packet_loss"],
            "severity": "CRITICAL" if loss > 10.0 else "HIGH",
            "description": f"Significant packet loss detected ({round(loss, 1)}%)"
        })

    # === 3. DNS Latency / Failure ===
    dns = current_metrics.get("dns_time", 50.0)
    if dns > thresholds["max_dns_time"] or not current_metrics.get("http_probe_success", True):
        anomalies.append({
            "metric": "dns_time",
            "type": "dns_failure",
            "value": dns,
            "threshold": thresholds["max_dns_time"],
            "severity": "HIGH" if dns > 1000.0 else "MEDIUM",
            "description": f"DNS resolution timeout or failure ({round(dns, 1)} ms)"
        })

    # === 4. Bufferbloat / Jitter ===
    jit = current_metrics.get("jitter", 2.0)
    jit_z = detector.get_z_score("jitter", jit)
    if jit > thresholds["max_jitter"] or jit_z > 3.0:
        anomalies.append({
            "metric": "jitter",
            "type": "high_jitter",
            "value": jit,
            "threshold": thresholds["max_jitter"],
            "severity": "MEDIUM",
            "description": f"High packet jitter ({round(jit, 1)} ms)"
        })

    bloat = current_metrics.get("bufferbloat", {})
    if bloat.get("grade") in ["D", "F"]:
        anomalies.append({
            "metric": "bufferbloat",
            "type": "bufferbloat",
            "value": bloat.get("grade"),
            "severity": "HIGH" if bloat.get("grade") == "F" else "MEDIUM",
            "description": f"Severe bufferbloat under load (Grade {bloat.get('grade')})"
        })

    # === 5. Channel Congestion ===
    noise = current_metrics.get("noise", -90.0)
    snr = current_metrics.get("snr", 30.0)
    channel = current_metrics.get("channel", 36)
    freq_band = current_metrics.get("frequency_band", "5 GHz")
    # High noise floor + low SNR + 2.4 GHz crowded channels (1, 6, 11)
    if snr < 15.0 or (noise > -80.0 and freq_band == "2.4 GHz"):
        anomalies.append({
            "metric": "channel_congestion",
            "type": "channel_congestion",
            "value": snr,
            "severity": "MEDIUM" if snr > 10.0 else "HIGH",
            "description": f"Channel congestion detected — SNR {round(snr, 1)} dB on channel {channel} ({freq_band})"
        })

    # === 6. Roaming / Mesh Handoff Failure ===
    # Detected by BSSID change combined with sudden RSSI drop or latency spike
    bssid = current_metrics.get("bssid", "")
    if rssi < -75.0 and lat > 80.0 and jit > 15.0:
        # Likely a roaming event causing intermittent connectivity
        anomalies.append({
            "metric": "roaming",
            "type": "roaming_handoff",
            "value": rssi,
            "severity": "MEDIUM",
            "description": f"Possible roaming/mesh handoff failure — RSSI {rssi} dBm with high latency ({round(lat, 1)} ms)"
        })

    # === 7. Asymmetric Up/Down Latency ===
    bloat_data = current_metrics.get("bufferbloat", {})
    up_lat = bloat_data.get("up_latency", lat)
    down_lat = bloat_data.get("down_latency", lat)
    if abs(up_lat - down_lat) > 40.0:
        higher = "upload" if up_lat > down_lat else "download"
        anomalies.append({
            "metric": "asymmetric_latency",
            "type": "asymmetric_latency",
            "value": round(abs(up_lat - down_lat), 1),
            "severity": "MEDIUM",
            "description": f"Asymmetric {higher} latency — up: {round(up_lat, 1)} ms, down: {round(down_lat, 1)} ms"
        })

    # === 8. ISP Throttling Pattern ===
    down = current_metrics.get("download_speed", 100.0)
    up = current_metrics.get("upload_speed", 20.0)
    baseline_speed = detector.means.get("download_speed", 150.0)
    # Normal latency but sharply capped speed suggests throttling
    if down < 15.0 and lat < 30.0 and loss < 2.0:
        anomalies.append({
            "metric": "throttling",
            "type": "isp_throttling",
            "value": down,
            "severity": "HIGH",
            "description": f"ISP throttling suspected — speed capped at {round(down, 1)} Mbps with normal latency ({round(lat, 1)} ms)"
        })

    # === 9. DHCP Lease Failure ===
    # Detected when device has IP but no real connectivity (all probes fail)
    http_ok = current_metrics.get("http_probe_success", True)
    if not http_ok and loss >= 100.0:
        anomalies.append({
            "metric": "dhcp",
            "type": "dhcp_failure",
            "value": loss,
            "severity": "CRITICAL",
            "description": "DHCP lease failure — device has no valid network configuration"
        })

    # === 10. Captive Portal / No Real Internet ===
    if not http_ok and lat < 30.0 and dns < 200.0:
        anomalies.append({
            "metric": "captive_portal",
            "type": "captive_portal",
            "value": 0,
            "severity": "MEDIUM",
            "description": "Captive portal detected — HTTP probe redirected or blocked despite connectivity"
        })

    # === 11. Router Crash / Uptime Reset ===
    traceroute = current_metrics.get("traceroute", [])
    router_rtt = traceroute[0]["rtt"] if len(traceroute) > 0 and traceroute[0].get("rtt", -1) >= 0 else 2.0
    if router_rtt > 500.0 or (not http_ok and router_rtt > 200.0):
        anomalies.append({
            "metric": "router_crash",
            "type": "router_crash",
            "value": router_rtt,
            "severity": "CRITICAL",
            "description": f"Router crash/reset suspected — gateway RTT {round(router_rtt, 1)} ms"
        })

    # Throughput degradation (general)
    down_z = detector.get_z_score("download_speed", down)
    if down < thresholds["min_download"] or (down < baseline_speed * 0.4 and baseline_speed > 50.0):
        # Only add if not already covered by throttling
        if not any(a["type"] == "isp_throttling" for a in anomalies):
            anomalies.append({
                "metric": "download_speed",
                "type": "speed_degradation",
                "value": down,
                "baseline": round(baseline_speed, 1),
                "severity": "HIGH" if down < 10.0 else "MEDIUM",
                "description": f"Severe speed drop ({round(down, 1)} Mbps, baseline: {round(baseline_speed, 1)} Mbps)"
            })

    return anomalies
