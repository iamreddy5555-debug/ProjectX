import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';

const STAKES = [10, 20, 50, 100, 500, 1000, 2000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;

// Local multiplier from elapsed time — MUST match the server formula
// Server: multiplier = 1.06^tSec
const computeMultiplier = (startedAt) => {
  const t = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(1, Math.pow(1.06, t));
};

// Color-code a crash multiplier for the history bar
const crashColor = (m) => {
  if (m < 2) return '#60a5fa';      // blue — low
  if (m < 10) return '#c084fc';     // purple — medium
  return '#fbbf24';                  // gold — big win
};

export default function Aviator() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(10);
  const [phase, setPhase] = useState('idle');
  const [betId, setBetId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [currentMul, setCurrentMul] = useState(1.0);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [crashed, setCrashed] = useState(false);
  const [history, setHistory] = useState([]);
  const rafRef = useRef(null);
  const cashingOut = useRef(false);

  // Resume pending bet
  useEffect(() => {
    api.get('/games/aviator/pending').then(res => {
      if (res.data.pending) {
        setBetId(res.data.betId);
        setStartedAt(res.data.startedAt);
        setStake(res.data.stake);
        setPhase('flying');
      }
    }).catch(() => {});
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/games/aviator/crashes');
      setHistory(res.data);
    } catch {}
  };

  useEffect(() => {
    if (phase !== 'flying' || !startedAt) return;
    const tick = () => {
      setCurrentMul(computeMultiplier(startedAt));
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
      loadHistory();
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
    loadHistory();
  };

  const displayMul = phase === 'result' && lastResult ? lastResult.multiplier : currentMul;

  return (
    <div className="main-content aviator-page" style={{ maxWidth: 760 }}>
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <div className="aviator-logo">
          <span className="aviator-logo-text">Aviator</span>
        </div>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Crash history bar */}
      {history.length > 0 && (
        <div className="crash-history-bar">
          {history.map((h, i) => (
            <span key={i} className="crash-chip" style={{ color: crashColor(h.crashPoint) }}>
              {h.crashPoint.toFixed(2)}x
            </span>
          ))}
        </div>
      )}

      {/* Game screen */}
      <div className={`aviator-screen ${phase === 'flying' ? 'flying' : ''} ${crashed ? 'crashed' : ''}`}>
        <AviatorSky crashed={crashed} />
        <AxisDots />

        {phase !== 'idle' && <FlightPath currentMul={currentMul} crashed={crashed} />}

        {/* Multiplier sits in the middle, BEHIND the plane */}
        <div className="aviator-multiplier">
          {phase === 'idle' ? (
            <div className="aviator-idle-text">
              <span className="aviator-ready-title">Waiting for bet</span>
            </div>
          ) : (
            <>
              <span className={`aviator-mul-value ${crashed ? 'crashed' : phase === 'result' ? 'cashed' : ''}`}>
                {displayMul.toFixed(2)}x
              </span>
              {phase === 'result' && (
                <div className={`aviator-status ${lastResult?.won ? 'won' : 'lost'}`}>
                  {lastResult?.won
                    ? <>Cashed out @ {lastResult.multiplier.toFixed(2)}× — ₹{lastResult.payout}</>
                    : <>FLEW AWAY @ {lastResult?.crashPoint?.toFixed(2)}× — Lost ₹{stake}</>}
                </div>
              )}
            </>
          )}
        </div>

        {phase !== 'idle' && <PlaneShape phase={phase} currentMul={currentMul} crashed={crashed} />}
      </div>

      {/* Controls */}
      {phase === 'idle' && (
        <>
          <div className="game-section">
            <div className="game-section-title">Stake</div>
            <div className="game-stake-grid">
              {STAKES.map(s => (
                <button key={s} className={`game-stake-btn ${stake === s ? 'selected' : ''}`} onClick={() => setStake(s)}>
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
                  placeholder={`${MIN_STAKE}-${MAX_STAKE}`}
                />
              </div>
              <span className="custom-stake-hint">Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn aviator-bet-btn" onClick={startFlight}>
            BET ₹{stake}
          </button>
        </>
      )}

      {phase === 'flying' && (
        <>
          <div className="aviator-live-payout">
            Current payout: <strong>₹{(stake * currentMul).toFixed(0)}</strong>
          </div>
          <button className="btn btn-danger btn-lg game-play-btn aviator-cashout-btn" onClick={cashout}>
            CASH OUT @ {currentMul.toFixed(2)}× — ₹{(stake * currentMul).toFixed(0)}
          </button>
        </>
      )}

      {phase === 'result' && (
        <button className="btn btn-primary btn-lg game-play-btn aviator-bet-btn" onClick={playAgain}>
          Play Again
        </button>
      )}
    </div>
  );
}

// Map multiplier to normalized path coords (0..1)
function pathCoords(mul, crashed) {
  const progress = Math.min(1, 1 - 1 / (0.8 + mul));
  const x = 0.06 + progress * 0.88;  // 6% -> 94%
  const y = 0.88 - progress * 0.72;  // 88% -> 16%
  if (crashed) return { x: Math.min(0.95, x + 0.05), y: Math.min(0.98, y + 0.40), rot: 60 };
  const rot = -26 + progress * 14;
  return { x, y, rot };
}

function PlaneShape({ phase, currentMul, crashed }) {
  const { x, y, rot } = pathCoords(currentMul, crashed);
  return (
    <div
      className={`aviator-plane-wrap ${phase === 'result' && !crashed ? 'cashed-out' : ''} ${crashed ? 'falling' : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
    >
      <svg className="aviator-plane-svg" width="86" height="42" viewBox="0 0 86 42" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="redBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="40%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <linearGradient id="redWing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
        </defs>

        {/* Rear fuselage / tail */}
        <path d="M 4 21 L 14 10 L 20 12 L 22 21 L 20 30 L 14 32 Z" fill="url(#redWing)" stroke="#450a0a" strokeWidth="0.6" />

        {/* Main body */}
        <ellipse cx="50" cy="21" rx="34" ry="7" fill="url(#redBody)" stroke="#450a0a" strokeWidth="0.7" />

        {/* Top wing */}
        <path d="M 36 21 L 52 6 L 60 7 L 56 21 Z" fill="url(#redWing)" stroke="#450a0a" strokeWidth="0.6" />
        {/* Bottom wing */}
        <path d="M 36 21 L 52 36 L 60 35 L 56 21 Z" fill="#991b1b" stroke="#450a0a" strokeWidth="0.6" opacity="0.92" />

        {/* Cockpit window */}
        <ellipse cx="62" cy="18" rx="8" ry="3" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
        <ellipse cx="62" cy="17" rx="5" ry="1" fill="rgba(255,255,255,0.35)" />

        {/* Nose cone */}
        <path d="M 80 21 L 86 20 L 86 22 Z" fill="#450a0a" />

        {/* Propeller hub */}
        <circle cx="80" cy="21" r="2" fill="#450a0a" />
        <g className="aviator-prop">
          <ellipse cx="80" cy="21" rx="0.8" ry="7" fill="rgba(255,255,255,0.45)" />
        </g>
      </svg>
    </div>
  );
}

function FlightPath({ currentMul, crashed }) {
  const { x, y } = pathCoords(currentMul, crashed);
  const startX = 0.06, startY = 0.88;

  // Quadratic bezier via the curve's lower control point for a nice arc
  const cx = (startX + x) / 2;
  const cy = startY;

  // SVG viewBox uses 0..100
  const toVB = (v) => (v * 100).toFixed(2);

  const curve = `M ${toVB(startX)} ${toVB(startY)} Q ${toVB(cx)} ${toVB(cy)}, ${toVB(x)} ${toVB(y)}`;
  const fillPath = `${curve} L ${toVB(x)} 100 L ${toVB(startX)} 100 Z`;

  return (
    <svg
      className="aviator-path-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(239, 68, 68, 0.55)" />
          <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#curveFill)" />
      <path
        d={curve}
        stroke={crashed ? '#f87171' : '#ef4444'}
        strokeWidth="0.6"
        fill="none"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.8))' }}
      />
    </svg>
  );
}

function AviatorSky({ crashed }) {
  return <div className={`aviator-sky ${crashed ? 'crashed' : ''}`} />;
}

function AxisDots() {
  // 8 dots along bottom, 8 along left
  const bottomDots = Array.from({ length: 8 }, (_, i) => i);
  const leftDots = Array.from({ length: 7 }, (_, i) => i);
  return (
    <>
      <div className="axis-row axis-bottom">
        {bottomDots.map(i => <span key={i} className="axis-dot" />)}
      </div>
      <div className="axis-row axis-left">
        {leftDots.map(i => <span key={i} className="axis-dot" />)}
      </div>
    </>
  );
}
