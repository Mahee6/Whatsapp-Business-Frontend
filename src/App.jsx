import { useState, useEffect } from 'react';
import SendMessage from './components/SendMessage';
import Storage from './components/Storage';
import Conversations from './components/Conversations';
import Contacts from './components/Contacts';
import Login from './components/Login';
import { useAuth } from './contexts/AuthContext';
import api from './services/api';
import './App.css';

function App() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('conversations');
  const [serverStatus, setServerStatus] = useState('checking');
  const [sendTo, setSendTo] = useState('');

  const navigateToSend = (phoneNumber) => {
    setSendTo(phoneNumber);
    setActiveTab('send');
  };

  const [openConvId, setOpenConvId] = useState(null);

  const navigateToChat = (phoneNumber) => {
    setOpenConvId(`conv_${phoneNumber}`);
    setActiveTab('conversations');
  };

  useEffect(() => {
    if (currentUser) {
      checkServerHealth();
    }
  }, [currentUser]);

  const checkServerHealth = async () => {
    const response = await api.checkHealth();
    setServerStatus(response.success ? 'online' : 'offline');
  };

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <h1>WhatsApp Business</h1>
          </div>
          
          <div className="header-actions">
            <div className="server-status">
              <span className={`status-indicator ${serverStatus}`}></span>
              <span className="status-text">
                Server: {serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : 'Checking...'}
              </span>
              <button onClick={checkServerHealth} className="btn-refresh" title="Refresh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
                </svg>
              </button>
            </div>

            <div className="user-profile">
              <img src={currentUser.photoURL} alt={currentUser.displayName} className="user-avatar" />
              <div className="user-info">
                <span className="user-name">{currentUser.displayName}</span>
                <button onClick={logout} className="btn-logout">Logout</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-button ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Conversations
        </button>
        {/* <button
          className={`nav-button ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send Messages
        </button> */}
        <button
          className={`nav-button ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          Storage
        </button>
        <button
          className={`nav-button ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Contacts
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'conversations' && <Conversations initialConvId={openConvId} />}
        {activeTab === 'send' && <SendMessage initialPhone={sendTo} />}
        {activeTab === 'storage' && <Storage />}
        {activeTab === 'contacts' && <Contacts onOpenChat={navigateToChat} />}
      </main>
    </div>
  );
}

export default App;
