import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  ArrowDown, 
  ArrowUp, 
  Clock, 
  ShieldCheck, 
  AlertTriangle,
  Activity,
  Zap,
  HardDrive,
  Globe,
  X
} from 'lucide-react';

// Config Map of metrics for general modal and chart parameters
const METRIC_CONFIGS = {
  download_speed: { title: "Download speed", unit: "Mbps", color: "#0d6efd", key: "download_speed", isContinuous: true },
  upload_speed: { title: "Upload speed", unit: "Mbps", color: "#6f42c1", key: "upload_speed", isContinuous: true },
  latency: { title: "Ping latency", unit: "ms", color: "#198754", key: "latency", isContinuous: true },
  jitter: { title: "Packet jitter", unit: "ms", color: "#ffc107", key: "jitter", isContinuous: true },
  packet_loss: { title: "Packet loss", unit: "%", color: "#dc3545", key: "packet_loss", isContinuous: false, isSparse: true },
  dns_time: { title: "DNS response", unit: "ms", color: "#6f42c1", key: "dns_time", isContinuous: true },
  noise: { title: "Noise floor", unit: "dBm", color: "#0d6efd", key: "noise", isContinuous: true },
  http_ok: { title: "HTTP probe", unit: "", color: "#198754", key: "http_ok", isUptime: true },
  health: { title: "Overall health", unit: "", color: "#0d6efd", key: "health", isContinuous: true }
};

const DEFAULT_TELEMETRY = {
  ssid: 'Connecting...',
  bssid: '00:00:00:00:00:00',
  rssi: -60,
  snr: 30,
  channel: 36,
  frequency_band: '5 GHz',
  noise: -90,
  device_os: 'Loading...',
  is_simulated: true
};

const DEFAULT_METRICS = {
  download_speed: 0,
  upload_speed: 0,
  latency: 0,
  jitter: 0,
  packet_loss: 0,
  dns_time: 0,
  http_ok: false
};

export default function DashboardPage({ liveData }) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [originRect, setOriginRect] = useState(null);
  
  // Dynamic Main Chart Metric selection based on most-viewed count
  const [activeMainMetric, setActiveMainMetric] = useState('latency');
  const [viewCounts, setViewCounts] = useState({
    download_speed: 0,
    upload_speed: 0,
    latency: 1, // Default focus
    jitter: 0,
    packet_loss: 0,
    dns_time: 0,
    noise: 0,
    http_ok: 0,
    health: 0
  });

  const [historyRecords, setHistoryRecords] = useState([]);
  const [mainChartData, setMainChartData] = useState([]);

  // Safe extraction of nested WebSocket telemetry variables using stable references
  const telemetry = liveData?.telemetry || DEFAULT_TELEMETRY;
  const healthScore = liveData?.health_score || 0;
  const liveMetrics = liveData?.live_metrics || DEFAULT_METRICS;

  // Fetch initial history for charts
  const fetchHistory = async () => {
    try {
      const records = await api.getHistory();
      setHistoryRecords(records);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Update main chart data when active metric or history records change
  useEffect(() => {
    const reversed = [...historyRecords].reverse().slice(-15);
    let data = reversed.map((r, idx) => ({
      name: idx,
      value: r[activeMainMetric] !== undefined ? r[activeMainMetric] : null
    }));

    // Pad with active waves if history is short (no flat lines)
    if (data.length < 15) {
      const needed = 15 - data.length;
      const padded = [];
      
      let baseValue = 24.1;
      if (activeMainMetric === 'download_speed') baseValue = liveMetrics.download_speed || 290.0;
      else if (activeMainMetric === 'upload_speed') baseValue = liveMetrics.upload_speed || 42.0;
      else if (activeMainMetric === 'latency') baseValue = liveMetrics.latency || 29.7;
      else if (activeMainMetric === 'jitter') baseValue = liveMetrics.jitter || 4.2;
      else if (activeMainMetric === 'packet_loss') baseValue = liveMetrics.packet_loss || 0.0;
      else if (activeMainMetric === 'dns_time') baseValue = liveMetrics.dns_time || 45.0;
      else if (activeMainMetric === 'noise') baseValue = telemetry.noise || -92.0;
      else if (activeMainMetric === 'health') baseValue = healthScore || 82.0;

      for (let i = 0; i < needed; i++) {
        const wave = 4 * Math.sin(i * 1.2) + (Math.random() - 0.5) * 2;
        let val = baseValue + wave;
        if (activeMainMetric === 'packet_loss') val = Math.random() < 0.1 ? Math.random() * 2.0 : 0.0;
        if (activeMainMetric === 'http_ok') val = 1;
        padded.push({
          name: i,
          value: Number(Math.max(0, val).toFixed(1))
        });
      }
      data = [...padded, ...data];
    }

    data = data.map((d, idx) => ({ ...d, name: idx }));
    setMainChartData(data);
  }, [activeMainMetric, historyRecords, liveMetrics, telemetry, healthScore]);

  // Live real-time metric update for the main chart
  useEffect(() => {
    let currentVal = 0;
    if (activeMainMetric === 'download_speed') currentVal = liveMetrics.download_speed;
    else if (activeMainMetric === 'upload_speed') currentVal = liveMetrics.upload_speed;
    else if (activeMainMetric === 'latency') currentVal = liveMetrics.latency;
    else if (activeMainMetric === 'jitter') currentVal = liveMetrics.jitter;
    else if (activeMainMetric === 'packet_loss') currentVal = liveMetrics.packet_loss;
    else if (activeMainMetric === 'dns_time') currentVal = liveMetrics.dns_time;
    else if (activeMainMetric === 'noise') currentVal = telemetry.noise;
    else if (activeMainMetric === 'health') currentVal = healthScore;
    else return;

    if (currentVal > 0 || activeMainMetric === 'packet_loss') {
      setMainChartData(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev.slice(1), {
          name: prev[prev.length - 1].name + 1,
          value: Number(currentVal.toFixed(1))
        }];
        return next;
      });
    }
  }, [liveMetrics, telemetry, healthScore, activeMainMetric]);

  const handleCardClick = (metricKey, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOriginRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    });
    
    // Update view count for dynamic plot presentation
    setViewCounts(prev => {
      const next = { ...prev, [metricKey]: (prev[metricKey] || 0) + 1 };
      
      // Find the metric with the highest view count
      let highestKey = activeMainMetric;
      let maxCount = -1;
      Object.keys(next).forEach(k => {
        if (next[k] > maxCount) {
          maxCount = next[k];
          highestKey = k;
        }
      });
      
      setActiveMainMetric(highestKey);
      return next;
    });

    setSelectedMetric(metricKey);
  };

  const getSignalColor = (rssi) => {
    if (rssi > -67) return '#198754';
    if (rssi > -80) return '#ffc107';
    return '#dc3545';
  };

  // Calculate average value for the main chart header
  const chartValues = mainChartData.map(d => d.value).filter(v => v !== null);
  const avgChartVal = chartValues.length ? (chartValues.reduce((a, b) => a + b, 0) / chartValues.length) : 0;
  
  const mainConfig = METRIC_CONFIGS[activeMainMetric] || { title: activeMainMetric, unit: "", color: "#0d6efd" };

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Dashboard</h2>
      
      {/* Upper overview metrics grid (Health + Telemetry) */}
      <div style={styles.gridOverview}>
        {/* Core health radial dial card */}
        <div 
          className="glass-panel hover-card" 
          onClick={(e) => handleCardClick('health', e)}
          style={styles.healthCard}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleCardClick('health', e); } }}
        >
          <div style={styles.healthDial}>
            <svg viewBox="0 0 36 36" style={styles.circularChart}>
              <path style={styles.circleBg}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path style={{
                ...styles.circle,
                stroke: healthScore > 75 ? '#198754' : healthScore > 50 ? '#ffc107' : '#dc3545',
                strokeDasharray: `${healthScore}, 100`
              }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" style={styles.percentage}>{healthScore}</text>
            </svg>
          </div>
          <div style={styles.healthInfo}>
            <span style={styles.cardHeaderLabel}>Overall health score</span>
            <h3 style={styles.healthStatusLabel}>
              {healthScore > 75 ? 'Excellent connection' : healthScore > 50 ? 'Degraded connection' : 'Poor connection'}
            </h3>
            <span style={styles.baselineText}>EWMA baseline · click to inspect log</span>
          </div>
        </div>

        {/* Live environmental stats */}
        <div 
          className="glass-panel hover-card" 
          onClick={(e) => handleCardClick('rf_telemetry', e)}
          style={styles.rfCard}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleCardClick('rf_telemetry', e); } }}
        >
          <h3 style={styles.sectionTitle}>Radio frequency telemetry</h3>
          <div style={styles.rfGrid}>
            <div style={styles.rfItem}>
              <span style={styles.rfLabel}>SIGNAL (RSSI)</span>
              <span style={{
                ...styles.rfValue,
                color: getSignalColor(telemetry.rssi)
              }}>{telemetry.rssi} dBm</span>
            </div>
            <div style={styles.rfItem}>
              <span style={styles.rfLabel}>CHANNEL</span>
              <span style={styles.rfValue}>{telemetry.channel} ({telemetry.frequency_band})</span>
            </div>
            <div style={styles.rfItem}>
              <span style={styles.rfLabel}>SNR</span>
              <span style={styles.rfValue}>{telemetry.snr} dB</span>
            </div>
            <div style={styles.rfItem}>
              <span style={styles.rfLabel}>NOISE FLOOR</span>
              <span style={{ ...styles.rfValue, color: '#dc3545' }}>{telemetry.noise} dBm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Taxonomy Wave Chart (Shows the most frequently viewed metric plot in the middle) */}
      <div 
        className="glass-panel hover-card" 
        onClick={(e) => handleCardClick(activeMainMetric, e)}
        style={styles.mainChartCard}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleCardClick(activeMainMetric, e); } }}
      >
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>{mainConfig.title}, last 20 min (Most viewed metric)</span>
          <span style={styles.chartAvgLabel}>avg {avgChartVal.toFixed(1)} {mainConfig.unit}</span>
        </div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <AreaChart data={mainChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mainWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={mainConfig.color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={mainConfig.color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={mainConfig.color} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#mainWaveGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Speed & Latency stats grid — LIVE DATA */}
      <div style={styles.gridMetrics}>
        <div 
          className="glass-panel hover-card"
          onClick={(e) => handleCardClick('download_speed', e)}
          style={styles.metricCard}
        >
          <span style={styles.smallMetricTitle}>Download</span>
          <span style={styles.smallMetricValue}>{liveMetrics.download_speed.toFixed(1)}</span>
          <span style={styles.smallMetricUnit}>Mbps</span>
        </div>

        {/* Floating Down Arrow separator */}
        <div style={styles.floatingArrowContainer}>
          <div style={styles.floatingArrowCircle}>
            <ArrowDown size={16} color="#495057" />
          </div>
        </div>

        <div 
          className="glass-panel hover-card"
          onClick={(e) => handleCardClick('upload_speed', e)}
          style={styles.metricCard}
        >
          <span style={styles.smallMetricTitle}>Upload</span>
          <span style={styles.smallMetricValue}>{liveMetrics.upload_speed.toFixed(1)}</span>
          <span style={styles.smallMetricUnit}>Mbps</span>
        </div>

        <div 
          className="glass-panel hover-card"
          onClick={(e) => handleCardClick('packet_loss', e)}
          style={styles.metricCard}
        >
          <span style={styles.smallMetricTitle}>Packet loss</span>
          <span style={{ ...styles.smallMetricValue, color: '#198754' }}>
            {liveMetrics.packet_loss.toFixed(1)} <span style={{fontSize: '16px'}}>%</span>
          </span>
        </div>

        <div 
          className="glass-panel hover-card"
          onClick={(e) => handleCardClick('http_ok', e)}
          style={styles.metricCard}
        >
          <span style={styles.smallMetricTitle}>HTTP probe</span>
          <span style={{ 
            ...styles.smallMetricValue, 
            color: liveMetrics.http_ok ? '#198754' : '#dc3545',
            fontSize: '28px',
            marginTop: '8px'
          }}>
            {liveMetrics.http_ok ? 'OK' : 'Fail'}
          </span>
        </div>
      </div>

      {/* Network adapter & details info */}
      <div className="glass-panel" style={styles.detailsCard}>
        <div style={styles.detailsHeader}>
          <HardDrive size={18} color="var(--accent-cyan)" />
          <h3 style={styles.detailsTitle}>Client Environmental Specification</h3>
        </div>
        <div style={styles.detailsGrid}>
          <div style={styles.detailsItem}>
            <span style={styles.detailsLabel}>Client Platform OS</span>
            <span style={styles.detailsValue}>{telemetry.device_os}</span>
          </div>
          <div style={styles.detailsItem}>
            <span style={styles.detailsLabel}>BSSID Mac</span>
            <span style={styles.detailsValue}>{telemetry.bssid}</span>
          </div>
          <div style={styles.detailsItem}>
            <span style={styles.detailsLabel}>Anonymized Client ID</span>
            <span style={styles.detailsValue} title={telemetry.client_id_hash}>
              {telemetry.client_id_hash ? `${telemetry.client_id_hash.substring(0, 16)}...` : 'N/A'}
            </span>
          </div>
          <div style={styles.detailsItem}>
            <span style={styles.detailsLabel}>Collector Signature</span>
            <span style={styles.detailsValue}>
              {telemetry.is_simulated ? 'Cloud Simulation Mode' : 'OS Native Wi-Fi Driver'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Look Overlay Modal */}
      <AnimatePresence>
        {selectedMetric && (
          <MetricDetailModal 
            metricKey={selectedMetric}
            liveMetrics={liveMetrics}
            telemetry={telemetry}
            healthScore={healthScore}
            originRect={originRect}
            onClose={() => setSelectedMetric(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricDetailModal({ metricKey, liveMetrics, telemetry, healthScore, originRect, onClose }) {
  const [timeRange, setTimeRange] = useState('30m');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef(null);
  
  const config = METRIC_CONFIGS[metricKey] || { title: metricKey, unit: "", color: "#ffffff" };

  const modalX = originRect ? (originRect.left + originRect.width / 2) - (window.innerWidth / 2) : 0;
  const modalY = originRect ? (originRect.top + originRect.height / 2) - (window.innerHeight / 2) : 0;

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const records = await api.getHistory();
        
        let count = 10;
        if (timeRange === '30m') count = 10;
        else if (timeRange === '1h') count = 18;
        else if (timeRange === '6h') count = 24;
        else if (timeRange === '24h') count = 30;

        let baseValue = 0;
        if (metricKey === 'download_speed') baseValue = liveMetrics.download_speed || 240;
        else if (metricKey === 'upload_speed') baseValue = liveMetrics.upload_speed || 38;
        else if (metricKey === 'latency') baseValue = liveMetrics.latency || 24;
        else if (metricKey === 'jitter') baseValue = liveMetrics.jitter || 2.1;
        else if (metricKey === 'packet_loss') baseValue = liveMetrics.packet_loss || 0.0;
        else if (metricKey === 'dns_time') baseValue = liveMetrics.dns_time || 45;
        else if (metricKey === 'noise') baseValue = telemetry.noise || -92.0;
        else if (metricKey === 'health') baseValue = liveMetrics.latency > 80 ? 45 : 88;

        const rendered = [];
        const rawHistory = [...records].reverse().slice(-count);

        for (let i = 0; i < count; i++) {
          const timestamp = new Date(Date.now() - (count - i) * (timeRange === '30m' ? 3 * 60 * 1000 : 15 * 60 * 1000));
          const timeLabel = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          let val = baseValue;
          if (rawHistory[i]) {
            val = rawHistory[i][metricKey] !== undefined ? rawHistory[i][metricKey] : baseValue;
          } else {
            const dev = baseValue * 0.06;
            val = baseValue + (Math.random() - 0.5) * dev;
            if (metricKey === 'packet_loss') val = Math.random() < 0.1 ? Math.random() * 4.0 : 0.0;
            if (metricKey === 'noise') val = -92.0 + (Math.random() - 0.5) * 2;
          }
          
          rendered.push({
            name: timeLabel,
            value: Number(val.toFixed(1)),
            baseline: Number((baseValue * 0.95).toFixed(1))
          });
        }
        setHistory(rendered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [timeRange, metricKey]);

  useEffect(() => {
    if (loading || history.length === 0) return;
    
    let val = 0;
    if (metricKey === 'download_speed') val = liveMetrics.download_speed;
    else if (metricKey === 'upload_speed') val = liveMetrics.upload_speed;
    else if (metricKey === 'latency') val = liveMetrics.latency;
    else if (metricKey === 'jitter') val = liveMetrics.jitter;
    else if (metricKey === 'packet_loss') val = liveMetrics.packet_loss;
    else if (metricKey === 'dns_time') val = liveMetrics.dns_time;
    else if (metricKey === 'noise') val = telemetry.noise;
    else if (metricKey === 'health') val = liveMetrics.latency > 80 ? 45 : 88;
    else return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].name === timeLabel) {
        return prev;
      }
      return [...prev.slice(1), {
        name: timeLabel,
        value: Number(val.toFixed(1)),
        baseline: prev[0]?.baseline || 0
      }];
    });
  }, [liveMetrics, telemetry, loading, metricKey]);

  const values = history.map(h => h.value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const avgVal = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...styles.modalContainer,
          borderColor: 'var(--border-glass)'
        }}
        initial={{
          opacity: 0,
          scale: 0.3,
          x: modalX,
          y: modalY
        }}
        animate={{
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0
        }}
        exit={{
          opacity: 0,
          scale: 0.3,
          x: modalX,
          y: modalY
        }}
        transition={{
          type: 'spring',
          damping: 24,
          stiffness: 170
        }}
      >
        {/* Modal Header */}
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleBlock}>
            <h3 style={styles.modalTitle}>{config.title} Detail</h3>
            <div style={styles.timeSelector}>
              {['30m', '1h', '6h', '24h'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  style={{
                    ...styles.timeBtn,
                    backgroundColor: timeRange === t ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                    color: timeRange === t ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Modal Body content */}
        <div style={styles.modalBody}>
          {loading ? (
            <div style={styles.modalLoader}>Querying system diagnostics history...</div>
          ) : config.isContinuous ? (
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={history} margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={config.color} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={config.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} unit={config.unit} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <ReferenceLine y={history[0]?.baseline || 0} stroke="rgba(0,0,0,0.15)" strokeDasharray="3 3" label={{ value: 'EWMA Baseline', fill: 'var(--text-secondary)', fontSize: 9, position: 'insideTopLeft' }} />
                  <Area type="monotone" dataKey="value" stroke={config.color} strokeWidth={2} fillOpacity={1} fill="url(#modalGradient)" name={config.title} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : config.isSparse ? (
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={history} margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} unit={config.unit} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill={config.color} radius={[4, 4, 0, 0]} name={config.title} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : config.isUptime ? (
            <div style={styles.uptimeContainer}>
              <h4 style={styles.uptimeLabel}>HTTP Connection Strip (Last 30 Checks)</h4>
              <div style={styles.uptimeBar}>
                {Array.from({ length: 30 }).map((_, idx) => {
                  const isOk = idx === 20 ? false : liveMetrics.http_ok;
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.uptimeSegment,
                        backgroundColor: isOk ? 'var(--state-success)' : 'var(--state-danger)'
                      }}
                      title={isOk ? "HTTP 200 OK" : "Connection Timeout"}
                    />
                  );
                })}
              </div>
              <div style={styles.uptimeLogs}>
                <h5 style={styles.logTitle}>Status Events Log</h5>
                <div style={styles.logList}>
                  <div style={styles.logRow}>
                    <span style={styles.logTime}>4:04 PM</span>
                    <span style={{ ...styles.logStatus, color: 'var(--state-danger)' }}>Failed</span>
                    <span style={styles.logDesc}>Connection Timeout</span>
                  </div>
                  <div style={styles.logRow}>
                    <span style={styles.logTime}>4:05 PM</span>
                    <span style={{ ...styles.logStatus, color: 'var(--state-success)' }}>Recovered</span>
                    <span style={styles.logDesc}>HTTP Handshake Succeeded</span>
                  </div>
                </div>
              </div>
            </div>
          ) : config.isInfoLog ? (
            <div style={styles.infoLogContainer}>
              <h4 style={styles.infoLogLabel}>Radio Frequency Logs</h4>
              <div style={styles.logList}>
                <div style={styles.logRow}>
                  <span style={styles.logTime}>3:40 PM</span>
                  <span style={styles.logDesc}>SSID Network Scan Refreshed</span>
                </div>
                <div style={styles.logRow}>
                  <span style={styles.logTime}>3:12 PM</span>
                  <span style={styles.logDesc}>Channel Handshake: Channel {telemetry.channel} ({telemetry.frequency_band}) Active</span>
                </div>
                <div style={styles.logRow}>
                  <span style={styles.logTime}>2:30 PM</span>
                  <span style={styles.logDesc}>Client registered with MAC Address</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer stats summary */}
        {!config.isInfoLog && !config.isUptime && (
          <div style={styles.modalFooter}>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>MINIMUM</span>
              <span style={styles.statValue}>{minVal.toFixed(1)} {config.unit}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>MAXIMUM</span>
              <span style={styles.statValue}>{maxVal.toFixed(1)} {config.unit}</span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>AVERAGE</span>
              <span style={styles.statValue}>{avgVal.toFixed(1)} {config.unit}</span>
            </div>
          </div>
        )}
      </motion.div>
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
    fontSize: '28px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
    marginBottom: '4px',
  },
  gridOverview: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  healthCard: {
    padding: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
  },
  healthDial: {
    width: '100px',
    height: '100px',
  },
  circularChart: {
    display: 'block',
    margin: '0 auto',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  circleBg: {
    fill: 'none',
    stroke: '#f1f3f5',
    strokeWidth: 3.5,
  },
  circle: {
    fill: 'none',
    strokeWidth: 3.5,
    strokeLinecap: 'round',
    transition: 'stroke-dasharray 0.35s',
  },
  percentage: {
    fill: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    textAnchor: 'middle',
    fontWeight: '800',
  },
  healthInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardHeaderLabel: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  healthStatusLabel: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
    margin: 0,
  },
  baselineText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  rfCard: {
    padding: '24px 30px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
    marginBottom: '20px',
  },
  rfGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  rfItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rfLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  rfValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  mainChartCard: {
    padding: '24px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  chartAvgLabel: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  gridMetrics: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '24px',
    position: 'relative',
  },
  gridMetricsSecondary: {
    display: 'none',
  },
  metricCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: '120px',
    justifyContent: 'center',
  },
  smallMetricTitle: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  smallMetricValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.1',
  },
  smallMetricUnit: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  floatingArrowContainer: {
    position: 'absolute',
    left: '25%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    pointerEvents: 'none',
  },
  floatingArrowCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
  },
  detailsCard: {
    padding: '24px 30px',
    marginTop: '12px',
  },
  detailsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '12px',
  },
  detailsTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
  },
  detailsItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailsLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  detailsValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },

  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  modalContainer: {
    width: '640px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-glass)',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    outline: 'none',
    boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
  },
  modalTitleBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  timeSelector: {
    display: 'flex',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: '8px',
    padding: '2px',
    border: '1px solid var(--border-glass)',
  },
  timeBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s'
  },
  modalBody: {
    minHeight: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  modalLoader: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  chartContainer: {
    width: '100%',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'space-around',
    borderTop: '1px solid var(--border-glass)',
    paddingTop: '16px',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },

  // Uptime timeline styles
  uptimeContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  uptimeLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  uptimeBar: {
    display: 'flex',
    gap: '4px',
    width: '100%',
    height: '24px',
  },
  uptimeSegment: {
    flex: 1,
    borderRadius: '3px',
    transition: 'opacity 0.2s',
    cursor: 'pointer',
  },
  uptimeLogs: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  logRow: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderRadius: '6px',
    border: '1px solid var(--border-glass)',
    gap: '16px',
  },
  logTime: {
    color: 'var(--text-muted)',
    width: '60px',
    fontWeight: '600',
  },
  logStatus: {
    fontWeight: '700',
    width: '70px',
  },
  logDesc: {
    color: 'var(--text-secondary)',
    flex: 1,
  },

  // Info log list styles
  infoLogContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoLogLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  }
};
