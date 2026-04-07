import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { Mail, Phone, Wallet, LogOut, Target } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: Wallet, label: 'My Wallet', desc: 'Deposit & withdraw funds', onClick: () => navigate('/wallet') },
    { icon: Target, label: 'My Bets', desc: 'View bet history', onClick: () => navigate('/my-bets') },
  ];

  return (
    <div className="main-content" style={{ maxWidth: 600 }}>
      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar">
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <h2 className="profile-name">{user.name}</h2>
        <p className="profile-role">{user.role === 'admin' ? 'Administrator' : 'Player'}</p>

        <div className="profile-info-grid">
          <div className="profile-info-item">
            <Mail size={16} />
            <span>{user.email}</span>
          </div>
          <div className="profile-info-item">
            <Phone size={16} />
            <span>{user.phone || 'Not set'}</span>
          </div>
          <div className="profile-info-item">
            <Wallet size={16} />
            <span className="profile-balance">{formatCurrency(user.balance || 0)}</span>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="profile-menu">
        {menuItems.map((item, i) => (
          <button key={i} className="profile-menu-item" onClick={item.onClick}>
            <div className="profile-menu-icon">
              <item.icon size={20} />
            </div>
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

      {/* Logout */}
      <button className="profile-logout" onClick={handleLogout}>
        <LogOut size={18} />
        Log Out
      </button>
    </div>
  );
}
