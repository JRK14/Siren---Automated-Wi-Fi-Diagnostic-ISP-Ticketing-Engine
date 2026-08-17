import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, CheckCircle, Ticket, AlertOctagon } from 'lucide-react';

export default function RaiseTicketPage({ latestDiagnostic, onTicketCreated }) {
  const [userNotes, setUserNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState(null);
  const [error, setError] = useState('');

  // Clear states when diagnostic changes
  useEffect(() => {
    setSuccessTicket(null);
    setError('');
  }, [latestDiagnostic]);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!latestDiagnostic?.diagnostic_id) {
      setError('No diagnostic telemetry found. Please run a WiFi analysis first.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const data = await api.raiseTicket(latestDiagnostic.diagnostic_id, userNotes);
      setSuccessTicket(data);
      setUserNotes('');
      if (onTicketCreated) {
        onTicketCreated();
      }
    } catch (err) {
      setError(err.message || 'Ticket creation aborted.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadgeColor = (sev) => {
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'rgba(239, 68, 68, 0.15)';
    return 'rgba(245, 158, 11, 0.15)';
  };

  const getSeverityTextColor = (sev) => {
    if (sev === 'CRITICAL' || sev === 'HIGH') return 'var(--state-danger)';
    return 'var(--state-warning)';
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Raise Diagnostic Ticket</h2>

      {successTicket ? (
        <div className="glass-panel" style={styles.successCard}>
          <CheckCircle size={48} color="var(--state-success)" />
          <h3 style={styles.successTitle}>Ticket Ingested Successfully</h3>
          <p style={styles.successText}>
            Ticket ID <span style={styles.successHighlight}>{successTicket.ticket_id}</span> has been transmitted to your ISP Service Desk API gateway.
          </p>
          <div style={styles.successDetails}>
            <div style={styles.detailRow}>
              <span>Ingestion Status</span>
              <span style={{ color: 'var(--state-success)', fontWeight: '700' }}>{successTicket.status}</span>
            </div>
            <div style={styles.detailRow}>
              <span>Severity Level</span>
              <span style={{ 
                color: getSeverityTextColor(successTicket.severity), 
                fontWeight: '700' 
              }}>{successTicket.severity}</span>
            </div>
          </div>
          <span style={styles.successSub}>A background agent has subscribed to status notifications. Check Ticket History tab for live updates.</span>
        </div>
      ) : (
        <div style={styles.formGrid}>
          {/* Ticket Ingestion Submission Form */}
          <form onSubmit={handleSubmitTicket} className="glass-panel" style={styles.formCard}>
            <div style={styles.formHeader}>
              <Ticket size={20} color="var(--accent-cyan)" />
              <h3 style={styles.formTitle}>Submit Telemetry to ISP Support</h3>
            </div>

            {error && <div style={styles.errorText}>{error}</div>}

            <div style={styles.inputGroup}>
              <label style={styles.label}>Subscriber Troubleshooting Notes / Symptoms</label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Describe your current browsing issues (e.g. video call buffering, gaming latency, dropping connection)..."
                style={styles.textarea}
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !latestDiagnostic} 
              style={{
                ...styles.submitBtn,
                opacity: !latestDiagnostic ? 0.5 : 1
              }}
            >
              {loading ? 'Submitting to ServiceNow...' : 'Package & Transmit Support Ticket'}
            </button>
            
            {!latestDiagnostic && (
              <span style={styles.warnText}>* Run a Wi-Fi analysis before submitting a ticket.</span>
            )}
          </form>

          {/* Diagnostic Auto-Payload details */}
          <div className="glass-panel" style={styles.payloadCard}>
            <h3 style={styles.payloadTitle}>Auto-Generated Ticket Payload</h3>
            
            {latestDiagnostic ? (
              <div style={styles.payloadDetails}>
                <div style={styles.payloadRow}>
                  <span>Root Cause AI Classification</span>
                  <span style={{fontWeight: '700', color: 'var(--accent-cyan)'}}>
                    {latestDiagnostic.classification?.root_cause}
                  </span>
                </div>
                <div style={styles.payloadRow}>
                  <span>Confidence Rating</span>
                  <span>{Math.round(latestDiagnostic.classification?.confidence * 100)}%</span>
                </div>
                <div style={styles.payloadRow}>
                  <span>Signal Level</span>
                  <span>{latestDiagnostic.metrics?.rssi || -55} dBm</span>
                </div>
                <div style={styles.payloadRow}>
                  <span>Packet Loss Rate</span>
                  <span>{latestDiagnostic.metrics?.packet_loss || 0}%</span>
                </div>
                <div style={styles.payloadRow}>
                  <span>Average Ping</span>
                  <span>{latestDiagnostic.metrics?.latency || 15} ms</span>
                </div>
                
                <div style={styles.explWrapper}>
                  <h4 style={styles.explLabel}>ISP Technical Ingestion Payload Description</h4>
                  <p style={styles.explText}>{latestDiagnostic.classification?.technical_summary}</p>
                </div>
              </div>
            ) : (
              <div style={styles.emptyPayload}>
                <AlertOctagon size={32} color="var(--text-muted)" />
                <p>No active diagnostic results available to bundle.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '24px',
  },
  formCard: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: '700',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  textarea: {
    padding: '12px',
    backgroundColor: 'rgba(10, 12, 26, 0.5)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
  },
  submitBtn: {
    padding: '14px',
    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    fontWeight: '700',
    fontSize: '15px',
    boxShadow: 'var(--glow-cyan)',
  },
  warnText: {
    fontSize: '12px',
    color: 'var(--state-warning)',
    textAlign: 'center',
  },
  errorText: {
    padding: '10px',
    border: '1px solid var(--state-danger)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    color: 'var(--state-danger)',
    borderRadius: '6px',
    fontSize: '13px',
  },
  payloadCard: {
    padding: '24px',
  },
  payloadTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '10px',
  },
  payloadDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  payloadRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  explWrapper: {
    marginTop: '15px',
    backgroundColor: 'rgba(255,255,255,0.01)',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--border-glass)',
  },
  explLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  explText: {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.4',
    color: 'var(--text-secondary)',
  },
  emptyPayload: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '50px 0',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  successCard: {
    padding: '50px 30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '15px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: '700',
  },
  successText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  successHighlight: {
    color: 'var(--accent-cyan)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  successDetails: {
    width: '100%',
    maxWidth: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid var(--border-glass)',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  successSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  }
};
