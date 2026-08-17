import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ClipboardList, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export default function TicketHistoryPage({ refreshTrigger }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const data = await api.getTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [refreshTrigger]);

  const getStatusColor = (status) => {
    if (status === 'Resolved') return 'var(--state-success)';
    if (status === 'In Progress') return 'var(--state-warning)';
    return 'var(--accent-cyan)';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Ticket History</h2>
        <button onClick={fetchTickets} style={styles.refreshBtn}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={styles.loader}>Fetching support tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="glass-panel" style={styles.emptyState}>
          <ClipboardList size={48} color="var(--text-muted)" />
          <h3 style={styles.emptyTitle}>No Active Tickets</h3>
          <p style={styles.emptyText}>You haven't submitted any diagnostic telemetry cases to support yet.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {tickets.map((t) => (
            <div key={t.ticket_id} className="glass-panel" style={styles.card}>
              {/* Ticket identifier header */}
              <div style={styles.cardHeader}>
                <div style={styles.leftCardHead}>
                  <span style={styles.ticketId}>{t.ticket_id}</span>
                  <span style={{
                    ...styles.statusBadge,
                    borderColor: getStatusColor(t.status),
                    color: getStatusColor(t.status)
                  }}>
                    {t.status}
                  </span>
                  <span style={styles.severityBadge}>{t.severity} Severity</span>
                </div>
                <span style={styles.date}>
                  {new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Ticket payload details */}
              <div style={styles.cardContent}>
                <div style={styles.contentSection}>
                  <h4 style={styles.sectionLabel}>Subscriber Notes</h4>
                  <p style={styles.notesText}>{t.user_notes || 'No description notes provided.'}</p>
                </div>

                <div style={styles.contentSection}>
                  <h4 style={styles.sectionLabel}>Diagnostic Telemetry Overview</h4>
                  <div style={styles.metricsBar}>
                    <span>Root Cause: <strong>{t.diagnostic?.root_cause}</strong></span>
                    <span>RSSI: <strong>{t.diagnostic?.rssi} dBm</strong></span>
                    <span>Loss: <strong>{t.diagnostic?.packet_loss}%</strong></span>
                    <span>Ping: <strong>{t.diagnostic?.latency} ms</strong></span>
                  </div>
                </div>

                {/* ISP loop response rendering */}
                {t.isp_response ? (
                  <div style={styles.ispSection}>
                    <div style={styles.ispHeader}>
                      <CheckCircle size={16} color="var(--state-success)" />
                      <h4 style={styles.ispTitle}>ISP Support Desk Response</h4>
                    </div>
                    <p style={styles.ispText}>{t.isp_response}</p>
                    {t.isp_responded_at && (
                      <span style={styles.ispDate}>
                        Responded at: {new Date(t.isp_responded_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={styles.ispWaiting}>
                    <RefreshCw size={14} className="spinner" />
                    <span>Waiting for automated ISP diagnostic review & agent reply (approx. 8s)...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-glass)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '600',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    padding: '24px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '14px',
    marginBottom: '16px',
  },
  leftCardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ticketId: {
    fontSize: '16px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    border: '1px solid',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  severityBadge: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  date: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  contentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sectionLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  notesText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  metricsBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px 25px',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border-glass)',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  ispSection: {
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    padding: '16px',
    borderRadius: '8px',
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  ispHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ispTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--state-success)',
  },
  ispText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
  },
  ispDate: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    alignSelf: 'flex-end',
  },
  ispWaiting: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px',
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  loader: {
    fontSize: '15px',
    color: 'var(--accent-cyan)',
    textAlign: 'center',
    padding: '50px 0',
  },
  emptyState: {
    padding: '50px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    maxWidth: '300px',
  }
};
