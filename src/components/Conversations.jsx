import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './Conversations.css';

const SEEN_KEY = 'wa_seen_counts'; // localStorage key

function getSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}
function setSeen(seen) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

function Conversations({ initialConvId = null }) {
  const [conversations, setConversations] = useState([]);
  const [unread, setUnread] = useState({});         // { convId: number }
  const [contacts, setContacts] = useState([]);      // List of saved contacts
  const [selectedConv, setSelectedConv] = useState(initialConvId);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [deletingId, setDeletingId] = useState(null);
  const messagesEndRef = useRef(null);
  const blobPathMap = useRef({});
  const messageCache = useRef({});
  const selectedConvRef = useRef(selectedConv); // readable inside interval callbacks

  // Keep ref in sync with state
  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

  const markAsRead = (convId, count) => {
    const seen = getSeen();
    seen[convId] = count;
    setSeen(seen);
    setUnread(prev => { const n = { ...prev }; delete n[convId]; return n; });
  }; 

  useEffect(() => {
    loadConversations();
    loadContacts();
    const interval = setInterval(() => {
      loadConversations();
      loadContacts();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialConvId) setSelectedConv(initialConvId);
  }, [initialConvId]);

  useEffect(() => {
    if (selectedConv) {
      messageCache.current = {};
      loadMessages(selectedConv);
      const interval = setInterval(() => loadMessages(selectedConv), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedConv]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (selectedConv) {
      const conv = conversations.find(c => c.id === selectedConv);
      if (conv) markAsRead(selectedConv, conv.messageCount);
    }
  }, [selectedConv, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  const loadConversations = async () => {
    const response = await api.listBlobs();
    if (response.success) {
      const blobs = response.data.blobs || [];
      const convMap = new Map();
      for (const blob of blobs) {
        if (blob.name.includes('/messages/') && blob.name.endsWith('.json')) {
          const parts = blob.name.split('/');
          const convId = parts[3];
          if (!convMap.has(convId)) {
            convMap.set(convId, { id: convId, lastMessage: new Date(blob.last_modified), messageCount: 1 });
          } else {
            const conv = convMap.get(convId);
            conv.messageCount++;
            if (new Date(blob.last_modified) > conv.lastMessage) conv.lastMessage = new Date(blob.last_modified);
          }
        }
      }
      const convList = Array.from(convMap.values()).sort((a, b) => b.lastMessage - a.lastMessage);
      setConversations(convList);

      // Compute unread: messages seen since last time user opened this conv
      const seen = getSeen();
      const newUnread = {};
      for (const conv of convList) {
        const seenCount = seen[conv.id] || 0;
        const diff = conv.messageCount - seenCount;
        if (diff > 0 && conv.id !== selectedConvRef.current) {
          newUnread[conv.id] = diff;
        }
      }
      setUnread(newUnread);
    }
  };
  
  const loadContacts = async () => {
    const res = await api.listContacts();
    if (res.success) setContacts(res.data.contacts || []);
  };

  const getDisplayName = (convId) => {
    if (!convId) return '';
    const phone = convId.replace('conv_', '');
    const contact = contacts.find(c => c.phone_number === phone);
    return contact ? contact.name : phone;
  };

  const loadMessages = async (convId) => {
    setLoading(true);
    const response = await api.listBlobs();
    if (response.success) {
      const blobs = response.data.blobs || [];
      const messageBlobs = blobs.filter(b =>
        b.name.includes(convId) && b.name.includes('/messages/') && b.name.endsWith('.json')
      );

      // Only fetch blobs not already in cache
      const newBlobs = messageBlobs.filter(b => !messageCache.current[b.name]);
      await Promise.all(newBlobs.map(async (blob) => {
        const content = await api.getBlobContent(blob.name);
        if (content.success) {
          messageCache.current[blob.name] = content.data;
          blobPathMap.current[content.data.message_id] = blob.name;
        }
      }));

      // Build message list from cache (only blobs still present in storage)
      const activePaths = new Set(messageBlobs.map(b => b.name));
      const msgs = Object.entries(messageCache.current)
        .filter(([path]) => activePaths.has(path))
        .map(([, data]) => data)
        .sort((a, b) => a.timestamp - b.timestamp);

      setMessages(msgs);
    }
    setLoading(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConv) return;

    const text = messageText.trim();
    setMessageText('');

    // Optimistic: show message immediately with a temp id
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId,
      conversation_id: selectedConv,
      user: null,
      timestamp: Math.floor(Date.now() / 1000),
      message_type: 'text',
      text_body: text,
      _pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    setSending(true);
    const phoneNumber = selectedConv.replace('conv_', '');
    const response = await api.sendText(phoneNumber, text);

    if (response.success) {
      // Replace optimistic message with real one (remove pending flag)
      setMessages(prev => prev.map(m =>
        m.message_id === tempId ? { ...optimisticMsg, _pending: false } : m
      ));
      // Refresh in background to get the server-saved version
      setTimeout(() => loadMessages(selectedConv), 2000);
    } else {
      // Mark as failed
      setMessages(prev => prev.map(m =>
        m.message_id === tempId ? { ...optimisticMsg, _failed: true } : m
      ));
    }
    setSending(false);
  };

  // ── Delete logic ──────────────────────────────────────────────
  const openContextMenu = (e, msg) => {
    e.preventDefault();
    e.stopPropagation(); // prevent window mousedown from closing immediately
    const blobPath = blobPathMap.current[msg.message_id];
    if (!blobPath) return;
    setContextMenu({ x: e.clientX, y: e.clientY, msg, blobPath });
  };

  const handleLongPressEnd = () => {}; 

  const deleteMessage = async () => {
    if (!contextMenu) return;
    const { msg, blobPath } = contextMenu;
    setContextMenu(null);
    setDeletingId(msg.message_id);

    const response = await api.deleteMessage(blobPath);
    if (response.success) {
      setMessages(prev => prev.filter(m => m.message_id !== msg.message_id));
      delete blobPathMap.current[msg.message_id];
      delete messageCache.current[blobPath]; // remove from cache too
      // Update sidebar count
      setConversations(prev => prev.map(c => {
        if (c.id === selectedConv) {
          const newCount = c.messageCount - 1;
          return newCount <= 0 ? null : { ...c, messageCount: newCount };
        }
        return c;
      }).filter(Boolean));
    }
    setDeletingId(null);
  };
  // ─────────────────────────────────────────────────────────────

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp * 1000);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const resolveMediaPath = (msg) => {
    if (!msg.media_id) return null;
    const ts = msg.timestamp;
    const date = new Date(ts * 1000);
    const datePrefix = `${date.getUTCFullYear()}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCDate().toString().padStart(2, '0')}`;
    const mapping = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
      "application/pdf": "pdf", "text/plain": "txt"
    };
    const ext = mapping[msg.media_mime_type] || "bin";
    return `${datePrefix}/${msg.conversation_id}/media/${msg.media_id}.${ext}`;
  };

  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedConv) return;

    setSending(true);
    const res = await api.uploadFile(file, `uploads/${selectedConv}`);
    if (res.success) {
      const filePath = res.data.path;
      const mediaUrl = api.getMediaUrl(filePath);
      const phoneNumber = selectedConv.replace('conv_', '');

      if (file.type.startsWith('image/')) {
        await api.sendImage(phoneNumber, mediaUrl);
      } else {
        await api.sendDocument(phoneNumber, mediaUrl, null, file.name);
      }
      loadMessages(selectedConv);
    } else {
      alert("Upload failed: " + res.error);
    }
    setSending(false);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="conversations">
      <div className="conversations-layout">
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h2>Conversations</h2>
            <button onClick={loadConversations} className="btn-refresh" title="Refresh conversations">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
              </svg>
            </button>
          </div>
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <p>No conversations yet</p>
                <small>Messages will appear here</small>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${selectedConv === conv.id ? 'active' : ''}`}
                  onClick={() => setSelectedConv(conv.id)}
                >
                  <div className="conv-avatar">{getDisplayName(conv.id).substring(0, 2).toUpperCase()}</div>
                  <div className="conv-info">
                    <div className="conv-header">
                      <span className="conv-name">{getDisplayName(conv.id)}</span>
                      <span className="conv-time">{formatDate(conv.lastMessage / 1000)}</span>
                    </div>
                    <div className="conv-preview">
                      <span className="message-count">{conv.messageCount} messages</span>
                      {unread[conv.id] > 0 && (
                        <span className="unread-badge">{unread[conv.id]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-area">
          {!selectedConv ? (
            <div className="no-chat-selected">
              <svg className="no-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to view messages</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">{getDisplayName(selectedConv).substring(0, 2).toUpperCase()}</div>
                  <div>
                    <h3>{getDisplayName(selectedConv)}</h3>
                    {getDisplayName(selectedConv) !== selectedConv.replace('conv_', '') && (
                      <div className="chat-sub-number">{selectedConv.replace('conv_', '')}</div>
                    )}
                  </div>
                </div>
                <button onClick={() => loadMessages(selectedConv)} className="btn-refresh-chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
              </div>

              <div className="messages-container">
                {loading && messages.length === 0 ? (
                  <div className="loading-messages">Loading messages...</div>
                ) : (
                  <>
                    {messages.map((msg, index) => {
                      const showDate = index === 0 ||
                        formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp);
                      const isDeleting = deletingId === msg.message_id;
                      const mediaPath = resolveMediaPath(msg);
                      const mediaUrl = mediaPath ? api.getMediaUrl(mediaPath) : msg.media_link;

                      return (
                        <div key={msg.message_id || index}>
                          {showDate && (
                            <div className="date-divider"><span>{formatDate(msg.timestamp)}</span></div>
                          )}
                          <div
                            className={`message ${msg.user ? 'received' : 'sent'} ${isDeleting ? 'deleting' : ''} ${msg._pending ? 'pending' : ''} ${msg._failed ? 'failed' : ''}`}
                            onContextMenu={(e) => openContextMenu(e, msg)}
                          >
                            <div className="message-content">
                              {msg.text_body && <div className="message-text">{msg.text_body}</div>}

                              {msg.message_type === 'image' && (
                                <div className="message-media-container">
                                  {mediaUrl ? (
                                    <div className="image-wrapper">
                                      <img 
                                        src={mediaUrl} 
                                        alt="Media" 
                                        className="chat-image"
                                        onClick={() => window.open(mediaUrl, '_blank')}
                                      />
                                    </div>
                                  ) : (
                                    <div className="message-media">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                      </svg>
                                      <span>Image</span>
                                    </div>
                                  )}
                                  {msg.caption && <div className="media-caption">{msg.caption}</div>}
                                </div>
                              )}
                              {msg.message_type === 'video' && (
                                <div className="message-media-container">
                                  {mediaUrl ? (
                                    <div className="video-wrapper">
                                      <video controls className="chat-video">
                                        <source src={mediaUrl} />
                                        Your browser does not support the video tag.
                                      </video>
                                    </div>
                                  ) : (
                                    <div className="message-media">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                      </svg>
                                      <span>Video</span>
                                    </div>
                                  )}
                                  {msg.caption && <div className="media-caption">{msg.caption}</div>}
                                </div>
                              )}
                              {msg.message_type === 'audio' && (
                                <div className="message-media">
                                  {mediaUrl ? (
                                    <audio controls className="chat-audio">
                                      <source src={mediaUrl} />
                                    </audio>
                                  ) : (
                                    <>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-2c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
                                      </svg>
                                      <span>Audio</span>
                                    </>
                                  )}
                                </div>
                              )}
                              {msg.message_type === 'document' && (
                                <div className="message-media document">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                                  </svg>
                                  <div className="doc-info">
                                    <span className="doc-name">{msg.filename || 'Document'}</span>
                                    {mediaUrl && (
                                      <a href={mediaUrl} target="_blank" rel="noreferrer" className="btn-download">
                                        Download
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                              {msg.message_type === 'location' && msg.location && (
                                <div className="message-media">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  <span>Location</span>
                                  {msg.location.name && <div>{msg.location.name}</div>}
                                </div>
                              )}
                              
                              {msg.message_type === 'sticker' && (
                                <div className="message-media-container sticker">
                                  {mediaUrl ? (
                                    <img src={mediaUrl} alt="Sticker" className="chat-sticker" />
                                  ) : (
                                    <div className="message-media">
                                      <span>Sticker</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {msg.message_type === 'reaction' && msg.reaction && (
                                <div className="message-reaction">
                                  <span className="reaction-emoji">{msg.reaction.emoji}</span>
                                </div>
                              )}

                              <div className="message-time">
                                {formatTime(msg.timestamp)}
                                {msg._pending && (
                                  <svg className="msg-status pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                  </svg>
                                )}
                                {msg._failed && (
                                  <svg className="msg-status failed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                  </svg>
                                )}
                                {!msg._pending && !msg._failed && !msg.user && (
                                  <svg className="msg-status sent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <form className="message-input-area" onSubmit={sendMessage}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button 
                  type="button" 
                  className="btn-attach" 
                  onClick={() => fileInputRef.current.click()}
                  disabled={sending}
                  title="Attach file"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !messageText.trim()} title="Send message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="msg-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="ctx-delete" onClick={deleteMessage}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
            Delete message
          </button>
        </div>
      )}
    </div>
  );
}

export default Conversations;
