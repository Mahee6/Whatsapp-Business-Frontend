const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Shared blob list cache — all callers within TTL reuse one request
const BLOB_CACHE_TTL = 10_000; // ms
let _blobCacheTime = 0;
let _blobCacheResult = null;
let _blobInflight = null; // deduplicates concurrent calls

class WhatsAppAPI {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkHealth() {
    return this.request('/health');
  }

  async sendText(to, text, previewUrl = false) {
    return this.request('/messages/text', {
      method: 'POST',
      body: JSON.stringify({ to, text, preview_url: previewUrl }),
    });
  }

  async sendImage(to, mediaLink, caption = null) {
    return this.request('/messages/image', {
      method: 'POST',
      body: JSON.stringify({ to, media_link: mediaLink, caption }),
    });
  }

  async sendVideo(to, mediaLink, caption = null) {
    return this.request('/messages/video', {
      method: 'POST',
      body: JSON.stringify({ to, media_link: mediaLink, caption }),
    });
  }

  async sendDocument(to, documentLink, caption = null, filename = null) {
    return this.request('/messages/document', {
      method: 'POST',
      body: JSON.stringify({ to, document_link: documentLink, caption, filename }),
    });
  }

  async sendAudio(to, audioLink) {
    return this.request('/messages/audio', {
      method: 'POST',
      body: JSON.stringify({ to, audio_link: audioLink }),
    });
  }

  async sendTemplate(to, templateName, languageCode = 'en_US', components = null) {
    return this.request('/messages/template', {
      method: 'POST',
      body: JSON.stringify({ to, template_name: templateName, language_code: languageCode, components }),
    });
  }

  async sendButtons(to, bodyText, buttons, headerText = null, footerText = null) {
    return this.request('/messages/interactive/buttons', {
      method: 'POST',
      body: JSON.stringify({ to, body_text: bodyText, buttons, header_text: headerText, footer_text: footerText }),
    });
  }

  async sendList(to, bodyText, buttonText, sections, headerText = null, footerText = null) {
    return this.request('/messages/interactive/list', {
      method: 'POST',
      body: JSON.stringify({ to, body_text: bodyText, button_text: buttonText, sections, header_text: headerText, footer_text: footerText }),
    });
  }

  async sendLocation(to, latitude, longitude, name = null, address = null) {
    return this.request('/messages/location', {
      method: 'POST',
      body: JSON.stringify({ to, latitude, longitude, name, address }),
    });
  }

  async sendReaction(to, messageId, emoji) {
    return this.request('/messages/reaction', {
      method: 'POST',
      body: JSON.stringify({ to, message_id: messageId, emoji }),
    });
  }

  async markAsRead(messageId) {
    return this.request('/messages/mark-read', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId }),
    });
  }

  async deleteMessage(path) {
    const result = await this.request('/blobs', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    });
    // Invalidate cache so next poll reflects the deletion
    _blobCacheTime = 0;
    _blobCacheResult = null;
    _blobInflight = null;
    return result;
  }

  async listBlobs(prefix = '') {
    // Only cache unprefixed full-list calls (used by sidebar + message loader)
    if (!prefix) {
      const now = Date.now();
      if (_blobCacheResult && now - _blobCacheTime < BLOB_CACHE_TTL) {
        return _blobCacheResult; // return cached
      }
      if (_blobInflight) {
        return _blobInflight; // deduplicate concurrent calls
      }
      _blobInflight = this.request('/blobs').then(result => {
        _blobCacheResult = result;
        _blobCacheTime = Date.now();
        _blobInflight = null;
        return result;
      });
      return _blobInflight;
    }
    // Prefixed calls (Storage browser) always go through
    return this.request(`/blobs?prefix=${encodeURIComponent(prefix)}`);
  }

  async getBlobContent(path) {
    return this.request(`/blobs/content?path=${encodeURIComponent(path)}`);
  }

  async listContacts() {
    return this.request('/contacts');
  }

  async saveContact(phoneNumber, name, note = '') {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify({ phone_number: phoneNumber, name, note }),
    });
  }

  async deleteContact(phoneNumber) {
    return this.request(`/contacts/${encodeURIComponent(phoneNumber)}`, {
      method: 'DELETE',
    });
  }

  async getAnalyticsSummary(prefix = '') {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    return this.request(`/analytics/summary${query}`);
  }

  async getConversationAnalytics(conversationId) {
    return this.request(`/analytics/conversation/${conversationId}`);
  }

  async getUserAnalytics(phoneNumber) {
    return this.request(`/analytics/user/${phoneNumber}`);
  }
}

export default new WhatsAppAPI();
