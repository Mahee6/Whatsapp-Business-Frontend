import { useState, useEffect } from 'react';
import api from '../services/api';
import './Storage.css';

function Storage() {
  const [loading, setLoading] = useState(false);
  const [blobs, setBlobs] = useState([]);
  const [prefix, setPrefix] = useState('');
  const [selectedBlob, setSelectedBlob] = useState(null);
  const [blobContent, setBlobContent] = useState(null);

  const loadBlobs = async () => {
    setLoading(true);
    const response = await api.listBlobs(prefix);
    if (response.success) {
      setBlobs(response.data.blobs || []);
    }
    setLoading(false);
  };

  const viewBlob = async (blobName) => {
    setSelectedBlob(blobName);
    setLoading(true);
    const response = await api.getBlobContent(blobName);
    if (response.success) {
      setBlobContent(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBlobs();
  }, []);

  return (
    <div className="storage">
      <div className="page-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        <h2>Storage Browser</h2>
      </div>

      <div className="filter-section">
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Filter by prefix (e.g., 2024/03/22)"
        />
        <button onClick={loadBlobs} disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      <div className="storage-layout">
        <div className="blob-list">
          <h3>Files ({blobs.length})</h3>
          {blobs.length === 0 ? (
            <p className="empty-state">No files found</p>
          ) : (
            <div className="blobs">
              {blobs.map((blob) => (
                <div
                  key={blob.name}
                  className={`blob-item ${selectedBlob === blob.name ? 'active' : ''}`}
                  onClick={() => viewBlob(blob.name)}
                >
                  <div className="blob-icon">
                    {blob.name.endsWith('.json') ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                      </svg>
                    )}
                  </div>
                  <div className="blob-info">
                    <div className="blob-name">{blob.name.split('/').pop()}</div>
                    <div className="blob-path">{blob.name}</div>
                    <div className="blob-meta">
                      {(blob.size / 1024).toFixed(2)} KB • {new Date(blob.last_modified).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="blob-viewer">
          <h3>Content Viewer</h3>
          {!selectedBlob ? (
            <p className="empty-state">Select a file to view its content</p>
          ) : loading ? (
            <p className="empty-state">Loading...</p>
          ) : blobContent ? (
            <div className="content-display">
              <div className="content-header">
                <span className="content-title">{selectedBlob}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(blobContent, null, 2));
                    alert('Copied to clipboard!');
                  }}
                  className="btn-copy"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Copy
                </button>
              </div>
              <pre>{JSON.stringify(blobContent, null, 2)}</pre>
            </div>
          ) : (
            <p className="empty-state">Failed to load content</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Storage;
