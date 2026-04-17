import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './SendMessage.css';

function SendMessage({ initialPhone = '' }) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [messageType, setMessageType] = useState('text');
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (initialPhone) setPhoneNumber(initialPhone);
    loadContacts();
  }, [initialPhone]);
  
  const loadContacts = async () => {
    const res = await api.listContacts();
    if (res.success) setContacts(res.data.contacts || []);
  };
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [text, setText] = useState('');
  const [previewUrl, setPreviewUrl] = useState(false);

  const [mediaLink, setMediaLink] = useState('');
  const [caption, setCaption] = useState('');
  const [filename, setFilename] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');

  const [bodyText, setBodyText] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState([{ id: 'btn1', title: 'Option 1' }]);

  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const res = await api.uploadFile(file, `uploads/conv_${phoneNumber || 'manual'}`);
    if (res.success) {
      const mediaUrl = api.getMediaUrl(res.data.path);
      setMediaLink(mediaUrl);
      if (messageType === 'document' && !filename) {
        setFilename(file.name);
      }
    } else {
      alert("Upload failed: " + res.error);
    }
    setUploading(false);
    e.target.value = ''; // Reset
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    let response;

    try {
      switch (messageType) {
        case 'text':
          response = await api.sendText(phoneNumber, text, previewUrl);
          break;
        case 'image':
          response = await api.sendImage(phoneNumber, mediaLink, caption);
          break;
        case 'video':
          response = await api.sendVideo(phoneNumber, mediaLink, caption);
          break;
        case 'document':
          response = await api.sendDocument(phoneNumber, mediaLink, caption, filename);
          break;
        case 'audio':
          response = await api.sendAudio(phoneNumber, mediaLink);
          break;
        case 'location':
          response = await api.sendLocation(
            phoneNumber,
            parseFloat(latitude),
            parseFloat(longitude),
            locationName || null,
            address || null
          );
          break;
        case 'buttons':
          response = await api.sendButtons(
            phoneNumber,
            bodyText,
            buttons,
            headerText || null,
            footerText || null
          );
          break;
        case 'template':
          response = await api.sendTemplate(phoneNumber, templateName, languageCode);
          break;
        default:
          response = { success: false, error: 'Unknown message type' };
      }

      setResult(response);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { id: `btn${buttons.length + 1}`, title: `Option ${buttons.length + 1}` }]);
    }
  };

  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index, field, value) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  return (
    <div className="send-message">
      <div className="page-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        <h2>Send Message</h2>
      </div>
      
      <form onSubmit={handleSend}>
        <div className="form-group">
          <label>Phone Number (with country code)</label>
          <div className="input-with-label">
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Mob No"
              required
            />
            {contacts.find(c => c.phone_number === phoneNumber) && (
              <span className="contact-name-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                {contacts.find(c => c.phone_number === phoneNumber).name}
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Message Type</label>
          <select value={messageType} onChange={(e) => setMessageType(e.target.value)}>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
            <option value="audio">Audio</option>
            <option value="location">Location</option>
            <option value="buttons">Interactive Buttons</option>
            <option value="template">Template</option>
          </select>
        </div>

        {messageType === 'text' && (
          <>
            <div className="form-group">
              <label>Message Text</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your message..."
                rows="4"
                required
              />
            </div>
            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.checked)}
                />
                Enable URL Preview
              </label>
            </div>
          </>
        )}

        {['image', 'video', 'document', 'audio'].includes(messageType) && (
          <>
            <div className="form-group">
              <label>Media URL</label>
              <div className="input-with-button">
                <input
                  type="url"
                  value={mediaLink}
                  onChange={(e) => setMediaLink(e.target.value)}
                  placeholder="https://example.com/media.jpg"
                  required
                />
                <button 
                  type="button" 
                  className="btn-upload" 
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                >
                  {uploading ? '...' : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  )}
                  Upload
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
            {messageType !== 'audio' && (
              <div className="form-group">
                <label>Caption (optional)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                />
              </div>
            )}
            {messageType === 'document' && (
              <div className="form-group">
                <label>Filename (optional)</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="document.pdf"
                />
              </div>
            )}
          </>
        )}

        {messageType === 'location' && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="37.7749"
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-122.4194"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Location Name (optional)</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="San Francisco"
              />
            </div>
            <div className="form-group">
              <label>Address (optional)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>
          </>
        )}

        {messageType === 'buttons' && (
          <>
            <div className="form-group">
              <label>Header Text (optional)</label>
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Quick Options"
              />
            </div>
            <div className="form-group">
              <label>Body Text</label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Please choose an option:"
                rows="3"
                required
              />
            </div>
            <div className="form-group">
              <label>Footer Text (optional)</label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Powered by WhatsApp API"
              />
            </div>
            <div className="form-group">
              <label>Buttons (max 3)</label>
              {buttons.map((btn, index) => (
                <div key={index} className="button-row">
                  <input
                    type="text"
                    value={btn.id}
                    onChange={(e) => updateButton(index, 'id', e.target.value)}
                    placeholder="Button ID"
                  />
                  <input
                    type="text"
                    value={btn.title}
                    onChange={(e) => updateButton(index, 'title', e.target.value)}
                    placeholder="Button Title"
                  />
                  {buttons.length > 1 && (
                    <button type="button" onClick={() => removeButton(index)} className="btn-remove">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {buttons.length < 3 && (
                <button type="button" onClick={addButton} className="btn-add">
                  + Add Button
                </button>
              )}
            </div>
          </>
        )}

        {messageType === 'template' && (
          <>
            <div className="form-group">
              <label>Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="hello_world"
                required
              />
            </div>
            <div className="form-group">
              <label>Language Code</label>
              <input
                type="text"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                placeholder="en_US"
                required
              />
            </div>
          </>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          <div className="result-header">
            {result.success ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <h3>Success</h3>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <h3>Error</h3>
              </>
            )}
          </div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default SendMessage;
