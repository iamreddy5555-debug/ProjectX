import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Plane } from 'lucide-react';
import api from '../../utils/api';

const STAKES = [49, 99, 299, 599, 999];

// Local multiplier from elapsed time — MUST match the server formula
// Server: multiplier = 1.06^tSec
const computeMultiplier = (startedAt) => {
  const t = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(1, Math.pow(1.06, t));
};

export default function Aviator() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(49);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'flying' | 'result'
  const [betId, setBetId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [currentMul, setCurrentMul] = useState(1.0);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [crashed, setCrashed] = useState(false);
  const rafRef = useRef(null);
  const cashingOut = useRef(false);

  // Resume a pending bet if user refreshed mid-game
  useEffect(() => {
    api.get('/games/aviator/pending').then(res => {
      if (res.data.pending) {
        setBetId(res.data.betId);
        setStartedAt(res.data.startedAt);
        setStake(res.data.stake);
        setPhase('flying');
      }
    }).catch(() => {});
  }, []);

  // Animation loop
  useEffect(() => {
    if (phase !== 'flying' || !startedAt) return;
    const tick = () => {
      const m = computeMultiplier(startedAt);
      setCurrentMul(m);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, startedAt]);

  const startFlight = async () => {
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setLastResult(null);
    setCrashed(false);
    try {
      const res = await api.post('/games/aviator/start', { stake });
      updateBalance(res.data.newBalance);
      setBetId(res.data.betId);
      setStartedAt(res.data.startedAt);
      setCurrentMul(1.0);
      setPhase('flying');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start');
    }
  };

  const cashout = async () => {
    if (cashingOut.current || phase !== 'flying') return;
    cashingOut.current = true;
    try {
      const res = await api.post('/games/aviator/cashout', { betId });
      updateBalance(res.data.newBalance);
      setLastResult(res.data);
      setCrashed(res.data.crashed);
      setPhase('result');
      cancelAnimationFrame(rafRef.current);
    } catch (err) {
      setError(err.response?.data?.message || 'Cashout failed');
    } finally {
      cashingOut.current = false;
    }
  };

  const playAgain = () => {
    setPhase('idle');
    setBetId(null);
    setStartedAt(null);
    setCurrentMul(1.0);
    setLastResult(null);
    setCrashed(false);
  };

  const displayMul = phase === 'result' && lastResult
    ? lastResult.multiplier
    : currentMul;

  return (
    <div className="main-content" style={{ maxWidth: 640 }}>
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Aviator</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Game screen */}
      <div className={`aviator-screen ${phase === 'flying' ? 'flying' : ''} ${crashed ? 'crashed' : ''}`}>
        <div className="aviator-bg" />
        <Plane
          size={48}
          className="aviator-plane"
          style={{
            transform: `translate(${Math.min(currentMul * 30, 300)}px, ${-Math.min(currentMul * 15, 150)}px) rotate(-15deg)`,
          }}
        />
        <div className="aviator-multiplier">
          {phase === 'idle' ? (
            <div className="aviator-idle-text">Ready to fly?</div>
          ) : (
            <>
              <span className={`aviator-mul-value ${crashed ? 'crashed' : phase === 'result' ? 'cashed' : ''}`}>
                {displayMul.toFixed(2)}×
              </span>
              {phase === 'result' && (
                <div className={`aviator-status ${lastResult?.won ? 'won' : 'lost'}`}>
                  {lastResult?.won ? (
                    <>Cashed out at {lastResult.multiplier.toFixed(2)}× — Won ₹{lastResult.payout}</>
                  ) : (
                    <>Crashed at {lastResult?.crashPoint?.toFixed(2)}× — Lost ₹{stake}</>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      {phase === 'idle' && (
        <>
          <div className="game-section">
            <div className="game-section-title">Stake</div>
            <div className="game-stake-grid">
              {STAKES.map(s => (
                <button
                  key={s}
                  className={`game-stake-btn ${stake === s ? 'selected' : ''}`}
                  onClick={() => setStake(s)}
                >
                  ₹{s}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn" onClick={startFlight}>
            Bet ₹{stake} & Fly
          </button>
        </>
      )}

      {phase === 'flying' && (
        <>
          <div className="aviator-live-payout">
            Current payout: <strong>₹{(stake * currentMul).toFixed(0)}</strong>
          </div>
          <button className="btn btn-danger btn-lg game-play-btn aviator-cashout-btn" onClick={cashout}>
            Cash Out @ {currentMul.toFixed(2)}×
          </button>
        </>
      )}

      {phase === 'result' && (
        <button className="btn btn-primary btn-lg game-play-btn" onClick={playAgain}>
          Play Again
        </button>
      )}
    </div>
  );
}
