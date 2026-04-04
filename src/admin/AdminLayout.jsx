import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, QrCode, Trophy, MessageCircle, LogOut, Gamepad2 } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminPayments from './AdminPayments';
import AdminQRCodes from './AdminQRCodes';
import AdminMatches from './AdminMatches';
import AdminContests from './AdminContests';
import AdminChat from './AdminChat';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard, badge: true },
  { id: 'qrcodes', label: 'QR Codes', icon: QrCode },
  { id: 'matches', label: 'Matches', icon: Trophy },
  { id: 'contests', label: 'Contests', icon: Gamepad2 },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AdminDashboard />;
      case 'users': return <AdminUsers />;
      case 'payments': return <AdminPayments onPendingCount={setPendingCount} />;
      case 'qrcodes': return <AdminQRCodes />;
      case 'matches': return <AdminMatches />;
      case 'contests': return <AdminContests />;
      case 'chat': return <AdminChat />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Admin Panel</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`admin-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <item.icon size={18} />
            {item.label}
            {item.badge && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <button className="admin-nav-item" onClick={logout} style={{ color: 'var(--accent-danger)' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
      <main className="admin-content">
        {renderPage()}
      </main>
    </div>
  );
}
