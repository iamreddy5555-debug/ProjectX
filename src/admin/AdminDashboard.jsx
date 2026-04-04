import { useState, useEffect } from 'react';
import { Users, CreditCard, Trophy, TrendingUp, Gamepad2, Target, MessageCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import api from '../utils/api';

export default function AdminDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/payments?status=pending'),
    ]).then(([statsRes, paymentsRes]) => {
      setStats(statsRes.data);
      setRecentPayments(paymentsRes.data.slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return <div className="admin-loading">Loading dashboard...</div>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue', page: 'users' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: CreditCard, color: 'orange', page: 'payments' },
    { label: 'Active Contests', value: stats.activeContests, icon: Gamepad2, color: 'green', page: 'contests' },
    { label: 'Total Deposits', value: formatCurrency(stats.totalDeposits), icon: TrendingUp, color: 'purple', page: 'payments' },
    { label: 'Teams Created', value: stats.totalTeams, icon: Trophy, color: 'teal', page: 'contests' },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Overview of your platform activity</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {cards.map((card, i) => (
          <div key={i} className="stat-card" onClick={() => onNavigate?.(card.page)} style={{ cursor: 'pointer' }}>
            <div className="stat-card-top">
              <div className={`stat-card-icon ${card.color}`}>
                <card.icon size={20} />
              </div>
              <ArrowRight size={16} className="stat-card-arrow" />
            </div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <h2 className="admin-section-title">Quick Actions</h2>
        <div className="quick-actions-grid">
          <button className="quick-action-card" onClick={() => onNavigate?.('payments')}>
            <CreditCard size={22} />
            <span>Review Payments</span>
            {stats.pendingPayments > 0 && <span className="quick-action-badge">{stats.pendingPayments} pending</span>}
          </button>
          <button className="quick-action-card" onClick={() => onNavigate?.('chat')}>
            <MessageCircle size={22} />
            <span>View Messages</span>
          </button>
          <button className="quick-action-card" onClick={() => onNavigate?.('qrcodes')}>
            <CreditCard size={22} />
            <span>Manage QR Codes</span>
          </button>
          <button className="quick-action-card" onClick={() => onNavigate?.('matches')}>
            <Trophy size={22} />
            <span>Manage Matches</span>
          </button>
          <button className="quick-action-card" onClick={() => onNavigate?.('bets')}>
            <Target size={22} />
            <span>Settle Bets</span>
          </button>
          <button className="quick-action-card" onClick={() => onNavigate?.('users')}>
            <Users size={22} />
            <span>Manage Users</span>
          </button>
        </div>
      </div>

      {/* Pending Payments Preview */}
      {recentPayments.length > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Pending Payments</h2>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.('payments')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="pending-list">
            {recentPayments.map(p => (
              <div key={p._id} className="pending-item">
                <div className="pending-item-info">
                  <span className="pending-item-name">{p.userId?.name || 'Unknown'}</span>
                  <span className="pending-item-type">{p.type}</span>
                </div>
                <span className="pending-item-amount">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
