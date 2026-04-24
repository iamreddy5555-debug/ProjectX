import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';

const STAKES = [20, 100, 300, 1000, 3000];
const MIN_STAKE = 20;
const MAX_STAKE = 10000;

export default function CoinFlip() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(null);
  const [stake, setStake] = useState(20);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const play = async () => {
    if (!selection) { setError('Pick Heads or Tails'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setFlipping(true);
    setResult(null);
    try {
      const res = await api.post('/games/coinflip', { selection, stake });
      setTimeout(() => {
        setResult(res.data);
        updateBalance(res.data.newBalance);
        setFlipping(false);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to play');
      setFlipping(false);
    }
  };

  const playAgain = () => { setResult(null); setSelection(null); };

  const coinFace = result?.outcome || (flipping ? '?' : '🪙');

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

      {/* Coin display */}
      <div className="coin-display">
        <div className={`coin ${flipping ? 'flipping' : ''} ${result ? `coin-${result.outcome}` : ''}`}>
          <span className="coin-face">
            {result ? (result.outcome === 'heads' ? 'H' : 'T') : (flipping ? '?' : 'H')}
          </span>
        </div>
        {result && (
          <div className={`coin-result ${result.won ? 'won' : 'lost'}`}>
            {result.won ? `You won ₹${result.payout}! 🎉` : `You lost — it was ${result.outcome}`}
          </div>
        )}
      </div>

      {!result && (
        <>
          <div className="game-section">
            <div className="game-section-title">Call it</div>
            <div className="coin-picker">
              <button
                className={`coin-choice ${selection === 'heads' ? 'selected' : ''}`}
                onClick={() => setSelection('heads')}
                disabled={flipping}
              >
                <div className="coin-choice-icon">H</div>
                <div>Heads</div>
              </button>
              <button
                className={`coin-choice ${selection === 'tails' ? 'selected' : ''}`}
                onClick={() => setSelection('tails')}
                disabled={flipping}
              >
                <div className="coin-choice-icon">T</div>
                <div>Tails</div>
              </button>
            </div>
          </div>

          <div className="game-section">
            <div className="game-section-title">Stake (wins 2×)</div>
            <div className="game-stake-grid">
              {STAKES.map(s => (
                <button
                  key={s}
                  className={`game-stake-btn ${stake === s ? 'selected' : ''}`}
                  onClick={() => setStake(s)}
                  disabled={flipping}
                >
                  ₹{s}
                  <span className="game-stake-win">→ ₹{s * 2}</span>
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
                  disabled={flipping}
                  placeholder={`${MIN_STAKE}-${MAX_STAKE}`}
                />
              </div>
              <span className="custom-stake-hint">Win ₹{stake * 2} • Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button
            className="btn btn-primary btn-lg game-play-btn"
            onClick={play}
            disabled={!selection || flipping}
          >
            {flipping ? 'Flipping...' : `Flip for ₹${stake}`}
          </button>
        </>
      )}

      {result && (
        <button className="btn btn-primary btn-lg game-play-btn" onClick={playAgain}>
          Play Again
        </button>
      )}
    </div>
  );
}
