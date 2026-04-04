import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import api from '../utils/api';

export default function AdminBets() {
  const [bets, setBets] = useState([]);
  const [toast, setToast] = useState('');

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
    try {
      await api.patch(`/admin/bets/${id}/settle`, { status });
      showToast(`Bet marked as ${status}`);
      loadBets();
    } catch (err) {
      showToast('Failed to settle bet');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const getSelectionName = (bet) => {
    if (bet.selection === 'teamA') return bet.matchId?.teamA || 'Team A';
    if (bet.selection === 'teamB') return bet.matchId?.teamB || 'Team B';
    return 'Draw';
  };

  return (
    <div>
      <h1 className="admin-page-title">🎯 Bets ({bets.length})</h1>
      {bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">No bets placed</div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Match</th>
              <th>Selection</th>
              <th>Type</th>
              <th>Odds</th>
              <th>Stake</th>
              <th>Pot. Win</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bets.map(bet => (
              <tr key={bet._id}>
                <td style={{ fontWeight: 600 }}>{bet.userId?.name || 'Unknown'}</td>
                <td style={{ fontSize: '0.85rem' }}>{bet.matchId?.title || 'N/A'}</td>
                <td>{getSelectionName(bet)}</td>
                <td>
                  <span className={`status-badge ${bet.betType === 'back' ? 'status-approved' : 'status-rejected'}`}>
                    {bet.betType.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{bet.odds.toFixed(2)}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(bet.stake)}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{formatCurrency(bet.potentialWin)}</td>
                <td><span className={`status-badge status-${bet.status}`}>{bet.status}</span></td>
                <td>
                  {bet.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success btn-sm" onClick={() => settleBet(bet._id, 'won')}>Won</button>
                      <button className="btn btn-danger btn-sm" onClick={() => settleBet(bet._id, 'lost')}>Lost</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Settled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}
