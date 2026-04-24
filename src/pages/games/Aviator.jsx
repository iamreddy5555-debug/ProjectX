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

export default function Aviator() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(10);
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
        <AviatorSky phase={phase} crashed={crashed} />

        {/* Flight path curve */}
        {phase !== 'idle' && (
          <FlightPath currentMul={currentMul} crashed={crashed} />
        )}

        {/* Plane */}
        {phase !== 'idle' && (
          <PlaneShape phase={phase} currentMul={currentMul} crashed={crashed} />
        )}

        {/* Multiplier display */}
        <div className="aviator-multiplier">
          {phase === 'idle' ? (
            <div className="aviator-idle-text">
              <span className="aviator-ready-title">Ready for takeoff</span>
              <span className="aviator-ready-sub">Pick a stake and launch</span>
            </div>
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

// Position on a curved flight path — maps multiplier to (x%, y%) inside the screen.
// x grows from 10% → 85% as multiplier grows; y is an upward curve from 80% to 15%.
function pathPosition(mul, crashed) {
  // Progress from 0 to 1 based on multiplier (asymptotic)
  const progress = Math.min(1, 1 - 1 / (0.8 + mul));
  const x = 10 + progress * 75; // 10% -> 85%
  const y = 80 - progress * 65; // 80% -> 15%
  if (crashed) return { x: x + 5, y: y + 45, rot: 60 };
  const rot = -28 + progress * 18; // steeper on takeoff, levels out
  return { x, y, rot };
}

function PlaneShape({ phase, currentMul, crashed }) {
  const { x, y, rot } = pathPosition(currentMul, crashed);
  return (
    <div
      className={`aviator-plane-wrap ${phase === 'result' && !crashed ? 'cashed-out' : ''} ${crashed ? 'falling' : ''}`}
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
    >
      {/* Trail (smoke) */}
      <div className="aviator-trail" />
      {/* Plane SVG */}
      <svg className="aviator-plane-svg" width="92" height="48" viewBox="0 0 92 48" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="wingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <linearGradient id="cockpitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="60%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <radialGradient id="flame" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="rgba(239,68,68,0)" />
          </radialGradient>
        </defs>

        {/* Exhaust flame (only while flying) */}
        {phase === 'flying' && !crashed && (
          <ellipse cx="3" cy="24" rx="8" ry="4" fill="url(#flame)" className="aviator-flame" />
        )}

        {/* Tail fin */}
        <path d="M 12 24 L 22 10 L 28 12 L 26 24 Z" fill="url(#wingGrad)" stroke="#78350f" strokeWidth="0.5" />
        {/* Lower tail */}
        <path d="M 12 24 L 22 38 L 28 36 L 26 24 Z" fill="#b45309" stroke="#78350f" strokeWidth="0.5" opacity="0.85" />

        {/* Main body */}
        <ellipse cx="55" cy="24" rx="37" ry="8" fill="url(#bodyGrad)" stroke="#78350f" strokeWidth="0.6" />

        {/* Top wing */}
        <path d="M 42 24 L 58 8 L 66 10 L 60 24 Z" fill="url(#wingGrad)" stroke="#78350f" strokeWidth="0.6" />
        {/* Bottom wing */}
        <path d="M 42 24 L 58 40 L 66 38 L 60 24 Z" fill="#b45309" stroke="#78350f" strokeWidth="0.6" opacity="0.9" />

        {/* Cockpit canopy */}
        <ellipse cx="68" cy="20" rx="10" ry="4" fill="url(#cockpitGrad)" stroke="#0f172a" strokeWidth="0.5" />
        <ellipse cx="68" cy="20" rx="10" ry="4" fill="rgba(255,255,255,0.2)" className="aviator-cockpit-shine" />

        {/* Nose */}
        <path d="M 85 24 L 92 23 L 92 25 Z" fill="#78350f" />

        {/* Propeller spinner */}
        <circle cx="85" cy="24" r="2.5" fill="#78350f" stroke="#431407" strokeWidth="0.3" />
        <g className="aviator-prop">
          <ellipse cx="85" cy="24" rx="1" ry="9" fill="rgba(255,255,255,0.4)" />
        </g>
      </svg>
    </div>
  );
}

function FlightPath({ currentMul, crashed }) {
  const { x, y } = pathPosition(currentMul, crashed);
  // Build SVG path — curved line from starting point to current plane position
  const startX = 10, startY = 80;
  const pathD = `M ${startX}% ${startY}% Q ${(startX + x) / 2}% ${startY}%, ${x}% ${y}%`;
  return (
    <svg className="aviator-path-svg" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(251, 191, 36, 0.05)" />
          <stop offset="60%" stopColor="rgba(251, 191, 36, 0.6)" />
          <stop offset="100%" stopColor="rgba(251, 191, 36, 1)" />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        stroke={crashed ? 'rgba(239, 68, 68, 0.8)' : 'url(#trailGrad)'}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        className={`aviator-flight-line ${crashed ? 'crashed' : ''}`}
      />
    </svg>
  );
}

function AviatorSky({ phase, crashed }) {
  return (
    <div className={`aviator-sky ${crashed ? 'sunset' : ''}`}>
      <div className="aviator-stars">
        {[...Array(25)].map((_, i) => (
          <span key={i} className="aviator-star" style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 70}%`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <div className="aviator-clouds">
        <div className={`aviator-cloud c1 ${phase === 'flying' ? 'moving' : ''}`} />
        <div className={`aviator-cloud c2 ${phase === 'flying' ? 'moving' : ''}`} />
        <div className={`aviator-cloud c3 ${phase === 'flying' ? 'moving' : ''}`} />
      </div>
    </div>
  );
}

