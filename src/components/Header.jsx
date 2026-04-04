import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { Home, Trophy, LogOut, Shield, Wallet, Menu, X, User } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        <div className="logo-icon">🏏</div>
        <span>CricketX</span>
      </Link>

      <nav className="header-nav">
        <Link to="/" className={isActive('/')}>
          <Home size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Matches
        </Link>
        {user && (
          <Link to="/my-contests" className={isActive('/my-contests')}>
            <Trophy size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> My Contests
          </Link>
        )}
        {user && (
          <Link to="/wallet" className={isActive('/wallet')}>
            <Wallet size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Wallet
          </Link>
        )}
        {user?.role === 'admin' && (
          <Link to="/admin" className={isActive('/admin')}>
            <Shield size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Admin
          </Link>
        )}
      </nav>

      <div className="header-actions">
        {user ? (
          <>
            <Link to="/wallet" className="user-balance">
              <Wallet size={16} />
              {formatCurrency(user.balance || 0)}
            </Link>
            <Link to="/profile" className="header-profile-btn" title="Profile">
              <User size={16} />
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline btn-sm">Log In</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}
