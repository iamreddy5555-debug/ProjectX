import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatOdds } from '../utils/formatters';
import { X } from 'lucide-react';
import api from '../utils/api';

export default function BetSlip({ betData, onClose, onSuccess }) {
  const { user, updateBalance } = useAuth();
  const [stake, setStake] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!betData) return null;

  const { match, selection, betType, odds } = betData;
  const stakeNum = parseFloat(stake) || 0;
  const potentialWin = stakeNum * (odds - 1);

  const getSelectionName = () => {
    if (selection === 'teamA') return match.teamA;
    if (selection === 'teamB') return match.teamB;
    return 'Draw';
  };

  const handlePlaceBet = async () => {
    if (!stake || stakeNum < 10) {
      setError('Minimum stake is ₹10');
      return;
    }
    if (stakeNum > (user?.balance || 0)) {
      setError('Insufficient balance');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/bets', {
        matchId: match._id,
        selection,
        betType,
        odds,
        stake: stakeNum,
      });
      updateBalance(res.data.newBalance);
      onSuccess?.('Bet placed successfully!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  const quickStakes = [100, 500, 1000, 5000];

  return (
    <div className="bet-slip-overlay" onClick={onClose}>
      <div className="bet-slip" onClick={e => e.stopPropagation()}>
        <div className="bet-slip-header">
          <h3 className="bet-slip-title">
            {betType === 'back' ? '📗 Back' : '📕 Lay'} Bet
          </h3>
          <button className="bet-slip-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="bet-slip-info">
          <div className="bet-slip-match">{match.title}</div>
          <div className="bet-slip-selection">
            {getSelectionName()} • {betType.toUpperCase()} @ {formatOdds(odds)}
          </div>
        </div>

        <div className="bet-slip-input-group">
          <label>Stake Amount (₹)</label>
          <input
            type="number"
            placeholder="Enter stake amount"
            value={stake}
            onChange={e => setStake(e.target.value)}
            min="10"
          />
          <div className="bet-slip-quick-stakes">
            {quickStakes.map(amount => (
              <button
                key={amount}
                className="quick-stake-btn"
                onClick={() => setStake(String(amount))}
              >
                ₹{amount}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

        <div className="bet-slip-payout">
          <span>Potential Win</span>
          <span className="bet-slip-payout-amount">{formatCurrency(potentialWin)}</span>
        </div>

        <button
          className={`btn ${betType === 'back' ? 'btn-primary' : 'btn-danger'} btn-lg`}
          style={{ width: '100%' }}
          onClick={handlePlaceBet}
          disabled={loading || !stake}
        >
          {loading ? 'Placing...' : `Place ${betType.toUpperCase()} Bet`}
        </button>
      </div>
    </div>
  );
}
