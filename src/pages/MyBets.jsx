import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import api from '../utils/api';

export default function MyBets() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      const res = await api.get('/bets/my');
      setBets(res.data);
    } catch (err) {
      console.error('Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  const getSelectionName = (bet) => {
    if (!bet.matchId) return bet.selection;
    if (bet.selection === 'teamA') return bet.matchId.teamA;
    if (bet.selection === 'teamB') return bet.matchId.teamB;
    return 'Draw';
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 24 }}>My Bets</h1>

      {bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">No bets placed yet</div>
          <div className="empty-state-desc">Go to home page and click on odds to place your first bet</div>
        </div>
      ) : (
        <div className="matches-list">
          {bets.map(bet => (
            <div key={bet._id} className="match-card">
              <div className="match-card-header">
                <div className="match-league">
                  <span>🎯</span>
                  <span>{bet.matchId?.title || 'Match'}</span>
                </div>
                <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
              </div>
              <div className="match-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {bet.betType.toUpperCase()} • {getSelectionName(bet)} @ {bet.odds.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {formatDateTime(bet.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Stake: <strong>{formatCurrency(bet.stake)}</strong>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: bet.status === 'won' ? 'var(--accent-success)' : bet.status === 'lost' ? 'var(--accent-danger)' : 'var(--accent-primary)' }}>
                    {bet.status === 'won' ? `+${formatCurrency(bet.stake + bet.potentialWin)}` :
                     bet.status === 'lost' ? `-${formatCurrency(bet.stake)}` :
                     `Potential: ${formatCurrency(bet.potentialWin)}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
