import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Target, Filter } from 'lucide-react';
import api from '../utils/api';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => { loadBets(); }, []);

  const loadBets = async () => {
    try {
      const res = await api.get('/admin/bets');
      setBets(res.data);
    } catch (err) {
      console.error('Failed to load bets');
    }
  };

  const settleBet = async (id, status) => {
    const action = status === 'won' ? 'mark as WON (credits user)' : status === 'lost' ? 'mark as LOST' : 'CANCEL (refunds stake)';
    if (!window.confirm(`${action}? This cannot be undone.`)) return;
    setProcessing(id);
    try {
      await api.patch(`/admin/bets/${id}/settle`, { status });
      showToast(`Bet ${status}`);
      loadBets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to settle bet');
    } finally {
      setProcessing(null);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const getSelectionName = (bet) => {
    if (bet.selection === 'teamA') return bet.matchId?.teamA || 'Team A';
    if (bet.selection === 'teamB') return bet.matchId?.teamB || 'Team B';
    return 'Draw';
  };

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Bets</h1>
          <p className="admin-page-subtitle">{bets.length} total bets, {bets.filter(b => b.status === 'pending').length} pending</p>
        </div>
        <div className="filter-tabs">
          {filters.map(f => (
            <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap"><Target size={32} /></div>
          <div className="empty-state-title">No {filter === 'all' ? '' : filter} bets</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Match</th>
                <th>Selection</th>
                <th>Type</th>
                <th>Odds</th>
                <th>Stake</th>
                <th>Potential Win</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(bet => (
                <tr key={bet._id}>
                  <td>
                    <div className="table-user">
                      <div className="table-user-avatar">{bet.userId?.name?.charAt(0) || '?'}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{bet.userId?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{bet.userId?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{bet.matchId?.title || 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{getSelectionName(bet)}</td>
                  <td>
                    <span className={`bet-type-badge ${bet.betType}`}>
                      {bet.betType.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{bet.odds?.toFixed(2)}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(bet.stake)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatCurrency(bet.potentialWin)}</td>
                  <td><span className={`status-badge status-${bet.status}`}>{bet.status}</span></td>
                  <td>
                    {bet.status === 'pending' ? (
                      <div className="table-actions">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => settleBet(bet._id, 'won')}
                          disabled={processing === bet._id}
                        >Won</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => settleBet(bet._id, 'lost')}
                          disabled={processing === bet._id}
                        >Lost</button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => settleBet(bet._id, 'cancelled')}
                          disabled={processing === bet._id}
                        >Cancel</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {bet.settledAt ? formatDateTime(bet.settledAt) : 'Settled'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
