import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { timeAgo } from '../utils/formatters';
import api from '../utils/api';

export default function AdminChat() {
  const [chats, setChats] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEnd = useRef(null);

  useEffect(() => { loadChats(); }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async () => {
    try {
      const res = await api.get('/admin/chats');
      setChats(res.data);
    } catch (err) {
      console.error('Failed to load chats');
    }
  };

  const selectUser = async (userId) => {
    setSelectedUser(userId);
    try {
      const res = await api.get(`/admin/chats/${userId}`);
      setMessages(res.data);
      loadChats(); // refresh unread counts
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedUser) return;
    try {
      const res = await api.post(`/admin/chats/${selectedUser}`, { message: input.trim() });
      setMessages(prev => [...prev, res.data]);
      setInput('');
    } catch (err) {
      console.error('Failed to send');
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">💬 Chat</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* User List */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: '0.9rem' }}>
            Conversations ({chats.length})
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100% - 50px)' }}>
            {chats.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                No conversations yet
              </div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.user._id}
                  onClick={() => selectUser(chat.user._id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    background: selectedUser === chat.user._id ? 'var(--accent-primary-light)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{chat.user.name}</span>
                    {chat.unreadCount > 0 && <span className="nav-badge">{chat.unreadCount}</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {chat.lastMessage?.message?.slice(0, 40)}...
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {chat.lastMessage && timeAgo(chat.lastMessage.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedUser ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Select a conversation</div>
              <div className="empty-state-desc">Choose a user from the left to view messages</div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((msg, i) => (
                  <div
                    key={msg._id || i}
                    className={`chat-message ${msg.senderRole === 'admin' ? 'sent' : 'received'}`}
                  >
                    {msg.message}
                    <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 4 }}>
                      {timeAgo(msg.createdAt)}
                    </div>
                  </div>
                ))}
                <div ref={messagesEnd} />
              </div>
              <div className="chat-input-bar">
                <input
                  type="text"
                  placeholder="Type a reply..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
