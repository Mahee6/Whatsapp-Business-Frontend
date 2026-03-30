import { useState, useEffect } from 'react';
import api from '../services/api';
import './Analytics.css';

function Analytics() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [prefix, setPrefix] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [conversationData, setConversationData] = useState(null);
  const [userData, setUserData] = useState(null);

  const loadSummary = async () => {
    setLoading(true);
    const response = await api.getAnalyticsSummary(prefix);
    if (response.success) {
      setSummary(response.data);
    }
    setLoading(false);
  };

  const loadConversation = async () => {
    if (!conversationId) return;
    setLoading(true);
    const response = await api.getConversationAnalytics(conversationId);
    if (response.success) {
      setConversationData(response.data);
    }
    setLoading(false);
  };

  const loadUser = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    const response = await api.getUserAnalytics(phoneNumber);
    if (response.success) {
      setUserData(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="analytics">
      <div className="page-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <h2>Analytics</h2>
      </div>

      <div className="analytics-section">
        <h3>Overall Summary</h3>
        <div className="filter-row">
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Filter by prefix (e.g., 2024/03)"
          />
          <button onClick={loadSummary} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {summary && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{summary.statistics?.total || 0}</div>
              <div className="stat-label">Total Messages</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.statistics?.text_count || 0}</div>
              <div className="stat-label">Text Messages</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.statistics?.media_count || 0}</div>
              <div className="stat-label">Media Messages</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {Object.keys(summary.statistics?.by_conversation || {}).length}
              </div>
              <div className="stat-label">Conversations</div>
            </div>
          </div>
        )}

        {summary?.statistics && (
          <div className="details">
            <h4>Message Types</h4>
            <div className="type-list">
              {Object.entries(summary.statistics.by_type || {}).map(([type, count]) => (
                <div key={type} className="type-item">
                  <span className="type-name">{type}</span>
                  <span className="type-count">{count}</span>
                </div>
              ))}
            </div>

            {summary.statistics.time_range?.earliest && (
              <div className="time-range">
                <h4>Time Range</h4>
                <p>
                  <strong>From:</strong> {new Date(summary.statistics.time_range.earliest).toLocaleString()}
                </p>
                <p>
                  <strong>To:</strong> {new Date(summary.statistics.time_range.latest).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h3>Conversation Analytics</h3>
        <div className="filter-row">
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            placeholder="Enter conversation ID (e.g., conv_1234567890)"
          />
          <button onClick={loadConversation} disabled={loading || !conversationId}>
            Load
          </button>
        </div>

        {conversationData && (
          <div className="data-display">
            <pre>{JSON.stringify(conversationData, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h3>User Analytics</h3>
        <div className="filter-row">
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number"
          />
          <button onClick={loadUser} disabled={loading || !phoneNumber}>
            Load
          </button>
        </div>

        {userData && (
          <div className="data-display">
            <pre>{JSON.stringify(userData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
