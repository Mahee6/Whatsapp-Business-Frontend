import { useState, useEffect } from 'react';
import api from '../services/api';
import './Contacts.css';

function Contacts({ onOpenChat }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ phone_number: '', name: '', note: '' });
  const [editingPhone, setEditingPhone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    setLoading(true);
    const res = await api.listContacts();
    if (res.success) setContacts(res.data.contacts || []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingPhone(null);
    setForm({ phone_number: '', name: '', note: '' });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditingPhone(c.phone_number);
    setForm({ phone_number: c.phone_number, name: c.name, note: c.note || '' });
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditingPhone(null);
    setForm({ phone_number: '', name: '', note: '' });
    setShowForm(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.phone_number.trim() || !form.name.trim()) return;
    setSaving(true);
    const res = await api.saveContact(form.phone_number.trim(), form.name.trim(), form.note.trim());
    if (res.success) { await loadContacts(); cancelForm(); }
    setSaving(false);
  };

  const handleDelete = async (phoneNumber) => {
    if (!window.confirm('Delete this contact?')) return;
    await api.deleteContact(phoneNumber);
    setContacts(prev => prev.filter(c => c.phone_number !== phoneNumber));
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search)
  );

  return (
    <div className="contacts-page">
      <div className="contacts-layout">

        {/* Left — list */}
        <div className="contacts-panel">
          <div className="contacts-header">
            <h2>Contacts</h2>
            <button className="btn-add-contact" onClick={openAdd} title="New contact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
              <span>New Contact</span>
            </button>
          </div>

          <div className="contacts-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Search by name or number..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="contacts-list">
            {loading ? (
              <div className="contacts-empty">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="contacts-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <p>{search ? 'No results' : 'No contacts yet'}</p>
              </div>
            ) : (
              filtered.map(c => (
                <div key={c.phone_number} className="contact-item">
                  <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{c.name}</div>
                    <div className="contact-phone">{c.phone_number}</div>
                    {c.note && <div className="contact-note">{c.note}</div>}
                  </div>
                  <div className="contact-actions">
                    <button className="btn-send-msg" onClick={() => onOpenChat(c.phone_number)} title="Open chat">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>
                    </button>
                    <button className="btn-edit" onClick={() => openEdit(c)} title="Edit">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="btn-del" onClick={() => handleDelete(c.phone_number)} title="Delete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — form panel */}
        <div className={`contact-form-panel ${showForm ? 'open' : ''}`}>
          <div className="form-panel-header">
            <h3>{editingPhone ? 'Edit Contact' : 'New Contact'}</h3>
            {showForm && <button className="btn-close-form" onClick={cancelForm}>✕</button>}
          </div>

          {showForm ? (
            <>
              {/* Scrollable fields */}
              <form id="contact-form" className="contact-form" onSubmit={handleSave}>
                <div className="form-avatar-preview">
                  {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 911234567890"
                    value={form.phone_number}
                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    disabled={!!editingPhone}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Note (optional)</label>
                  <textarea
                    placeholder="Add a note..."
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    rows={3}
                  />
                </div>
              </form>

              {/* Sticky footer — always visible */}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={cancelForm}>Cancel</button>
                <button type="submit" form="contact-form" className="btn-save" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </>
          ) : (
            <div className="form-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <p>Click "New Contact" to add one</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Contacts;
