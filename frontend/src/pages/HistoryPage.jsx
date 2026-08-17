import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Calendar, Filter, Activity, Server } from 'lucide-react';

export default function HistoryPage({ refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCause, setFilterCause] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory();
        // Reverse arrays so oldest is first in charts, but newest is first in tables
        setHistory(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [refreshTrigger]);

  const uniqueCauses = ['all', ...new Set(history.map(item => item.root_cause).filter(Boolean))];

  const filteredHistory = filterCause === 'all'
    ? history
    : history.filter(item => item.root_cause === filterCause);

  // Prepare data for line chart (sorted chronologically)
  const chartData = [...filteredHistory]
    .reverse()
    .map(item => ({
      name: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      download: item.download_speed,
      upload: item.upload_speed,
      latency: item.latency,
      loss: item.packet_loss
    }));

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Analysis History</h2>

      {/* Filter Options */}
      <div className="glass-panel" style={styles.filterCard}>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <Filter size={16} color="var(--text-secondary)" />
            <span style={styles.filterLabel}>Filter Root Cause</span>
            <select
              value={filterCause}
              onChange={(e) => setFilterCause(e.target.value)}
              style={styles.select}
            >
              {uniqueCauses.map(cause => (
                <option key={cause} value={cause}>
                  {cause.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loader}>Loading histories...</div>
      ) : history.length === 0 ? (
        <div className="glass-panel" style={styles.emptyState}>
          <Activity size={48} color="var(--text-muted)" />
          <h3 style={styles.emptyTitle}>No Scans Available</h3>
          <p style={styles.emptyText}>Run your first diagnostic to start tracking connection trends.</p>
        </div>
      ) : (
        <div style={styles.content}>
          {/* Recharts Performance Over Time */}
          <div className="glass-panel" style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Throughput Speeds Over Time</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} unit="M" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="download" stroke="var(--accent-cyan)" fillOpacity={1} fill="url(#colorDown)" name="Download Speed" />
                  <Area type="monotone" dataKey="upload" stroke="var(--accent-purple)" fillOpacity={1} fill="url(#colorUp)" name="Upload Speed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency & Packet loss Trends */}
          <div className="glass-panel" style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Latency and Packet Loss Trends</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} unit="ms" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="latency" stroke="var(--state-success)" name="Ping Latency" strokeWidth={2} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="loss" stroke="var(--state-danger)" name="Packet Loss %" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History log lists table */}
          <div className="glass-panel" style={styles.tableCard}>
            <h3 style={styles.tableTitle}>Diagnostic Logs</h3>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={styles.th}>Timestamp</th>
                    <th style={styles.th}>SSID</th>
                    <th style={styles.th}>Down Speed</th>
                    <th style={styles.th}>Latency</th>
                    <th style={styles.th}>Loss %</th>
                    <th style={styles.th}>Root Cause</th>
                    <th style={styles.th}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id} style={styles.row}>
                      <td style={styles.td}>
                        {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={styles.td}>{item.ssid}</td>
                      <td style={styles.td}>{item.download_speed} Mbps</td>
                      <td style={styles.td}>{item.latency} ms</td>
                      <td style={{
                        ...styles.td,
                        color: item.packet_loss > 0 ? 'var(--state-danger)' : 'var(--text-primary)'
                      }}>{item.packet_loss}%</td>
                      <td style={styles.td}>{item.root_cause}</td>
                      <td style={styles.td}>{Math.round(item.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  filterCard: {
    padding: '16px 24px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  filterLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  select: {
    padding: '8px 12px',
    backgroundColor: 'rgba(10, 12, 26, 0.5)',
    border: '1px solid var(--border-glass)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  chartCard: {
    padding: '24px',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '20px',
  },
  tableCard: {
    padding: '24px',
  },
  tableTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '20px',
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  headerRow: {
    borderBottom: '1px solid var(--border-glass)',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  row: {
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.01)',
    }
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
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
