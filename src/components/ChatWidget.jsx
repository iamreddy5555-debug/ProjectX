import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, Send, X } from 'lucide-react';
import api from '../utils/api';

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const messagesEnd = useRef(null);

  useEffect(() => {
    if (open && user) {
      loadMessages();
    }
  }, [open, user]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await api.get('/chat');
      setMessages(res.data);
      setUnread(0);
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    try {
      const res = await api.post('/chat', { message: input.trim() });
      setMessages(prev => [...prev, res.data]);
      setInput('');
    } catch (err) {
      console.error('Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  if (!user) return null;

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <div>
              <h3>💬 Support Chat</h3>
              <p>We typically reply within minutes</p>
            </div>
            <button className="bet-slip-close" onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.2)' }}>
              <X size={16} color="white" />
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                  👋 Hi! How can we help you?
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={msg._id || i}
                className={`chat-message ${msg.senderRole === 'user' ? 'sent' : 'received'}`}
              >
                {msg.message}
              </div>
            ))}
            <div ref={messagesEnd} />
          </div>
          <div className="chat-input-bar">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button onClick={sendMessage}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen(!open)}>
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {unread > 0 && !open && <span className="chat-badge">{unread}</span>}
      </button>
    </div>
  );
}
