import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';
import { onGameEvent } from '../../utils/gameSocket';

const STAKES = [10, 20, 50, 100, 500, 1000, 2000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;

const computeMultiplier = (startedAt) => {
  if (!startedAt) return 1;
  const t = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(1, Math.pow(1.06, t));
};

const crashColor = (m) => {
  if (m < 2) return '#60a5fa';
  if (m < 10) return '#c084fc';
  return '#fbbf24';
};

export default function Aviator() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(10);
  const [round, setRound] = useState(null);          // shared flight state
  const [myBet, setMyBet] = useState(null);          // my bet on current round
  const [currentMul, setCurrentMul] = useState(1.0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cashResult, setCashResult] = useState(null); // { multiplier, payout }
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const rafRef = useRef(null);
  const tickRef = useRef(null);

  // Socket + initial state
  useEffect(() => {
    api.get('/games/aviator/current').then(r => setRound(r.data)).catch(() => {});
    const off = onGameEvent('aviator:state', (s) => {
      setRound(s);
      // New flight starting — reset local state
      if (s.phase === 'waiting') {
        setCashResult(null);
      }
      if (s.phase === 'crashed') {
        // Refresh my bet and balance
        api.get('/games/aviator/my-bet').then(r => setMyBet(r.data?.bet || null)).catch(() => {});
        api.get('/auth/me').then(r => updateBalance(r.data.balance)).catch(() => {});
      }
    });
    return off;
  }, []);

  // Fetch my bet on each round change
  useEffect(() => {
    if (!round?.roundId || !user) { setMyBet(null); return; }
    api.get('/games/aviator/my-bet').then(r => setMyBet(r.data?.bet || null)).catch(() => {});
  }, [round?.roundId, user]);

  // Countdown ticker (for betting phase)
  useEffect(() => {
    const target = round?.bettingEndsAt ? new Date(round.bettingEndsAt).getTime() : null;
    if (!target || round?.phase !== 'waiting') { setSecondsLeft(0); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    tickRef.current = setInterval(tick, 250);
    return () => clearInterval(tickRef.current);
  }, [round?.bettingEndsAt, round?.phase]);

  // Multiplier animation while flying
  useEffect(() => {
    if (round?.phase !== 'flying' || !round?.startedAt) { setCurrentMul(1.0); return; }
    const tick = () => {
      setCurrentMul(computeMultiplier(round.startedAt));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [round?.phase, round?.startedAt]);

  const canBet = round?.phase === 'waiting' && secondsLeft > 0 && !myBet;

  const placeBet = async () => {
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlacing(true);
    try {
      const res = await api.post('/games/aviator/start', { stake });
      updateBalance(res.data.newBalance);
      // Refresh my bet
      const r = await api.get('/games/aviator/my-bet');
      setMyBet(r.data?.bet || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const cashout = async () => {
    if (!myBet || myBet.status !== 'pending' || cashingOut) return;
    setCashingOut(true);
    try {
      const res = await api.post('/games/aviator/cashout', { betId: myBet._id });
      updateBalance(res.data.newBalance);
      setCashResult({ multiplier: res.data.multiplier, payout: res.data.payout });
      // Mark my bet as settled locally
      setMyBet(prev => prev ? { ...prev, status: 'settled', won: true, multiplier: res.data.multiplier, payout: res.data.payout } : prev);
    } catch (err) {
      setError(err.response?.data?.message || 'Cashout failed');
    } finally {
      setCashingOut(false);
    }
  };

  const phase = round?.phase;
  const crashed = phase === 'crashed';
  const flying = phase === 'flying';
  const waiting = phase === 'waiting';

  const displayMul = flying ? currentMul : (crashed ? round?.crashPoint : 1.0);

  const iCashedOut = cashResult || (myBet?.status === 'settled' && myBet?.won);
  const iLost = myBet?.status === 'settled' && !myBet?.won;

  const history = round?.lastCrashes || [];

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

      {history.length > 0 && (
        <div className="crash-history-bar">
          {history.map((h, i) => (
            <span key={i} className="crash-chip" style={{ color: crashColor(h.crashPoint) }}>
              {h.crashPoint.toFixed(2)}x
            </span>
          ))}
        </div>
      )}

      <div className={`aviator-screen ${flying ? 'flying' : ''} ${crashed ? 'crashed' : ''}`}>
        <AviatorSky crashed={crashed} />
        <AxisDots />

        {flying && <FlightPath currentMul={currentMul} crashed={false} />}
        {crashed && <FlightPath currentMul={round.crashPoint || 1} crashed={true} />}

        <div className="aviator-multiplier">
          {waiting ? (
            <div className="aviator-idle-text">
              <span className="aviator-ready-title">Next flight in {secondsLeft}s</span>
              {myBet ? (
                <span className="aviator-ready-sub">You bet ₹{myBet.stake} — wait for takeoff</span>
              ) : (
                <span className="aviator-ready-sub">Place your bet now</span>
              )}
            </div>
          ) : (
            <>
              <span className={`aviator-mul-value ${crashed ? 'crashed' : iCashedOut ? 'cashed' : ''}`}>
                {Number(displayMul || 1).toFixed(2)}x
              </span>
              {crashed && (
                <div className={`aviator-status ${iCashedOut ? 'won' : iLost ? 'lost' : ''}`}>
                  {iCashedOut ? (
                    <>Cashed out @ {(cashResult?.multiplier || myBet?.multiplier).toFixed(2)}× — +₹{cashResult?.payout || myBet?.payout}</>
                  ) : iLost ? (
                    <>FLEW AWAY @ {round.crashPoint.toFixed(2)}× — lost ₹{myBet.stake}</>
                  ) : (
                    <>FLEW AWAY @ {round.crashPoint.toFixed(2)}×</>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {flying && <PlaneShape currentMul={currentMul} crashed={false} />}
        {crashed && <PlaneShape currentMul={round.crashPoint || 1} crashed={true} />}
      </div>

      {/* Controls by phase */}
      {waiting && !myBet && (
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
                <input type="number" min={MIN_STAKE} max={MAX_STAKE} step="1"
                  value={stake}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v)) setStake(v); }}
                  placeholder={`${MIN_STAKE}-${MAX_STAKE}`} />
              </div>
              <span className="custom-stake-hint">Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn" onClick={placeBet} disabled={placing || !canBet}>
            {placing ? 'Placing...' : `Bet ₹${stake}`}
          </button>
        </>
      )}

      {waiting && myBet && (
        <div className="aviator-live-payout">
          Bet locked in — waiting for takeoff ({secondsLeft}s)
        </div>
      )}

      {flying && myBet?.status === 'pending' && (
        <>
          <div className="aviator-live-payout">
            Current payout: <strong>₹{(myBet.stake * currentMul).toFixed(0)}</strong>
          </div>
          <button className="btn btn-danger btn-lg game-play-btn aviator-cashout-btn"
            onClick={cashout} disabled={cashingOut}>
            Cash Out @ {currentMul.toFixed(2)}× — ₹{(myBet.stake * currentMul).toFixed(0)}
          </button>
        </>
      )}

      {flying && (!myBet || myBet.status !== 'pending') && (
        <div className="aviator-live-payout">
          Plane is flying — betting on next flight
        </div>
      )}

      {crashed && (
        <div className="aviator-live-payout">
          Next flight starting soon...
        </div>
      )}
    </div>
  );
}

// ----- Reuse existing sub-components -----
function pathCoords(mul, crashed) {
  const progress = Math.min(1, 1 - 1 / (0.8 + mul));
  const x = 0.06 + progress * 0.88;
  const y = 0.88 - progress * 0.72;
  if (crashed) return { x: Math.min(0.95, x + 0.05), y: Math.min(0.98, y + 0.40), rot: 60 };
  const rot = -26 + progress * 14;
  return { x, y, rot };
}

function PlaneShape({ currentMul, crashed }) {
  const { x, y, rot } = pathCoords(currentMul, crashed);
  return (
    <div
      className={`aviator-plane-wrap ${crashed ? 'falling' : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
    >
      <svg className="aviator-plane-svg" width="86" height="42" viewBox="0 0 86 42">
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
        <path d="M 4 21 L 14 10 L 20 12 L 22 21 L 20 30 L 14 32 Z" fill="url(#redWing)" stroke="#450a0a" strokeWidth="0.6" />
        <ellipse cx="50" cy="21" rx="34" ry="7" fill="url(#redBody)" stroke="#450a0a" strokeWidth="0.7" />
        <path d="M 36 21 L 52 6 L 60 7 L 56 21 Z" fill="url(#redWing)" stroke="#450a0a" strokeWidth="0.6" />
        <path d="M 36 21 L 52 36 L 60 35 L 56 21 Z" fill="#991b1b" stroke="#450a0a" strokeWidth="0.6" opacity="0.92" />
        <ellipse cx="62" cy="18" rx="8" ry="3" fill="#1e293b" stroke="#0f172a" strokeWidth="0.5" />
        <ellipse cx="62" cy="17" rx="5" ry="1" fill="rgba(255,255,255,0.35)" />
        <path d="M 80 21 L 86 20 L 86 22 Z" fill="#450a0a" />
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
  const cx = (startX + x) / 2;
  const cy = startY;
  const toVB = (v) => (v * 100).toFixed(2);
  const curve = `M ${toVB(startX)} ${toVB(startY)} Q ${toVB(cx)} ${toVB(cy)}, ${toVB(x)} ${toVB(y)}`;
  const fillPath = `${curve} L ${toVB(x)} 100 L ${toVB(startX)} 100 Z`;

  return (
    <svg className="aviator-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(239, 68, 68, 0.55)" />
          <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#curveFill)" />
      <path d={curve} stroke={crashed ? '#f87171' : '#ef4444'} strokeWidth="0.6" fill="none" strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.8))' }} />
    </svg>
  );
}

function AviatorSky({ crashed }) {
  return <div className={`aviator-sky ${crashed ? 'crashed' : ''}`} />;
}

function AxisDots() {
  return (
    <>
      <div className="axis-row axis-bottom">{Array.from({ length: 8 }, (_, i) => <span key={i} className="axis-dot" />)}</div>
      <div className="axis-row axis-left">{Array.from({ length: 7 }, (_, i) => <span key={i} className="axis-dot" />)}</div>
    </>
  );
}
