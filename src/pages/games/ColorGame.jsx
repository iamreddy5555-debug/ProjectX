import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';

const STAKES = [10, 50, 100, 500, 1000, 2000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;
const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const colorFor = (n) => {
  if (n === 0 || n === 5) return 'violet';
  if ([1, 3, 7, 9].includes(n)) return 'red';
  return 'green';
};

export default function ColorGame() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [stake, setStake] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const play = async () => {
    if (!selection) { setError('Pick a color or number first'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlaying(true);
    setResult(null);
    try {
      const res = await api.post('/games/color', { selection, stake });
      // Short suspense delay so it feels like a roll
      setTimeout(() => {
        setResult(res.data);
        updateBalance(res.data.newBalance);
        setPlaying(false);
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to play');
      setPlaying(false);
    }
  };

  const playAgain = () => { setResult(null); setSelection(null); };

  return (
    <div className="main-content" style={{ maxWidth: 640 }}>
      {/* Header */}
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Color & Number</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Result display */}
      {result && (
        <div className={`game-result-card ${result.won ? 'won' : 'lost'}`}>
          <div className="game-result-icon" style={{ background: result.resultColor === 'red' ? '#ef4444' : result.resultColor === 'green' ? '#10b981' : '#8b5cf6' }}>
            {result.roll}
          </div>
          <div className="game-result-text">
            <div className="game-result-title">{result.won ? `You won ₹${result.payout}!` : 'You lost'}</div>
            <div className="game-result-sub">
              Rolled: <strong>{result.roll}</strong> ({result.resultColor})
              {result.won && ` • ${result.multiplier}× payout`}
            </div>
          </div>
          <button className="btn btn-primary" onClick={playAgain}>Play Again</button>
        </div>
      )}

      {/* Roll animation placeholder */}
      {playing && !result && (
        <div className="game-result-card playing">
          <div className="game-result-icon spinning">?</div>
          <div className="game-result-text">
            <div className="game-result-title">Rolling...</div>
          </div>
        </div>
      )}

      {/* Color picker */}
      <div className="game-section">
        <div className="game-section-title">Pick a color (or violet for 4.5×)</div>
        <div className="color-picker">
          {['red', 'green', 'violet'].map(c => (
            <button
              key={c}
              className={`color-btn ${c} ${selection === c ? 'selected' : ''}`}
              onClick={() => setSelection(c)}
              disabled={playing}
            >
              <span className="color-btn-name">{c.toUpperCase()}</span>
              <span className="color-btn-payout">{c === 'violet' ? '4.5×' : '2×'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Number picker */}
      <div className="game-section">
        <div className="game-section-title">Or pick a number (9× payout)</div>
        <div className="number-grid">
          {NUMBERS.map(n => (
            <button
              key={n}
              className={`num-btn ${colorFor(n)} ${selection === String(n) ? 'selected' : ''}`}
              onClick={() => setSelection(String(n))}
              disabled={playing}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Stake picker */}
      <div className="game-section">
        <div className="game-section-title">Stake</div>
        <div className="game-stake-grid">
          {STAKES.map(s => (
            <button
              key={s}
              className={`game-stake-btn ${stake === s ? 'selected' : ''}`}
              onClick={() => setStake(s)}
              disabled={playing}
            >
              ₹{s}
            </button>
          ))}
        </div>
        <div className="custom-stake-row">
          <label>Or enter custom:</label>
          <div className="custom-stake-input">
            <span>₹</span>
            <input
              type="number"
              min={MIN_STAKE}
              max={MAX_STAKE}
              step="1"
              value={stake}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) setStake(v);
              }}
              disabled={playing}
              placeholder={`${MIN_STAKE}-${MAX_STAKE}`}
            />
          </div>
          <span className="custom-stake-hint">Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
        </div>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      <button
        className="btn btn-primary btn-lg game-play-btn"
        onClick={play}
        disabled={!selection || playing}
      >
        {playing ? 'Rolling...' : `Play for ₹${stake}`}
      </button>
    </div>
  );
}
