import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';
import { onGameEvent } from '../../utils/gameSocket';

const STAKES = [20, 100, 300, 1000, 3000];
const MIN_STAKE = 20;
const MAX_STAKE = 10000;

export default function CoinFlip() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [selection, setSelection] = useState(null);
  const [stake, setStake] = useState(20);
  const [placing, setPlacing] = useState(false);
  const [round, setRound] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef(null);

  useEffect(() => {
    api.get('/games/coinflip/current').then(r => setRound(r.data)).catch(() => {});
    const off = onGameEvent('coinflip:round', (r) => {
      setRound(r);
      if (r.phase === 'betting') setMyBets([]);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!round?.roundId || !user) return;
    api.get('/games/coinflip/my-bets').then(r => setMyBets(r.data || [])).catch(() => {});
    if (round.phase === 'revealing') {
      api.get('/auth/me').then(r => updateBalance(r.data.balance)).catch(() => {});
    }
  }, [round?.roundId, round?.phase, user]);

  useEffect(() => {
    const target = round?.bettingEndsAt ? new Date(round.bettingEndsAt).getTime() : null;
    if (!target) { setSecondsLeft(0); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    tickRef.current = setInterval(tick, 250);
    return () => clearInterval(tickRef.current);
  }, [round?.bettingEndsAt]);

  const isBetting = round?.phase === 'betting' && secondsLeft > 0;
  const revealing = round?.phase === 'revealing';

  const placeBet = async () => {
    if (!selection) { setError('Pick Heads or Tails'); return; }
    if (!isBetting) { setError('Betting closed'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlacing(true);
    try {
      const res = await api.post('/games/coinflip', { selection, stake });
      updateBalance(res.data.newBalance);
      const mb = await api.get('/games/coinflip/my-bets');
      setMyBets(mb.data || []);
      setSelection(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="main-content" style={{ maxWidth: 520 }}>
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Coin Flip</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Live round timer */}
      <div className="coinflip-round-bar">
        <div>
          <div className="coinflip-phase">{revealing ? 'Flipping...' : isBetting ? 'Next flip in' : 'Waiting for next round'}</div>
          <div className="coinflip-timer">{mm}:{ss}</div>
        </div>
        <div className="coinflip-round-id">Round {round?.roundId?.slice(-8) || '—'}</div>
      </div>

      {/* Recent results */}
      {round?.lastResults?.length > 0 && (
        <div className="coinflip-recent">
          Recent:
          {round.lastResults.slice(0, 12).map((r, i) => (
            <span key={i} className={`coinflip-recent-chip ${r.outcome}`}>{r.outcome === 'heads' ? 'H' : 'T'}</span>
          ))}
        </div>
      )}

      {/* Coin display */}
      <div className="coin-display">
        <div className={`coin ${revealing ? 'flipping' : ''} ${round?.result ? `coin-${round.result}` : ''}`}>
          <span className="coin-face">
            {round?.result ? (round.result === 'heads' ? 'H' : 'T') : 'H'}
          </span>
        </div>
        {revealing && round?.result && (
          <div className="coin-result won">It's {round.result.toUpperCase()}!</div>
        )}
      </div>

      {myBets.length > 0 && (
        <div className="wingo-mybets">
          <strong>Your bets this round:</strong>
          {myBets.map(b => (
            <span key={b._id} className="wingo-mybet-chip">{b.selection} · ₹{b.stake}</span>
          ))}
        </div>
      )}

      <div className="game-section">
        <div className="game-section-title">Call it</div>
        <div className="coin-picker">
          <button className={`coin-choice ${selection === 'heads' ? 'selected' : ''}`}
            onClick={() => setSelection('heads')} disabled={!isBetting || placing}>
            <div className="coin-choice-icon">H</div>
            <div>Heads</div>
          </button>
          <button className={`coin-choice ${selection === 'tails' ? 'selected' : ''}`}
            onClick={() => setSelection('tails')} disabled={!isBetting || placing}>
            <div className="coin-choice-icon">T</div>
            <div>Tails</div>
          </button>
        </div>
      </div>

      <div className="game-section">
        <div className="game-section-title">Stake (wins 2×)</div>
        <div className="game-stake-grid">
          {STAKES.map(s => (
            <button key={s} className={`game-stake-btn ${stake === s ? 'selected' : ''}`}
              onClick={() => setStake(s)} disabled={!isBetting || placing}>
              ₹{s}<span className="game-stake-win">→ ₹{s * 2}</span>
            </button>
          ))}
        </div>
        <div className="custom-stake-row">
          <label>Or enter custom:</label>
          <div className="custom-stake-input">
            <span>₹</span>
            <input type="number" min={MIN_STAKE} max={MAX_STAKE} step="1"
              value={stake}
              onChange={e => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v)) setStake(v); }}
              disabled={!isBetting || placing}
              placeholder={`${MIN_STAKE}-${MAX_STAKE}`} />
          </div>
          <span className="custom-stake-hint">Win ₹{stake * 2} • Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
        </div>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      <button className="btn btn-primary btn-lg game-play-btn" onClick={placeBet}
        disabled={!selection || !isBetting || placing}>
        {placing ? 'Placing...' : isBetting ? `Bet ₹${stake}` : 'Betting closed — next round soon'}
      </button>
    </div>
  );
}
