# SirenWiFi — Automated Wi-Fi Diagnostic & ISP Ticketing Engine

An automated, cross-platform Wi-Fi diagnostics & ticketing engine that continuously monitors active network health, automatically triggers downstream/upstream throughput and latency tests upon detecting RF degradation or anomalies, and packages telemetry into standardized diagnostic tickets.

## Features

- **Background Network Health Probe**: Lightweight asyncio monitoring loop measuring latency, packet loss, DNS resolution times, and HTTP probe success rates.
- **Automated Diagnostic & Speed Test Suite**: Real-time throughput tests via Ookla Speedtest-cli / Cloudflare CDN fallbacks, bufferbloat checking, and detailed traceroutes automatically executed on threshold breach.
- **Telemetry & Environmental Data Collector**: Gathers native RF statistics (RSSI, SNR, channel, frequency band, BSSID), client OS network events, and anonymizes user credentials. Supports macOS (CoreWLAN), Windows (netsh), and Linux (iw/iwconfig).
- **Automated Ticket Ingestion Engine**: Packages diagnostic state into REST/JSON ticketing structures and auto-creates tickets with simulated ISP support replies.
- **Cross-Platform UI**: Sleek, glassmorphism React Vite dashboard supporting live telemetry charts, collapsible hamburger menus, customizable triggers via a Settings panel, and ticketing history.

---

## Architecture & Project Structure

```
Parallax/
├── backend/
│   ├── main.py                  # FastAPI App Entrypoint & WebSockets
│   ├── database.py              # MongoDB Connection & Collections
│   ├── telemetry_collector.py   # OS-specific Wi-Fi RF telemetry collector
│   ├── diagnostic_suite.py      # Ping, DNS, Traceroute, & Cloudflare speed tests
│   ├── health_probe.py          # Background health monitor loop
│   ├── ticket_engine.py         # Standardized diagnostic ticket generator
│   └── requirements.txt         # Backend Python dependencies
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx      # Slide-out hamburger navigation
    │   │   └── SettingsModal.jsx# Threshold adjustment sliders
    │   ├── pages/
    │   │   ├── DashboardPage.jsx# Live charts & telemetry panel
    │   │   └── LoginPage.jsx    # Authentication & Google login
    │   └── services/
    │       └── api.js           # API request routing configuration
    ├── package.json             # Frontend Javascript dependencies
    └── index.html               # Frontend root HTML & Error bounds
```

---

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB instance (Atlas cluster or local connection)

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file inside the `backend/` directory:
   ```env
   MONGODB_URI=your_mongodb_connection_uri
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   SECRET_KEY=your_jwt_signing_secret_key
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite local server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:5173`.

---

## Deployment (Render)

### Backend Web Service
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**: Add `MONGODB_URI`, `GOOGLE_CLIENT_ID`, and `SECRET_KEY`.

### Frontend Static Site
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**: Add `VITE_API_URL` targeting your deployed backend web service.
