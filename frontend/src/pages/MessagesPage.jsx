import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE, API_ORIGIN } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const BASE_URL = API_ORIGIN || 'http://localhost:5000';

const getChatClient = () => {
  const client = axios.create({ baseURL: API_BASE });
  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('token');
  const token = adminToken || userToken;
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  return client;
};

export default function MessagesPage() {
  const { user, logout } = useAuth();
  const isAdmin = Boolean(localStorage.getItem('adminToken'));
  const currentUserId = isAdmin ? 'admin' : user?._id;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetPartnerParam = searchParams.get('to');
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'contacts'
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Message input state
  const [textInput, setTextInput] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [sending, setSending] = useState(false);

  // Image lightbox
  const [lightboxImg, setLightboxImg] = useState(null);

  const fileInputRef = useRef();
  const messagesEndRef = useRef();
  const chatMessagesContainerRef = useRef();

  // Scroll to bottom helper
  const scrollToBottom = (instant = false) => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTo({
        top: chatMessagesContainerRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
    }
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'end',
    });
  };

  // Fetch conversations
  const fetchConversations = async (silent = false) => {
    try {
      const client = getChatClient();
      const res = await client.get('/chat/conversations');
      const validConvs = (res.data.conversations || []).filter(
        (c) => c.partner && c.partner.name && !c.partner.name.toLowerCase().includes('deleted')
      );
      setConversations(validConvs);
    } catch (err) {
      if (!silent) console.error('Failed to load conversations', err);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const client = getChatClient();
      const res = await client.get('/chat/contacts');
      setContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Failed to load contacts', err);
    }
  };

  // Fetch messages for active partner
  const fetchActiveMessages = async (partnerId, silent = false) => {
    if (!partnerId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const client = getChatClient();
      const res = await client.get(`/chat/messages/${partnerId}`);
      setMessages(res.data.messages || []);
      if (res.data.partner) {
        setActivePartner(res.data.partner);
      }
      if (!silent) {
        // Auto load latest chat immediately upon opening so user does not need to scroll down
        setTimeout(() => scrollToBottom(true), 20);
        setTimeout(() => scrollToBottom(true), 120);
        setTimeout(() => scrollToBottom(false), 300);
      }
    } catch (err) {
      if (!silent) toast.error('Failed to load message history');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchContacts();

    // Heartbeat to keep current user active
    const sendHeartbeat = async () => {
      try {
        const client = getChatClient();
        await client.post('/chat/heartbeat');
      } catch {}
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(hbInterval);
  }, []);

  // Handle URL param ?to=admin or ?to=<id>
  useEffect(() => {
    if (targetPartnerParam) {
      fetchActiveMessages(targetPartnerParam);
    }
  }, [targetPartnerParam]);

  // Periodic polling for real-time chat updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      if (activePartner?._id) {
        fetchActiveMessages(activePartner._id, true);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [activePartner]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSelectPartner = (partner) => {
    setActivePartner(partner);
    fetchActiveMessages(partner._id);
  };

  const handleBackToConversations = () => {
    setActivePartner(null);
    setMessages([]);
    navigate('/messages', { replace: true });
  };

  // Attachment handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return toast.error('Only image and PDF files are allowed.');
    }
    if (file.size > 20 * 1024 * 1024) {
      return toast.error('File size must be under 20MB.');
    }

    setAttachmentFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setAttachmentPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview('pdf');
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!activePartner) return;
    if (!textInput.trim() && !attachmentFile) return;

    setSending(true);
    try {
      const client = getChatClient();
      const formData = new FormData();
      formData.append('recipientId', activePartner._id);
      if (textInput.trim()) {
        formData.append('text', textInput.trim());
      }
      if (attachmentFile) {
        formData.append('media', attachmentFile);
      }

      const res = await client.post('/chat/message', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Append new message locally
      setMessages((prev) => [...prev, res.data.data]);
      setTextInput('');
      removeAttachment();
      fetchConversations(true);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url}`;
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isUserActiveNow = (target) => {
    if (!target) return false;
    let isOnline = true;
    let lastSeen = target;
    if (typeof target === 'object') {
      isOnline = target.isOnline !== undefined ? Boolean(target.isOnline) : true;
      lastSeen = target.lastSeen;
    }
    if (!lastSeen) return false;
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    return isOnline && diffMs < 50 * 1000;
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'offline';
    const date = new Date(lastSeen);
    const now = Date.now();
    const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filtered lists
  const filteredConversations = conversations.filter((c) => {
    const name = c.partner?.name?.toLowerCase() || '';
    const email = c.partner?.email?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const filteredContacts = contacts.filter((c) => {
    const name = c.name?.toLowerCase() || '';
    const email = c.email?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="messenger-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button
              id="messenger-back-btn"
              className="btn btn-outline btn-sm"
              onClick={() => navigate(isAdmin ? '/admin' : '/profile')}
            >
              ← {isAdmin ? 'Dashboard' : 'Profile'}
            </button>
            <div className="navbar-logo">
              <div className="navbar-logo-icon">💬</div>
              <span className="navbar-logo-text">Messenger</span>
            </div>
          </div>
          <div className="navbar-actions">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isAdmin ? '👑 Exam Authority' : `👤 ${user?.name || 'Student'}`}
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (isAdmin) {
                  localStorage.removeItem('adminToken');
                  navigate('/admin/login');
                } else {
                  logout();
                  navigate('/login');
                }
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="messenger-container">
        <div className="messenger-card glass">
          {/* Left Sidebar */}
          <div className={`messenger-sidebar ${activePartner ? 'has-active-chat' : ''}`}>
            <div className="messenger-sidebar-header">
              <div className="messenger-sidebar-title">
                <h2>💬 Chats</h2>
              </div>
              <input
                id="chat-search-input"
                className="messenger-search-input"
                placeholder="Search conversations or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sidebar Tabs */}
            <div className="messenger-tabs">
              <button
                id="tab-chats-btn"
                className={`messenger-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => setActiveTab('chats')}
              >
                Recent
              </button>
              <button
                id="tab-contacts-btn"
                className={`messenger-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
                onClick={() => setActiveTab('contacts')}
              >
                Contacts ({contacts.length})
              </button>
            </div>

            {/* Conversation / Contact List */}
            <div className="messenger-list">
              {activeTab === 'chats' ? (
                loadingConversations ? (
                  <div className="loader-wrap"><div className="spinner" /></div>
                ) : filteredConversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                    No conversations yet.<br />
                    Click <strong>Contacts</strong> to start a chat!
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = activePartner?._id === conv.partner?._id;
                    const isAuthority = conv.partner?.role === 'authority' || conv.partner?._id === 'admin';
                    const avatarUrl = conv.partner?.photo ? getMediaUrl(conv.partner.photo) : null;
                    const initials = conv.partner?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

                    let snippet = conv.lastMessage?.text || '';
                    if (!snippet && conv.lastMessage?.mediaType === 'image') snippet = '📷 Photo';
                    if (!snippet && conv.lastMessage?.mediaType === 'pdf') snippet = `📄 ${conv.lastMessage?.mediaName || 'Document'}`;

                    const isOnline = isUserActiveNow(conv.partner);

                    return (
                      <div
                        key={conv.conversationId}
                        id={`conv-item-${conv.partner?._id}`}
                        className={`conversation-item ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectPartner(conv.partner)}
                      >
                        <div className="chat-avatar-container">
                          <div className={`chat-avatar-wrap ${isAuthority ? 'authority' : ''}`}>
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" className="chat-avatar-img" />
                            ) : (
                              isAuthority ? '👑' : initials
                            )}
                          </div>
                          <span
                            className={`avatar-status-dot ${isOnline ? 'online' : 'offline'}`}
                            title={isOnline ? 'Active now' : `Last seen ${formatLastSeen(conv.partner?.lastSeen)}`}
                          />
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-header-row">
                            <div className="conversation-partner-name">
                              {conv.partner?.name}
                              {isAuthority && <span className="authority-tag">Authority</span>}
                            </div>
                            <span className="conversation-time">
                              {formatTimestamp(conv.lastMessage?.createdAt)}
                            </span>
                          </div>
                          <div className="conversation-snippet-row">
                            <span className={`conversation-snippet ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                              {snippet}
                            </span>
                            {conv.unreadCount > 0 && (
                              <span className="nav-unread-badge">{conv.unreadCount}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* Contacts List */
                filteredContacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    No users found.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isAuthority = c.role === 'authority' || c._id === 'admin';
                    const avatarUrl = c.photo ? getMediaUrl(c.photo) : null;
                    const initials = c.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
                    const isOnline = isUserActiveNow(c);

                    return (
                      <div
                        key={c._id}
                        id={`contact-item-${c._id}`}
                        className={`conversation-item ${activePartner?._id === c._id ? 'active' : ''}`}
                        onClick={() => handleSelectPartner(c)}
                      >
                        <div className="chat-avatar-container">
                          <div className={`chat-avatar-wrap ${isAuthority ? 'authority' : ''}`}>
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" className="chat-avatar-img" />
                            ) : (
                              isAuthority ? '👑' : initials
                            )}
                          </div>
                          <span
                            className={`avatar-status-dot ${isOnline ? 'online' : 'offline'}`}
                            title={isOnline ? 'Active now' : `Last seen ${formatLastSeen(c.lastSeen)}`}
                          />
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-header-row">
                            <div className="conversation-partner-name">
                              {c.name}
                              {isAuthority && <span className="authority-tag">Authority</span>}
                            </div>
                          </div>
                          <div className="conversation-snippet">
                            {isOnline ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>🟢 Active now</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>
                                Last seen {formatLastSeen(c.lastSeen)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* Right Chat Room Area */}
          <div className={`messenger-main ${!activePartner ? 'no-active-chat' : ''}`}>
            {activePartner ? (
              <>
                {/* Header */}
                <div className="chat-room-header">
                  <div className="chat-room-header-left">
                    <button
                      type="button"
                      className="chat-back-btn"
                      onClick={handleBackToConversations}
                      title="Back to conversation list"
                      id="back-to-conversations-btn"
                    >
                      <span className="chat-back-icon">←</span>
                      <span className="chat-back-text">Back</span>
                    </button>
                    <div className="chat-room-partner">
                      <div className="chat-avatar-container">
                        <div className={`chat-avatar-wrap ${activePartner.role === 'authority' ? 'authority' : ''}`}>
                          {activePartner.photo ? (
                            <img src={getMediaUrl(activePartner.photo)} alt="" className="chat-avatar-img" />
                          ) : (
                            activePartner.role === 'authority' ? '👑' : (activePartner.name?.[0] || '?')
                          )}
                        </div>
                        <span
                          className={`avatar-status-dot ${isUserActiveNow(activePartner) ? 'online' : 'offline'}`}
                          title={isUserActiveNow(activePartner) ? 'Active now' : `Last seen ${formatLastSeen(activePartner.lastSeen)}`}
                        />
                      </div>
                      <div className="chat-room-partner-info">
                        <h3>
                          {activePartner.name}
                          {activePartner.role === 'authority' && (
                            <span className="authority-tag">Authority</span>
                          )}
                        </h3>
                        <div className="partner-status-row">
                          {isUserActiveNow(activePartner) ? (
                            <span className="status-badge-active">
                              <span className="active-green-dot" />
                              Active now
                            </span>
                          ) : (
                            <span className="status-badge-offline">
                              <span className="offline-gray-dot" />
                              Last seen {formatLastSeen(activePartner.lastSeen)}
                            </span>
                          )}
                          {activePartner.title && (
                            <span className="partner-title-sub">• {activePartner.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages List */}
                <div className="chat-messages" ref={chatMessagesContainerRef}>
                  {loadingMessages ? (
                    <div className="loader-wrap"><div className="spinner" /></div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                      <div className="chat-empty-icon">👋</div>
                      <h4>Say Hello to {activePartner.name}!</h4>
                      <p>Send a message or attach images and PDF files.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      // Partner is the receiver if current user sent it, or partner is the sender if incoming
                      const isPartnerSender = activePartner && String(msg.senderId) === String(activePartner._id);
                      const isOutgoing = !isPartnerSender;

                      // Avatars (only for incoming messages)
                      const incomingAvatar = msg.senderPhoto
                        ? getMediaUrl(msg.senderPhoto)
                        : (activePartner?.photo ? getMediaUrl(activePartner.photo) : null);
                      const incomingIsAuthority = msg.senderRole === 'authority' || msg.senderId === 'admin' || activePartner?.role === 'authority' || activePartner?._id === 'admin';
                      const incomingInitial = msg.senderName?.[0] || activePartner?.name?.[0] || '?';

                      return (
                        <div
                          key={msg._id}
                          className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                        >
                          {/* Small Round Profile Photo on Left ONLY for Incoming (Receiver side) */}
                          {!isOutgoing && (
                            <div
                              className={`message-avatar-wrap ${incomingIsAuthority ? 'authority' : ''}`}
                              title={msg.senderName || activePartner?.name}
                            >
                              {incomingAvatar ? (
                                <img src={incomingAvatar} alt="" className="message-avatar-img" />
                              ) : (
                                incomingIsAuthority ? '👑' : incomingInitial
                              )}
                            </div>
                          )}

                          <div className="message-bubble-wrapper">
                            <span className="message-sender-name">
                              {isOutgoing ? 'You' : (msg.senderName || activePartner?.name)}
                            </span>

                            <div className="message-bubble">
                              {/* Media Attachment */}
                              {msg.mediaType === 'image' && (
                                <img
                                  src={getMediaUrl(msg.mediaUrl)}
                                  alt="attachment"
                                  className="message-media-image"
                                  onLoad={() => scrollToBottom(false)}
                                  onClick={() => setLightboxImg(getMediaUrl(msg.mediaUrl))}
                                  title="Click to view full size"
                                />
                              )}

                              {msg.mediaType === 'pdf' && (
                                <a
                                  href={getMediaUrl(msg.mediaUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="message-media-pdf"
                                  title="Click to view or download PDF"
                                >
                                  <span className="pdf-icon">📄</span>
                                  <div className="pdf-info">
                                    <div className="pdf-name">{msg.mediaName || 'Document.pdf'}</div>
                                    <div className="pdf-action">Open / Download PDF ↗</div>
                                  </div>
                                </a>
                              )}

                              {/* Message Text */}
                              {msg.text && <div>{msg.text}</div>}

                              <div className="message-footer">
                                <span>{formatTimestamp(msg.createdAt)}</span>
                                {isOutgoing && (
                                  <span
                                    className={`message-seen-status ${msg.isRead ? 'seen' : 'not-seen'}`}
                                  >
                                    {msg.isRead ? '✓✓ seen' : '✓ not seen yet'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="chat-input-area">
                  {/* File preview before send */}
                  {attachmentFile && (
                    <div className="chat-preview-container">
                      {attachmentPreview === 'pdf' ? (
                        <div style={{ fontSize: '1.8rem' }}>📄</div>
                      ) : (
                        <img src={attachmentPreview} alt="Preview" className="chat-preview-thumb" />
                      )}
                      <div className="chat-preview-name">{attachmentFile.name}</div>
                      <button
                        type="button"
                        className="chat-preview-remove"
                        onClick={removeAttachment}
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <form className="chat-input-row" onSubmit={handleSendMessage}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      id="chat-file-input"
                    />
                    <button
                      type="button"
                      className="chat-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach Image or PDF"
                    >
                      📎
                    </button>
                    <input
                      id="chat-message-input"
                      className="chat-text-input"
                      placeholder={`Message ${activePartner.name}... (Press Enter to send)`}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={sending}
                    />
                    <button
                      id="chat-send-btn"
                      type="submit"
                      className="chat-send-btn"
                      disabled={sending || (!textInput.trim() && !attachmentFile)}
                    >
                      {sending ? 'Sending...' : 'Send ✈️'}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* No partner selected */
              <div className="chat-empty-state">
                <div className="chat-empty-icon">💬</div>
                <h3>Welcome to Messenger</h3>
                <p style={{ maxWidth: 420, margin: '0.6rem auto 1.5rem', lineHeight: 1.5 }}>
                  Select a conversation from the sidebar or start a new message with the Exam Authority or any student.
                </p>
                {!isAdmin && (
                  <button
                    id="chat-authority-empty-btn"
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
                    onClick={() => {
                      const authorityContact = contacts.find((c) => c.role === 'authority' || c._id === 'admin') || {
                        _id: 'admin',
                        name: 'Exam Authority',
                        title: 'Head Administrator',
                        role: 'authority',
                      };
                      handleSelectPartner(authorityContact);
                    }}
                  >
                    👑 Chat with Exam Authority
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImg && (
        <div className="image-lightbox" onClick={() => setLightboxImg(null)}>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-lightbox-close" onClick={() => setLightboxImg(null)}>✕</button>
            <img src={lightboxImg} alt="Enlarged preview" />
          </div>
        </div>
      )}
    </div>
  );
}
