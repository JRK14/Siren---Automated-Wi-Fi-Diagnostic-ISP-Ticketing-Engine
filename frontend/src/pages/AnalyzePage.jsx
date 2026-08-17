import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Play, 
  RefreshCw, 
  Wifi, 
  HelpCircle, 
  ShieldAlert, 
  CheckCircle,
  TrendingUp,
  GitBranch,
  Radio,
  Lock,
  Eye,
  Activity
} from 'lucide-react';

export default function AnalyzePage({ liveTelemetry, onDiagnosticComplete }) {
  const [targetSsid, setTargetSsid] = useState('');
  const [anomalyType, setAnomalyType] = useState('none');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [scannedNetworks, setScannedNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);

  // Scan local networks on mount
  useEffect(() => {
    handleScanNetworks();
  }, []);

  // Sync active scanned network SSID from background telemetry
  useEffect(() => {
    if (liveTelemetry?.ssid) {
      setTargetSsid(liveTelemetry.ssid);
    }
  }, [liveTelemetry]);

  const handleScanNetworks = async () => {
    setScanning(true);
    try {
      const data = await api.scanWifi();
      setScannedNetworks(data);
      // Auto-select current connected network if it exists in the scanned list
      const current = data.find(n => n.ssid === liveTelemetry?.ssid);
      if (current) {
        setSelectedNetwork(current);
      }
    } catch (err) {
      console.error("Scanning error:", err);
    } finally {
      setScanning(false);
    }
  };

  const selectScannedNetwork = (network) => {
    setSelectedNetwork(network);
    setTargetSsid(network.ssid);
  };

  const stages = [
    'Scanning local RF parameters & channels...',
    'Probing ICMP gateway ping & packet loss...',
    'Testing DNS query response time...',
    'Measuring downstream / upstream throughput (Cloudflare Speed Test)...',
    'Assessing queue latency under load (Bufferbloat)...',
    'Executing traceroute hop-by-hop split...',
    'Evaluating anomalies & classifier root-cause...'
  ];

  const handleStartAnalysis = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    
    // Simulate diagnostic engine step progression for rich UX
    for (let i = 0; i < stages.length; i++) {
      setStage(stages[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const data = await api.runDiagnostics(
        targetSsid || 'Unknown_WiFi', 
        anomalyType === 'none' ? null : anomalyType
      );
      setResults(data);
      if (onDiagnosticComplete) {
        onDiagnosticComplete(data);
      }
    } catch (err) {
      setError(err.message || 'Diagnostic collection failed.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev) => {
    if (sev === 'CRITICAL') return 'var(--state-danger)';
    if (sev === 'HIGH') return 'var(--state-danger)';
    if (sev === 'MEDIUM') return 'var(--state-warning)';
    return 'var(--state-success)';
  };

  // Convert RSSI to signal strength percentage
  const getSignalPct = (rssi) => {
    return Math.max(0, Math.min(100, Math.round((rssi + 100) * 1.6)));
  };

  const getSignalColor = (rssi) => {
    if (rssi > -67) return 'var(--state-success)';
    if (rssi > -80) return 'var(--state-warning)';
    return 'var(--state-danger)';
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.pageTitle}>Analyse WiFi Connection</h2>
        <button 
          onClick={handleScanNetworks} 
          disabled={scanning} 
          style={styles.scanBtn}
        >
          <RefreshCw size={14} className={scanning ? "spinner" : ""} />
          {scanning ? 'Scanning Region...' : 'Scan Nearby Networks'}
        </button>
      </div>

      {/* Main Split Interface: Left - Scanner, Right - Diagnostics */}
      <div style={styles.mainSplit}>
        {/* Scanned Access Points List */}
        <div className="glass-panel" style={styles.scannerPanel}>
          <div style={styles.panelHeader}>
            <Radio size={16} color="var(--accent-cyan)" />
            <h3 style={styles.panelTitle}>Regional Wi-Fi Access Points</h3>
          </div>
          
          <div style={styles.networkList}>
            {scanning ? (
              <div style={styles.loader}>Searching active frequencies...</div>
            ) : scannedNetworks.length === 0 ? (
              <div style={styles.emptyText}>No regional networks discovered. Click Scan to search.</div>
            ) : (
              scannedNetworks.map((net) => {
                const isSelected = selectedNetwork?.bssid === net.bssid;
                const isCurrent = liveTelemetry?.ssid === net.ssid;
                const signalColor = getSignalColor(net.rssi);
                return (
                  <div
                    key={net.bssid}
                    onClick={() => selectScannedNetwork(net)}
                    style={{
                      ...styles.networkRow,
                      borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-glass)',
                      backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)'
                    }}
                  >
                    <div style={styles.netInfoMain}>
                      <div style={styles.netTitleBlock}>
                        <span style={styles.netSsid}>{net.ssid}</span>
                        {isCurrent && <span style={styles.currentBadge}>CONNECTED</span>}
                      </div>
                      <span style={styles.netBssid}>{net.bssid} • Ch {net.channel} ({net.frequency_band})</span>
                    </div>
                    
                    <div style={styles.netMetricsBlock}>
                      <span style={{ ...styles.netRssi, color: signalColor }}>{net.rssi} dBm</span>
                      <div style={styles.signalMeterContainer}>
                        <div style={{
                          ...styles.signalMeterFill,
                          width: `${getSignalPct(net.rssi)}%`,
                          backgroundColor: signalColor
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Network Monitor & Diagnostics Controls */}
        <div style={styles.diagControlsColumn}>
          {selectedNetwork && (
            <div className="glass-panel" style={styles.monitorCard}>
              <div style={styles.panelHeader}>
                <Eye size={16} color="var(--accent-cyan)" />
                <h3 style={styles.panelTitle}>Passive RF Monitor</h3>
              </div>
              <p style={styles.monitorSub}>Passive environmental scan without password authentication.</p>
              
              <div style={styles.monitorGrid}>
                <div style={styles.monitorItem}>
                  <span style={styles.monitorLabel}>SSID Target</span>
                  <span style={styles.monitorValue}>{selectedNetwork.ssid}</span>
                </div>
                <div style={styles.monitorItem}>
                  <span style={styles.monitorLabel}>Passive RSSI</span>
                  <span style={{ ...styles.monitorValue, color: getSignalColor(selectedNetwork.rssi) }}>
                    {selectedNetwork.rssi} dBm
                  </span>
                </div>
                <div style={styles.monitorItem}>
                  <span style={styles.monitorLabel}>Frequency Channel</span>
                  <span style={styles.monitorValue}>Channel {selectedNetwork.channel} ({selectedNetwork.frequency_band})</span>
                </div>
                <div style={styles.monitorItem}>
                  <span style={styles.monitorLabel}>Security Protocol</span>
                  <span style={styles.monitorValue}>{selectedNetwork.security}</span>
                </div>
              </div>
            </div>
          )}

          {/* Control Panel */}
          <div className="glass-panel" style={styles.controlsPanel}>
            <div style={styles.controlRow}>
              <div style={styles.controlGroup}>
                <label style={styles.label}>Target SSID</label>
                <input 
                  type="text" 
                  value={targetSsid}
                  onChange={(e) => setTargetSsid(e.target.value)}
                  placeholder="Select from left list or type manually"
                  style={styles.input}
                  disabled={loading}
                />
              </div>

              <div style={styles.controlGroup}>
                <label style={styles.label}>Simulated Network Condition (Evaluation Mode)</label>
                <select
                  value={anomalyType}
                  onChange={(e) => setAnomalyType(e.target.value)}
                  style={styles.select}
                  disabled={loading}
                >
                  <option value="none">Normal (Healthy Connection)</option>
                  <option value="weak_signal">Weak Signal (Low RSSI)</option>
                  <option value="high_latency">High Latency / Jitter</option>
                  <option value="dns_failure">DNS Server Outage</option>
                  <option value="bufferbloat">Router Bufferbloat (High Load)</option>
                  <option value="throttling">ISP Speed Throttling (10 Mbps Cap)</option>
                </select>
              </div>

              <button 
                onClick={handleStartAnalysis} 
                disabled={loading} 
                style={{
                  ...styles.runBtn,
                  backgroundColor: loading ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-cyan)'
                }}
              >
                {loading ? <RefreshCw className="spinner" size={16} /> : <Play size={16} />}
                {loading ? 'Analyzing...' : 'Run Diagnostics'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress View */}
      {loading && (
        <div className="glass-panel animate-pulse-glow" style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <Activity size={20} color="var(--accent-cyan)" className="pulse" />
            <h3 style={styles.progressTitle}>Diagnostic Engine Active</h3>
          </div>
          <span style={styles.stageText}>{stage}</span>
          <div style={styles.progressBar}>
            <div style={styles.progressFill} />
          </div>
        </div>
      )}

      {error && <div className="glass-panel" style={styles.errorCard}>{error}</div>}

      {/* Diagnostic Results Render */}
      {results && (
        <div style={styles.resultsGrid}>
          {/* Classification & Root Cause summary */}
          <div className="glass-panel" style={styles.summaryCard}>
            <div style={styles.summaryHeader}>
              <HelpCircle size={20} color="var(--accent-cyan)" />
              <h3 style={styles.summaryTitle}>AI Root Cause Classification</h3>
            </div>
            
            <div style={styles.causeBanner}>
              <span style={styles.causeLabel}>Primary Classification</span>
              <span style={{
                ...styles.causeValue,
                color: results.classification.root_cause.includes('Normal') ? 'var(--state-success)' : 'var(--state-warning)'
              }}>{results.classification.root_cause}</span>
              
              <div style={styles.confidenceRow}>
                <span style={styles.confidenceLabel}>Confidence Score</span>
                <span style={styles.confidenceVal}>{Math.round(results.classification.confidence * 100)}%</span>
              </div>
              <div style={styles.confidenceBar}>
                <div style={{
                  ...styles.confidenceFill, 
                  width: `${results.classification.confidence * 100}%`,
                  backgroundColor: results.classification.confidence > 0.8 ? 'var(--state-success)' : 'var(--state-warning)'
                }} />
              </div>
            </div>

            <div style={styles.explanationSection}>
              <h4 style={styles.explTitle}>User Resolution Summary</h4>
              <p style={styles.explText}>{results.classification.user_summary}</p>
            </div>

            <div style={styles.explanationSection}>
              <h4 style={styles.explTitle}>Telemetry Signature Log</h4>
              <p style={styles.explTechText}>{results.classification.technical_summary}</p>
            </div>
          </div>

          {/* Deep Metrics details */}
          <div style={styles.metricsCol}>
            <div className="glass-panel" style={styles.metricsCard}>
              <h3 style={styles.sectionTitle}>Performance Metric Log</h3>
              <div style={styles.metricsList}>
                <div style={styles.metricRow}>
                  <span>Throughput (Down / Up)</span>
                  <span style={styles.metricValText}>
                    {results.metrics.download_speed} / {results.metrics.upload_speed} Mbps
                  </span>
                </div>
                <div style={styles.metricRow}>
                  <span>Gateway Latency</span>
                  <span style={styles.metricValText}>{results.metrics.latency} ms</span>
                </div>
                <div style={styles.metricRow}>
                  <span>DNS Query Duration</span>
                  <span style={styles.metricValText}>{results.metrics.dns_time} ms</span>
                </div>
                <div style={styles.metricRow}>
                  <span>Packet Jitter</span>
                  <span style={styles.metricValText}>{results.metrics.jitter} ms</span>
                </div>
                <div style={styles.metricRow}>
                  <span>Packet Loss Rate</span>
                  <span style={{
                    ...styles.metricValText,
                    color: results.metrics.packet_loss > 1 ? 'var(--state-danger)' : 'var(--text-primary)'
                  }}>{results.metrics.packet_loss}%</span>
                </div>
                <div style={styles.metricRow}>
                  <span>Bufferbloat Rating</span>
                  <span style={styles.metricValText}>
                    Grade {results.metrics.bufferbloat?.grade || 'A'} (Down: {results.metrics.bufferbloat?.down_latency}ms)
                  </span>
                </div>
              </div>
            </div>

            {/* Traceroute diagram */}
            <div className="glass-panel" style={styles.traceCard}>
              <div style={styles.traceHeader}>
                <GitBranch size={16} color="var(--accent-cyan)" />
                <h3 style={styles.traceTitle}>Network Path Split Traceroute</h3>
              </div>
              <div style={styles.tracePath}>
                {results.metrics.traceroute?.map((hop, index) => (
                  <div key={hop.hop} style={styles.hopRow}>
                    <div style={styles.hopIndex}>{hop.hop}</div>
                    <div style={styles.hopDetails}>
                      <span style={styles.hopHost}>{hop.host}</span>
                      <span style={styles.hopIp}>{hop.ip}</span>
                    </div>
                    <div style={styles.hopRtt}>{hop.rtt} ms</div>
                    {index < results.metrics.traceroute.length - 1 && (
                      <div style={styles.pathLine} />
                    )}
                  </div>
                ))}
              </div>
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
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
  },
  scanBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    padding: '8px 16px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  mainSplit: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  scannerPanel: {
    padding: '20px',
    minHeight: '350px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '12px',
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: '700',
  },
  networkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  networkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  netInfoMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  netTitleBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  netSsid: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  currentBadge: {
    fontSize: '8px',
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: 'var(--state-success)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  netBssid: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  netMetricsBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
  },
  netRssi: {
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  signalMeterContainer: {
    width: '50px',
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  signalMeterFill: {
    height: '100%',
    borderRadius: '2px',
  },
  diagControlsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  monitorCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  monitorSub: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '-8px',
  },
  monitorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
  },
  monitorItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  monitorLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  monitorValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  controlsPanel: {
    padding: '24px',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '20px',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  input: {
    padding: '12px',
    backgroundColor: 'rgba(10, 12, 26, 0.5)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  select: {
    padding: '12px',
    backgroundColor: 'rgba(10, 12, 26, 0.5)',
    border: '1px solid var(--border-glass)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  runBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    fontWeight: '700',
    fontSize: '14px',
    boxShadow: 'var(--glow-cyan)',
    height: '46px',
    cursor: 'pointer',
  },
  progressCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  progressTitle: {
    fontSize: '15px',
    fontWeight: '700',
  },
  stageText: {
    fontSize: '14px',
    color: 'var(--accent-cyan)',
    fontWeight: '500',
  },
  progressBar: {
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '2px',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '60%',
    background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
    animation: 'loadingProgress 2s infinite ease-in-out',
  },
  errorCard: {
    padding: '15px',
    border: '1px solid var(--state-danger)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    color: 'var(--state-danger)',
    borderRadius: '8px',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: '450px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  summaryCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: '700',
  },
  causeBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  causeLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  causeValue: {
    fontSize: '18px',
    fontWeight: '700',
  },
  confidenceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '10px',
  },
  confidenceBar: {
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
  },
  explanationSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  explTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  explText: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'var(--text-primary)',
  },
  explTechText: {
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.5',
    color: 'var(--text-secondary)',
  },
  metricsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  metricsCard: {
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '16px',
  },
  metricsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border-glass)',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  traceCard: {
    padding: '24px',
  },
  traceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  traceTitle: {
    fontSize: '15px',
    fontWeight: '700',
  },
  tracePath: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
    paddingLeft: '10px',
  },
  hopRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  hopIndex: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid var(--accent-cyan)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    marginRight: '15px',
    zIndex: 2,
  },
  hopDetails: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  hopHost: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  hopIp: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  hopRtt: {
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
  },
  pathLine: {
    position: 'absolute',
    left: '12px',
    top: '24px',
    bottom: '-24px',
    width: '1px',
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    zIndex: 1,
  },
  loader: {
    padding: '30px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  emptyText: {
    padding: '30px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
  }
};
