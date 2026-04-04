import { useState, useEffect, useRef } from 'react';
import { Send, Search, User, ArrowLeft } from 'lucide-react';
import { timeAgo } from '../utils/formatters';
import api from '../utils/api';

export default function AdminChat({ onUnreadCount }) {
  const [chats, setChats] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadChats();
    pollRef.current = setInterval(loadChats, 8000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedUser) {
      const poll = setInterval(() => loadMessages(selectedUser), 5000);
      return () => clearInterval(poll);
    }
  }, [selectedUser]);

  const loadChats = async () => {
    try {
      const res = await api.get('/admin/chats');
      setChats(res.data);
      const total = res.data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      onUnreadCount?.(total);
    } catch (err) {
      console.error('Failed to load chats');
    }
  };

  const loadMessages = async (userId) => {
    try {
      const res = await api.get(`/admin/chats/${userId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const selectUser = async (chat) => {
    setSelectedUser(chat.user._id);
    setSelectedUserInfo(chat.user);
    await loadMessages(chat.user._id);
    loadChats();
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedUser || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/admin/chats/${selectedUser}`, { message: input.trim() });
      setMessages(prev => [...prev, res.data]);
      setInput('');
    } catch (err) {
      console.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(c =>
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Chat Support</h1>
          <p className="admin-page-subtitle">Respond to user messages</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* User List Panel */}
        <div className={`chat-users-panel ${selectedUser ? 'hide-mobile' : ''}`}>
          <div className="chat-users-header">
            <div className="chat-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="chat-users-list">
            {filteredChats.length === 0 ? (
              <div className="chat-empty-users">
                <User size={32} />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredChats.map(chat => (
                <div
                  key={chat.user._id}
                  className={`chat-user-item ${selectedUser === chat.user._id ? 'active' : ''}`}
                  onClick={() => selectUser(chat)}
                >
                  <div className="chat-user-avatar">
                    {chat.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="chat-user-info">
                    <div className="chat-user-name-row">
                      <span className="chat-user-name">{chat.user.name}</span>
                      <span className="chat-user-time">
                        {chat.lastMessage && timeAgo(chat.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="chat-user-preview-row">
                      <span className="chat-user-preview">
                        {chat.lastMessage?.senderRole === 'admin' && 'You: '}
                        {chat.lastMessage?.message?.slice(0, 35)}
                        {(chat.lastMessage?.message?.length || 0) > 35 ? '...' : ''}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="chat-unread-badge">{chat.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className={`chat-messages-panel ${!selectedUser ? 'hide-mobile' : ''}`}>
          {!selectedUser ? (
            <div className="chat-no-selection">
              <MessageCircleIcon />
              <h3>Select a conversation</h3>
              <p>Choose a user from the left to view and reply to their messages</p>
            </div>
          ) : (
            <>
              <div className="chat-messages-header">
                <button className="chat-back-btn" onClick={() => setSelectedUser(null)}>
                  <ArrowLeft size={18} />
                </button>
                <div className="chat-user-avatar small">
                  {selectedUserInfo?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="chat-header-name">{selectedUserInfo?.name}</div>
                  <div className="chat-header-email">{selectedUserInfo?.email}</div>
                </div>
              </div>

              <div className="chat-messages-body">
                {messages.length === 0 ? (
                  <div className="chat-no-messages">No messages yet</div>
                ) : (
                  messages.map((msg, i) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div key={msg._id || i} className={`chat-bubble-wrap ${isAdmin ? 'sent' : 'received'}`}>
                        <div className={`chat-bubble ${isAdmin ? 'admin' : 'user'}`}>
                          <p>{msg.message}</p>
                          <span className="chat-bubble-time">{timeAgo(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEnd} />
              </div>

              <div className="chat-compose">
                <input
                  type="text"
                  placeholder="Type your reply..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={sending}
                />
                <button
                  className="chat-send-btn"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCircleIcon() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'var(--accent-primary-light)', color: 'var(--accent-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
      </svg>
    </div>
  );
}
