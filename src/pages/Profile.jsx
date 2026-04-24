import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { Mail, Phone, Wallet, LogOut, Target, Key, X } from 'lucide-react';
import api from '../utils/api';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const submitPassword = async () => {
    setPwdError('');
    if (!current || !next) { setPwdError('Fill both fields'); return; }
    if (next.length < 6) { setPwdError('New password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      const endpoint = user.role === 'admin' ? '/admin/me/password' : '/auth/change-password';
      await api.patch(endpoint, { currentPassword: current, newPassword: next });
      setShowPwd(false);
      setCurrent(''); setNext('');
      setToast('Password changed successfully');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { icon: Wallet, label: 'My Wallet', desc: 'Deposit & withdraw funds', onClick: () => navigate('/wallet') },
    { icon: Target, label: 'My Bets', desc: 'View bet history', onClick: () => navigate('/my-bets') },
    { icon: Key, label: 'Change Password', desc: 'Update your account password', onClick: () => setShowPwd(true) },
  ];

  return (
    <div className="main-content" style={{ maxWidth: 600 }}>
      <div className="profile-card">
        <div className="profile-avatar">{user.name?.charAt(0).toUpperCase()}</div>
        <h2 className="profile-name">{user.name}</h2>
        <p className="profile-role">{user.role === 'admin' ? 'Administrator' : 'Player'}</p>

        <div className="profile-info-grid">
          <div className="profile-info-item"><Mail size={16} /><span>{user.email}</span></div>
          <div className="profile-info-item"><Phone size={16} /><span>{user.phone || 'Not set'}</span></div>
          <div className="profile-info-item">
            <Wallet size={16} />
            <span className="profile-balance">{formatCurrency(user.balance || 0)}</span>
          </div>
        </div>
      </div>

      <div className="profile-menu">
        {menuItems.map((item, i) => (
          <button key={i} className="profile-menu-item" onClick={item.onClick}>
            <div className="profile-menu-icon"><item.icon size={20} /></div>
            <div className="profile-menu-text">
              <span className="profile-menu-label">{item.label}</span>
              <span className="profile-menu-desc">{item.desc}</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="profile-menu-arrow">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      <button className="profile-logout" onClick={handleLogout}>
        <LogOut size={18} /> Log Out
      </button>

      {/* Change Password Modal */}
      {showPwd && (
        <div className="modal-overlay" onClick={() => setShowPwd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button className="modal-close" onClick={() => setShowPwd(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Your current password" />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="Min 6 characters" />
              </div>
              {pwdError && <div className="form-error-box">{pwdError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPwd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitPassword} disabled={saving}>
                {saving ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
