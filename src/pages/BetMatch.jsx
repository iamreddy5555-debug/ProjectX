import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { ArrowLeft, Trophy, Wallet, Check } from 'lucide-react';
import api from '../utils/api';

const TEAM_COLORS = {
  'Mumbai Indians': '#004BA0',
  'Chennai Super Kings': '#FFCC00',
  'Royal Challengers Bengaluru': '#D4213D',
  'Delhi Capitals': '#004C93',
  'Kolkata Knight Riders': '#3A225D',
  'Gujarat Titans': '#1C1C2B',
  'Rajasthan Royals': '#EA1A85',
  'Punjab Kings': '#ED1B24',
  'Sunrisers Hyderabad': '#FF822A',
  'Lucknow Super Giants': '#004F91',
};

const ENTRY_TIERS = [49, 99, 299, 599, 999];

const teamInitials = (name) => {
  if (!name) return '?';
  const words = name.split(' ');
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
};

export default function BetMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, updateBalance } = useAuth();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [stake, setStake] = useState(49);
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get(`/matches/${matchId}`)
      .then(res => setMatch(res.data))
      .catch(() => setToast('Failed to load match'))
      .finally(() => setLoading(false));
  }, [matchId]);

  const matchLocked = match && (match.status === 'live' || match.status === 'completed' || new Date(match.startTime) <= new Date());

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const placeBet = async () => {
    if (!selectedTeam) { showToast('Pick a team first'); return; }
    if ((user?.balance || 0) < stake) {
      showToast('Insufficient balance — please deposit first');
      return;
    }
    setPlacing(true);
    try {
      const res = await api.post('/bets', {
        matchId,
        selection: selectedTeam, // 'teamA' or 'teamB'
        betType: 'back',
        odds: 2.0, // win double the stake
        stake,
      });
      updateBalance(res.data.newBalance);
      setSuccess(true);
      setTimeout(() => navigate('/my-bets'), 1800);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return <div className="main-content"><div className="loading-spinner"><div className="spinner" /></div></div>;
  }
  if (!match) {
    return <div className="main-content"><div className="empty-state"><div className="empty-state-title">Match not found</div></div></div>;
  }

  return (
    <div className="main-content" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>
            {match.title}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {match.league} • {formatDate(match.startTime)} • {formatTime(match.startTime)}
          </p>
        </div>
      </div>

      {matchLocked && (
        <div style={{
          background: 'var(--accent-warning-light)', color: 'var(--accent-warning)',
          padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 20,
          fontSize: '0.9rem', fontWeight: 600, textAlign: 'center',
        }}>
          🔒 Match has started — betting is closed
        </div>
      )}

      {/* Wallet bar */}
      <div className="bet-wallet-bar">
        <div>
          <Wallet size={16} />
          <span>Available Balance</span>
        </div>
        <strong>{formatCurrency(user?.balance || 0)}</strong>
      </div>

      {/* Pick winner */}
      <div className="bet-section">
        <h2 className="bet-section-title">
          <Trophy size={18} /> Who will win?
        </h2>
        <div className="bet-team-grid">
          <button
            className={`bet-team-card ${selectedTeam === 'teamA' ? 'selected' : ''}`}
            onClick={() => setSelectedTeam('teamA')}
            disabled={matchLocked}
          >
            <div className="bet-team-logo" style={{ background: TEAM_COLORS[match.teamA] || '#4f46e5' }}>
              {teamInitials(match.teamA)}
            </div>
            <div className="bet-team-name">{match.teamA}</div>
            {selectedTeam === 'teamA' && <div className="bet-team-check"><Check size={16} /></div>}
          </button>

          <button
            className={`bet-team-card ${selectedTeam === 'teamB' ? 'selected' : ''}`}
            onClick={() => setSelectedTeam('teamB')}
            disabled={matchLocked}
          >
            <div className="bet-team-logo" style={{ background: TEAM_COLORS[match.teamB] || '#06b6d4' }}>
              {teamInitials(match.teamB)}
            </div>
            <div className="bet-team-name">{match.teamB}</div>
            {selectedTeam === 'teamB' && <div className="bet-team-check"><Check size={16} /></div>}
          </button>
        </div>
      </div>

      {/* Pick stake */}
      <div className="bet-section">
        <h2 className="bet-section-title">Choose Entry Amount</h2>
        <div className="bet-stake-grid">
          {ENTRY_TIERS.map(amount => (
            <button
              key={amount}
              className={`bet-stake-card ${stake === amount ? 'selected' : ''}`}
              onClick={() => setStake(amount)}
              disabled={matchLocked}
            >
              <div className="bet-stake-amount">₹{amount}</div>
              <div className="bet-stake-win">Win ₹{amount * 2}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + Place Bet */}
      <div className="bet-summary">
        <div className="bet-summary-row">
          <span>Your pick</span>
          <strong>{selectedTeam === 'teamA' ? match.teamA : selectedTeam === 'teamB' ? match.teamB : '—'}</strong>
        </div>
        <div className="bet-summary-row">
          <span>Entry</span>
          <strong>{formatCurrency(stake)}</strong>
        </div>
        <div className="bet-summary-row total">
          <span>If you win</span>
          <strong>{formatCurrency(stake * 2)}</strong>
        </div>

        <button
          className="btn btn-primary btn-lg bet-place-btn"
          onClick={placeBet}
          disabled={!selectedTeam || matchLocked || placing || success}
        >
          {success ? '✓ Bet Placed!' : placing ? 'Placing...' : `Place Bet — ₹${stake}`}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
