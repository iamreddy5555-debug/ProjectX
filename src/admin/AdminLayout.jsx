import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, QrCode, Trophy,
  MessageCircle, LogOut, Gamepad2, Target, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminPayments from './AdminPayments';
import AdminQRCodes from './AdminQRCodes';
import AdminMatches from './AdminMatches';
import AdminContests from './AdminContests';
import AdminBets from './AdminBets';
import AdminChat from './AdminChat';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'matches', label: 'Matches', icon: Trophy },
  { id: 'contests', label: 'Contests', icon: Gamepad2 },
  { id: 'bets', label: 'Bets', icon: Target },
  { id: 'payments', label: 'Payments', icon: CreditCard, badge: true },
  { id: 'qrcodes', label: 'QR Codes', icon: QrCode },
  { id: 'chat', label: 'Chat', icon: MessageCircle, badge: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AdminDashboard onNavigate={setActivePage} />;
      case 'users': return <AdminUsers />;
      case 'payments': return <AdminPayments onPendingCount={setPendingCount} />;
      case 'qrcodes': return <AdminQRCodes />;
      case 'matches': return <AdminMatches />;
      case 'contests': return <AdminContests />;
      case 'bets': return <AdminBets />;
      case 'chat': return <AdminChat onUnreadCount={setUnreadChats} />;
      default: return <AdminDashboard onNavigate={setActivePage} />;
    }
  };

  const getBadge = (item) => {
    if (item.id === 'payments' && pendingCount > 0) return pendingCount;
    if (item.id === 'chat' && unreadChats > 0) return unreadChats;
    return 0;
  };

  const pickPage = (id) => {
    setActivePage(id);
    setMobileOpen(false);
  };

  return (
    <div className="admin-layout">
      {/* Mobile top bar with hamburger */}
      <div className="admin-mobile-bar">
        <button className="admin-mobile-toggle" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </button>
        <span className="admin-mobile-title">
          {navItems.find(n => n.id === activePage)?.label || 'Admin'}
        </span>
      </div>

      {/* Mobile overlay backdrop */}
      {mobileOpen && <div className="admin-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="admin-sidebar-header">
          {!collapsed && <div className="admin-sidebar-title">Admin Panel</div>}
          <button className="admin-collapse-btn desktop-only" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="admin-collapse-btn mobile-only" onClick={() => setMobileOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="admin-nav-section">
          {navItems.map(item => {
            const badge = getBadge(item);
            return (
              <button
                key={item.id}
                className={`admin-nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => pickPage(item.id)}
                title={collapsed ? item.label : ''}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="admin-nav-footer">
          <button className="admin-nav-item logout-btn" onClick={logout}>
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      <main className="admin-content">
        {renderPage()}
      </main>
    </div>
  );
}
