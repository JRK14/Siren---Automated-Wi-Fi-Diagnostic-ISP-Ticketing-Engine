import random
import datetime

# Predefined ISP agent response templates based on root causes
RESPONSE_TEMPLATES = {
    "Wi-Fi RF Degradation": [
        "We've analyzed your telemetry. The physical signal level to your device is low (-{rssi} dBm). We recommend changing your router's wireless channel to a less congested band (e.g. channel 36 for 5GHz). If signal remains weak, please move closer or contact us to discuss Wi-Fi extenders.",
        "Your signal level is currently running low. We checked the status of the local node, and the link to your fiber gateway is stable. This indicates local home interference or wall blockage. Try relocating your router to a higher, central position."
    ],
    "DNS Server Outage": [
        "DNS resolution latency verified. We have updated your router's configuration to use secondary backup DNS endpoints (8.8.8.8 and 1.1.1.1). Please restart your modem/router to apply the configuration. This should resolve website accessibility immediately.",
        "A temporary upstream DNS routing node outage was detected in your area. Routing paths have been updated to bypass the faulty hop. Connection status should be fully restored."
    ],
    "Router Bufferbloat": [
        "Our telemetry shows high latency spikes coinciding with local upstream saturation. We have activated Smart Queue Management (SQM) QoS profiles on your account line to prevent buffer overload. Please reboot your router to sync speed profiles."
    ],
    "ISP Gateway Congestion": [
        "We confirm that an upstream gateway router in your distribution segment is currently operating under high capacity load, causing {loss}% packet loss. Engineering has scheduled link optimization adjustments. We expect normal speeds to be restored within 2 hours.",
        "A line degradation anomaly was registered on your local neighborhood distribution node. A field technician has been dispatched to check the cabinets. No home visit required."
    ],
    "ISP Bandwidth Throttling": [
        "We have reviewed your subscription profile. Your account has exceeded its high-speed usage allowance, resulting in an automated bandwidth cap of 10 Mbps. High-speed data caps will reset on your billing cycle date. You can purchase additional data packs inside your billing portal.",
        "We noticed a mismatch in your router's speed profile configuration. The cap has been cleared, and your full plan speed has been restored. Please run another diagnostic to verify your download throughput."
    ],
    "Router Hardware/Crash": [
        "The diagnostic telemetry indicates your local fiber gateway went offline or suffered a hard crash. We have initialized a remote hardware reboot on your gateway. If internet access does not restore in 5 minutes, please unplug the power cable, wait 30 seconds, and plug it back in."
    ],
    "Default": [
        "Thank you for raising a ticket. We ran automated tests on your line and confirmed the link from our central office to your gateway is up. We have flushed your DNS lease on our end. Please restart your device and let us know if speed issues persist."
    ]
}

def generate_isp_response(ticket):
    """
    Simulates a closed-loop ISP Service Desk support team reply.
    Pulls diagnostic metrics, determines the appropriate response template,
    and returns a realistic ticket resolution message.
    """
    root_cause = ticket.get("root_cause", "Default")
    metrics = ticket.get("metrics", {})
    
    rssi = abs(metrics.get("rssi", -80))
    loss = metrics.get("packet_loss", 5.0)
    
    templates = RESPONSE_TEMPLATES.get(root_cause, RESPONSE_TEMPLATES["Default"])
    selected_template = random.choice(templates)
    
    # Formats variables inside templates
    response_text = selected_template.format(rssi=rssi, loss=loss)
    
    return {
        "isp_response": response_text,
        "status": "Resolved",
        "responded_at": datetime.datetime.utcnow().isoformat()
    }
