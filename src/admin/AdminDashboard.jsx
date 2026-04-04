import { useState, useEffect } from 'react';
import { Users, CreditCard, Trophy, TrendingUp, Gamepad2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import api from '../utils/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, pendingPayments: 0, activeContests: 0, totalDeposits: 0, totalTeams: 0 });

  useEffect(() => {
    api.get('/admin/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error('Failed to load stats'));
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: CreditCard, color: 'orange' },
    { label: 'Active Contests', value: stats.activeContests, icon: Gamepad2, color: 'green' },
    { label: 'Total Deposits', value: formatCurrency(stats.totalDeposits), icon: TrendingUp, color: 'red' },
    { label: 'Teams Created', value: stats.totalTeams, icon: Trophy, color: 'blue' },
  ];

  return (
    <div>
      <h1 className="admin-page-title">📊 Dashboard</h1>
      <div className="stats-grid">
        {cards.map((card, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-card-icon ${card.color}`}>
              <card.icon size={22} />
            </div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-label">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
