// API routing configuration dynamically targeting production Render or local environments
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws');

export const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Authentication endpoints
  signup: async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Signup failed');
    }
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  googleLogin: async (idToken) => {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Google Login failed');
    }
    return res.json();
  },

  // Diagnostics endpoints
  getLiveTelemetry: async () => {
    const res = await fetch(`${API_URL}/api/telemetry/live`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch live telemetry');
    return res.json();
  },

  scanWifi: async () => {
    const res = await fetch(`${API_URL}/api/wifi/scan`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to scan regional networks');
    return res.json();
  },

  runDiagnostics: async (ssid, anomalyType = null) => {
    const res = await fetch(`${API_URL}/api/diagnostics/run`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ network_ssid: ssid, custom_anomaly: anomalyType }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Diagnostic execution failed');
    }
    return res.json();
  },

  getHistory: async () => {
    const res = await fetch(`${API_URL}/api/diagnostics/history`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch history logs');
    return res.json();
  },

  // Ticketing endpoints
  raiseTicket: async (diagnosticId, userNotes = '') => {
    const res = await fetch(`${API_URL}/api/tickets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ diagnostic_id: diagnosticId, user_notes: userNotes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to submit ticket');
    }
    return res.json();
  },

  getTickets: async () => {
    const res = await fetch(`${API_URL}/api/tickets`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retrieve ticket list');
    return res.json();
  },

  // WebSocket Live telemetry connection
  getTelemetrySocket: () => {
    return new WebSocket(`${WS_URL}/ws/telemetry`);
  }
};
