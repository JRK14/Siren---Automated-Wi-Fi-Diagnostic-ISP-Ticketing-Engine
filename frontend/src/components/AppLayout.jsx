import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AppLayout({ children, activeTab, setActiveTab, liveStatus }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const telemetry = liveStatus?.telemetry || {
    ssid: 'Connecting...',
    rssi: -50
  };

  const latency = liveStatus?.live_metrics?.latency || 0;

  return (
    <div style={styles.container}>
      {/* Slide-out Drawer Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      {/* Main Body (Full width since sidebar is an overlay) */}
      <div style={styles.mainContent}>
        {/* Top Header Information Panel */}
        <header style={styles.topbar}>
          <div style={styles.systemStatus}>
            {/* Hamburger Trigger button */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              style={styles.hamburgerBtn}
              aria-label="Open navigation menu"
            >
              <Menu size={20} color="var(--text-primary)" />
            </button>

            <div style={styles.statusIndicator}>
              <span style={{
                ...styles.dot,
                backgroundColor: liveStatus ? 'var(--state-success)' : 'var(--state-danger)',
              }} />
              <span style={styles.statusText}>
                {liveStatus ? 'OS engine connected' : 'OS engine disconnected'}
              </span>
            </div>
            {liveStatus && (
              <div style={styles.infoLabel}>
                <span style={styles.infoText}>
                  Connected wifi network ({telemetry.rssi} dBm)
                </span>
              </div>
            )}
            {liveStatus?.live_metrics && (
              <div style={styles.infoLabel}>
                <span style={styles.infoText}>
                  {latency.toFixed(1)} ms ping
                </span>
              </div>
            )}
            <div style={styles.infoLabel}>
              <span style={styles.infoText}>
                Closed-loop active
              </span>
            </div>
          </div>
        </header>
        
        {/* Render child dashboard page view */}
        <main style={styles.contentBody}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    backgroundColor: 'var(--bg-primary)',
    minHeight: '100vh',
    width: '100vw',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    marginLeft: 0, // Reset to zero margin for full screen spacious content layout
  },
  topbar: {
    height: '70px',
    borderBottom: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 30px',
    backgroundColor: '#ffffff',
    position: 'sticky',
    top: 0,
    zIndex: 90,
  },
  systemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
  },
  hamburgerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
    marginRight: '-10px'
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  infoLabel: {
    display: 'flex',
    alignItems: 'center',
  },
  infoText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  contentBody: {
    padding: '30px',
    flex: 1,
    overflowY: 'auto',
  }
};
