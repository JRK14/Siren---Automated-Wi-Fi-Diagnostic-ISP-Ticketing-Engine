import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Activity, Save, RefreshCw, Sliders, ShieldAlert } from 'lucide-react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  content: {
    width: '90%',
    maxWidth: '550px',
    backgroundColor: 'var(--surface-primary)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex'
  },
  body: {
    padding: '24px',
    overflowY: 'auto'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  controlGroup: {
    backgroundColor: 'var(--surface-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px'
  },
  controlHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  controlLabel: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)'
  },
  controlValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--accent-cyan)',
    backgroundColor: 'rgba(13, 110, 253, 0.1)',
    padding: '4px 10px',
    borderRadius: '20px'
  },
  slider: {
    width: '100%',
    accentColor: 'var(--accent-cyan)',
    cursor: 'pointer'
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--surface-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    marginBottom: '16px',
    cursor: 'pointer'
  },
  toggleLabel: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  buttonSecondary: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '14px'
  },
  buttonPrimary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--accent-cyan)',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(13, 110, 253, 0.3)'
  }
};

export default function SettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    enable_auto_diagnostics: true,
    max_latency: 150,
    max_jitter: 50,
    max_packet_loss: 5,
    http_failure: true
  });

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/settings/thresholds`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/settings/thresholds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        onClose();
      }
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSliderChange = (e, key) => {
    setSettings(prev => ({
      ...prev,
      [key]: parseFloat(e.target.value)
    }));
  };

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          style={modalStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div 
            style={modalStyles.content}
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalStyles.header}>
              <h2 style={modalStyles.title}>
                <Settings size={20} color="var(--accent-cyan)" />
                Diagnostic Thresholds
              </h2>
              <button style={modalStyles.closeBtn} onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div style={modalStyles.body}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <RefreshCw size={24} className="spin" color="var(--accent-cyan)" />
                </div>
              ) : (
                <>
                  <div style={modalStyles.section}>
                    <div style={modalStyles.sectionTitle}>
                      <ShieldAlert size={16} /> Auto-Diagnostics Control
                    </div>
                    
                    <div style={modalStyles.toggleRow} onClick={() => handleToggle('enable_auto_diagnostics')}>
                      <div style={modalStyles.toggleLabel}>
                        <Activity size={18} color={settings.enable_auto_diagnostics ? "var(--success)" : "var(--text-secondary)"} />
                        Enable Background Auto-Diagnostics
                      </div>
                      <div style={{
                        width: '40px', height: '22px', borderRadius: '20px',
                        backgroundColor: settings.enable_auto_diagnostics ? 'var(--accent-cyan)' : 'var(--border-color)',
                        position: 'relative', transition: '0.2s'
                      }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                          position: 'absolute', top: '2px', left: settings.enable_auto_diagnostics ? '20px' : '2px',
                          transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </div>
                    
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '-8px' }}>
                      When enabled, the ultra-lightweight background probe will automatically launch a full multi-threaded diagnostic trace and submit a ticket if your network performance drops below the thresholds configured below.
                    </p>
                  </div>

                  <div style={{ ...modalStyles.section, opacity: settings.enable_auto_diagnostics ? 1 : 0.5, pointerEvents: settings.enable_auto_diagnostics ? 'auto' : 'none', transition: '0.2s' }}>
                    <div style={modalStyles.sectionTitle}>
                      <Sliders size={16} /> Performance Thresholds
                    </div>

                    <div style={modalStyles.controlGroup}>
                      <div style={modalStyles.controlHeader}>
                        <span style={modalStyles.controlLabel}>Max Latency Tolerance</span>
                        <span style={modalStyles.controlValue}>{settings.max_latency} ms</span>
                      </div>
                      <input 
                        type="range" 
                        min="20" max="500" step="10" 
                        value={settings.max_latency} 
                        onChange={(e) => handleSliderChange(e, 'max_latency')} 
                        style={modalStyles.slider} 
                      />
                    </div>

                    <div style={modalStyles.controlGroup}>
                      <div style={modalStyles.controlHeader}>
                        <span style={modalStyles.controlLabel}>Max Jitter Tolerance</span>
                        <span style={modalStyles.controlValue}>{settings.max_jitter} ms</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" max="150" step="5" 
                        value={settings.max_jitter} 
                        onChange={(e) => handleSliderChange(e, 'max_jitter')} 
                        style={modalStyles.slider} 
                      />
                    </div>

                    <div style={modalStyles.controlGroup}>
                      <div style={modalStyles.controlHeader}>
                        <span style={modalStyles.controlLabel}>Max Packet Loss</span>
                        <span style={modalStyles.controlValue}>{settings.max_packet_loss}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="25" step="0.5" 
                        value={settings.max_packet_loss} 
                        onChange={(e) => handleSliderChange(e, 'max_packet_loss')} 
                        style={modalStyles.slider} 
                      />
                    </div>

                    <div style={modalStyles.toggleRow} onClick={() => handleToggle('http_failure')}>
                      <div style={modalStyles.toggleLabel}>
                        HTTP Probe Failure Auto-Trigger
                      </div>
                      <div style={{
                        width: '40px', height: '22px', borderRadius: '20px',
                        backgroundColor: settings.http_failure ? 'var(--accent-cyan)' : 'var(--border-color)',
                        position: 'relative', transition: '0.2s'
                      }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                          position: 'absolute', top: '2px', left: settings.http_failure ? '20px' : '2px',
                          transition: '0.2s'
                        }} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={modalStyles.footer}>
              <button style={modalStyles.buttonSecondary} onClick={onClose} disabled={saving}>Cancel</button>
              <button style={modalStyles.buttonPrimary} onClick={saveSettings} disabled={saving}>
                {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
