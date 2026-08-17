import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  Search, 
  History, 
  LifeBuoy, 
  ClipboardList, 
  LogOut,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import SettingsModal from './SettingsModal';

// SirenWiFi Concentric Circles Logo
function ConcentricLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 10 10" />
      <path d="M12 6a6 6 0 0 1 6 6" />
      <path d="M12 10a2 2 0 0 1 2 2" />
      <circle cx="12" cy="12" r="0.5" fill="var(--accent-cyan)" />
      <path d="M12 22a10 10 0 0 1-10-10" />
      <path d="M12 18a6 6 0 0 1-6-6" />
      <path d="M12 14a2 2 0 0 1-2-2" />
    </svg>
  );
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const { user, logoutUser } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'analyze', name: 'Analyse wifi', icon: Search },
    { id: 'history', name: 'Analysis history', icon: History },
    { id: 'tickets', name: 'Raise a ticket', icon: LifeBuoy },
    { id: 'ticket_history', name: 'Ticket history', icon: ClipboardList },
  ];

  const userInitials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'US';

  return (
    <>
      {/* Slide-out Drawer Sidebar */}
      <div style={{ ...styles.sidebar, left: isOpen ? 0 : '-260px' }}>
        {/* Brand Header */}
        <div style={styles.brand}>
          <div style={styles.brandContent}>
            <ConcentricLogo size={24} />
            <span style={styles.brandText}>SirenWiFi</span>
          </div>
          <button onClick={() => setIsOpen(false)} style={styles.closeBtn} aria-label="Close menu">
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Navigation List */}
        <nav style={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false); // Auto-close drawer on navigation
                }}
                style={{
                  ...styles.navBtn,
                  ...(isActive ? styles.navBtnActive : {}),
                }}
              >
                <Icon 
                  size={20} 
                  color={isActive ? 'var(--text-primary)' : 'var(--text-secondary)'} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span style={{
                  ...styles.navText,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? '700' : '500'
                }}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Profile & Logout Section */}
        <div style={styles.footer}>
          <button 
            onClick={() => {
              setIsSettingsOpen(true);
              setIsOpen(false); // close sidebar drawer
            }} 
            style={{...styles.navBtn, marginBottom: '8px'}}
          >
            <SettingsIcon size={20} color="var(--text-secondary)" strokeWidth={2} />
            <span style={{...styles.navText, color: 'var(--text-secondary)', fontWeight: '500'}}>
              Settings
            </span>
          </button>

          <div style={styles.profileCard}>
            <div style={styles.avatar}>
              {userInitials}
            </div>
            <div style={styles.profileInfo}>
              <span style={styles.userEmail} title={user?.email}>
                {user?.email ? user.email.split('@')[0] : 'user'}
              </span>
              <span style={styles.userRole}>Subscriber</span>
            </div>
          </div>

          <button onClick={logoutUser} style={styles.logoutBtn}>
            <LogOut size={16} color="var(--state-danger)" />
            <span style={styles.logoutText}>Logout</span>
          </button>
        </div>
      </div>

      {/* Backdrop overlay when sidebar drawer is open */}
      {isOpen && <div style={styles.overlay} onClick={() => setIsOpen(false)} />}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
}

const styles = {
  sidebar: {
    width: '260px',
    height: '100vh',
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    zIndex: 1000,
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
    boxShadow: '10px 0 30px rgba(0,0,0,0.05)',
  },
  brand: {
    padding: '20px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '70px',
  },
  brandContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    whiteSpace: 'nowrap',
  },
  brandText: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 12px',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '10px',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    position: 'relative',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  navBtnActive: {
    backgroundColor: '#e9ecef',
  },
  navText: {
    fontSize: '14px',
  },
  footer: {
    padding: '20px 12px',
    borderTop: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cfe2ff',
    color: '#0d6efd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    flexShrink: 0,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  userRole: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    width: '100%',
    textAlign: 'left',
    color: 'var(--state-danger)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(4px)',
    zIndex: 990,
  }
};
