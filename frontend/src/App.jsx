import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AnalyzePage from './pages/AnalyzePage';
import HistoryPage from './pages/HistoryPage';
import RaiseTicketPage from './pages/RaiseTicketPage';
import TicketHistoryPage from './pages/TicketHistoryPage';
import { api } from './services/api';

function AppContent() {
  const { token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [liveData, setLiveData] = useState(null);
  const [latestDiagnostic, setLatestDiagnostic] = useState(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [ticketRefresh, setTicketRefresh] = useState(0);

  // Establish WebSocket pipeline for live telemetry streaming on Dashboard
  useEffect(() => {
    if (!token) return;

    let socket;
    const connectSocket = () => {
      socket = api.getTelemetrySocket();

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
        } catch (err) {
          console.error('Error parsing live WS payload', err);
        }
      };

      socket.onclose = () => {
        // Retry connection after 3s delay
        setTimeout(connectSocket, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectSocket();

    return () => {
      if (socket) socket.close();
    };
  }, [token]);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <span>Initializing Diagnostic Engine...</span>
      </div>
    );
  }

  // If no valid auth session, render authentication screen
  if (!token) {
    return <LoginPage />;
  }

  const handleDiagnosticComplete = (diagData) => {
    setLatestDiagnostic(diagData);
    // Refresh history tables and charts
    setHistoryRefresh(prev => prev + 1);
  };

  const handleTicketCreated = () => {
    // Refresh tickets history list
    setTicketRefresh(prev => prev + 1);
    setActiveTab('ticket_history');
  };

  return (
    <AppLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      liveStatus={liveData}
    >
      {activeTab === 'dashboard' && (
        <DashboardPage liveData={liveData} />
      )}
      
      {activeTab === 'analyze' && (
        <AnalyzePage 
          liveTelemetry={liveData?.telemetry} 
          onDiagnosticComplete={handleDiagnosticComplete} 
        />
      )}
      
      {activeTab === 'history' && (
        <HistoryPage refreshTrigger={historyRefresh} />
      )}
      
      {activeTab === 'tickets' && (
        <RaiseTicketPage 
          latestDiagnostic={latestDiagnostic} 
          onTicketCreated={handleTicketCreated} 
        />
      )}
      
      {activeTab === 'ticket_history' && (
        <TicketHistoryPage refreshTrigger={ticketRefresh} />
      )}
    </AppLayout>
  );
}

const styles = {
  loadingScreen: {
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0a0c1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    color: '#00d4ff',
    fontSize: '14px',
    fontWeight: '500',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid rgba(0, 212, 255, 0.1)',
    borderTopColor: '#00d4ff',
    animation: 'spin 1s infinite linear',
  }
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
