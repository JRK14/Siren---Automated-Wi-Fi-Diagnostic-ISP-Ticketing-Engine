import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Shield, Lock, Mail, Server, Activity, User } from 'lucide-react';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', 
  '#f43f5e', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', 
  '#eab308', '#f97316'
];

const ASSET_IMAGES = [
  'P1.png',
  'p2.avif',
  'p3.avif',
  'p4.avif',
  'p5.webp',
  'p6.avif',
  'P7.png',
  'p8.avif',
  'p9.avif',
  'p10.jpeg',
  'p11.avif',
  'P12.png'
];

export default function LoginPage() {
  const { loginUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Cycle through P1 to P12 images on the left panel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev === ASSET_IMAGES.length - 1 ? 0 : prev + 1));
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Initialize Google OAuth Identity SDK
  useEffect(() => {
    window.handleGoogleCredentialResponse = async (response) => {
      setLoading(true);
      setError('');
      try {
        const data = await api.googleLogin(response.credential);
        loginUser(data.access_token, data.email);
      } catch (err) {
        setError(err.message || 'Google Auth login failed.');
      } finally {
        setLoading(false);
      }
    };

    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: "148543189660-322q11j87euh83vuuldim4uj3jsodv0o.apps.googleusercontent.com",
        callback: window.handleGoogleCredentialResponse,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", width: 340 }
      );
    }
  }, []);

  // Standard authentication handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials fields.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        await api.signup(email, password);
        const loginData = await api.login(email, password);
        loginUser(loginData.access_token, loginData.email);
      } else {
        const loginData = await api.login(email, password);
        loginUser(loginData.access_token, loginData.email);
      }
    } catch (err) {
      setError(err.message || 'Authentication transaction rejected.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

  const activeColor = COLORS[currentImageIndex % COLORS.length];

  return (
    <div style={styles.pageContainer}>
      <div style={styles.gridOverlay} />
      
      {/* Auth Card with Dynamic Backlight Glow */}
      <div style={{
        ...styles.authCard,
        boxShadow: `0 0 80px 10px ${activeColor}55, 0 20px 50px rgba(0, 0, 0, 0.4)`,
        borderColor: `${activeColor}30`
      }}>
        
        {/* Sliding Cycling Image Panel with Smooth Opacity Cross-Fade */}
        <div style={{
          ...styles.leftPanel,
          transform: isSignUp ? 'translateX(100%)' : 'translateX(0)'
        }}>
          {ASSET_IMAGES.map((img, idx) => (
            <div
              key={img}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `linear-gradient(180deg, rgba(10, 11, 22, 0.25) 0%, rgba(10, 11, 22, 0.75) 100%), url(/assets/${img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: currentImageIndex === idx ? 1 : 0,
                transition: 'opacity 1.5s ease-in-out',
                zIndex: 1
              }}
            />
          ))}

          {/* Text content floating on top of the active background image */}
          <div style={styles.textContainer}>
            <h2 style={styles.leftTitle}>
              {isSignUp ? "Welcome Back!" : "Discover Siren!"}
            </h2>
            <p style={styles.leftSubtitle}>
              {isSignUp 
                ? "To keep connected with us please login with your personal info"
                : "Monitor, analyze, and diagnose Wi-Fi health dynamically with automated ticketing."}
            </p>
            <button onClick={toggleMode} style={styles.toggleBtn}>
              {isSignUp ? "SIGN IN" : "SIGN UP"}
            </button>
          </div>
        </div>

        {/* Sliding Form Input Fields Panel */}
        <div style={{
          ...styles.rightPanel,
          transform: isSignUp ? 'translateX(-100%)' : 'translateX(0)'
        }}>
          <div style={styles.formHeader}>
            <h2 style={styles.rightTitle}>
              {isSignUp ? "Create Account" : "Sign In"}
            </h2>
            <p style={styles.rightSubtitle}>
              {isSignUp ? "Use your email for registration" : "Use your email and password"}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={styles.form}>
            {error && <div style={styles.errorBanner}>{error}</div>}

            {isSignUp && (
              <div style={styles.inputGroup}>
                <User size={18} color="#9ca3af" style={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.inputField}
                />
              </div>
            )}

            <div style={styles.inputGroup}>
              <Mail size={18} color="#9ca3af" style={styles.inputIcon} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.inputField}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <Lock size={18} color="#9ca3af" style={styles.inputIcon} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.inputField}
                required
              />
            </div>

            {isSignUp && (
              <div style={styles.inputGroup}>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={styles.selectField}
                >
                  <option value="Student">Student</option>
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
            )}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Processing...' : isSignUp ? 'SIGN UP' : 'SIGN IN'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>OR</span>
            <span style={styles.dividerLine} />
          </div>

          <div style={styles.oauthContainer}>
            <div id="google-signin-button"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0a0b16',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
    backgroundSize: '24px 24px',
    opacity: 0.7,
    pointerEvents: 'none',
  },
  authCard: {
    display: 'flex',
    width: '950px',
    height: '580px',
    borderRadius: '24px',
    overflow: 'hidden',
    zIndex: 10,
    backgroundColor: '#ffffff',
    transition: 'box-shadow 0.6s ease-in-out, border-color 0.6s ease-in-out',
    border: '1px solid transparent'
  },
  leftPanel: {
    width: '50%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px',
    color: '#ffffff',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  textContainer: {
    zIndex: 10,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftTitle: {
    fontSize: '32px',
    fontWeight: '800',
    marginBottom: '15px',
    letterSpacing: '-0.5px',
    textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
  },
  leftSubtitle: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: '35px',
    maxWidth: '330px',
    textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
  },
  toggleBtn: {
    padding: '12px 40px',
    backgroundColor: 'transparent',
    border: '2px solid #ffffff',
    borderRadius: '30px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'all 0.3s ease',
    outline: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  rightPanel: {
    width: '50%',
    height: '100%',
    backgroundColor: '#ffffff',
    padding: '50px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 5,
  },
  formHeader: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  rightTitle: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#111827',
    marginBottom: '8px',
  },
  rightSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '16px',
    pointerEvents: 'none',
  },
  inputField: {
    width: '100%',
    padding: '14px 16px 14px 48px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    color: '#1f2937',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  selectField: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    color: '#4b5563',
    fontSize: '14px',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
    backgroundSize: '16px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    border: 'none',
    borderRadius: '30px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
    letterSpacing: '0.5px',
  },
  errorBanner: {
    padding: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    color: '#b91c1c',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#f3f4f6',
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '11px',
    color: '#9ca3af',
    fontWeight: '600',
  },
  oauthContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
};
