import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Dice5 } from 'lucide-react';
import api from '../../utils/api';
import { onGameEvent } from '../../utils/gameSocket';

const STAKES = [10, 50, 100, 500, 1000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;
const PAYOUT = 3.6;
const TRACK = 50;

const COLORS = [
  { id: 'red',    label: 'Red',    hex: '#ef4444', soft: '#fee2e2', pos: 'bottom-left' },
  { id: 'blue',   label: 'Blue',   hex: '#3b82f6', soft: '#dbeafe', pos: 'bottom-right' },
  { id: 'green',  label: 'Green',  hex: '#22c55e', soft: '#dcfce7', pos: 'top-left' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308', soft: '#fef9c3', pos: 'top-right' },
];

// Pattern of pips on a dice face for values 1-6
const dicePips = (v) => {
  const patterns = {
    1: [[0,0,0],[0,1,0],[0,0,0]],
    2: [[1,0,0],[0,0,0],[0,0,1]],
    3: [[1,0,0],[0,1,0],[0,0,1]],
    4: [[1,0,1],[0,0,0],[1,0,1]],
    5: [[1,0,1],[0,1,0],[1,0,1]],
    6: [[1,0,1],[1,0,1],[1,0,1]],
  };
  return patterns[v] || patterns[1];
};

export default function LudoGame() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [selection, setSelection] = useState(null);
  const [stake, setStake] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [round, setRound] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shakeColor, setShakeColor] = useState(null);
  const tickRef = useRef(null);

  // Fetch initial state + subscribe
  useEffect(() => {
    api.get('/games/ludo/current').then(r => setRound(r.data)).catch(() => {});
    const offRound = onGameEvent('ludo:round', (r) => {
      setRound(r);
      if (r.phase === 'betting') { setMyBets([]); setSelection(null); }
    });
    const offTurn = onGameEvent('ludo:turn', (t) => {
      setRound(prev => prev ? {
        ...prev,
        positions: t.positions,
        lastRoll: t.roll,
        turnNumber: t.turnNumber,
        winner: t.winner,
        phase: t.winner ? 'revealing' : 'racing',
      } : prev);
      // Shake the winning dice roll briefly
      const maxRoll = Math.max(...Object.values(t.roll));
      const topColor = Object.keys(t.roll).find(c => t.roll[c] === maxRoll);
      setShakeColor(topColor);
      setTimeout(() => setShakeColor(null), 400);
    });
    return () => { offRound(); offTurn(); };
  }, []);

  // Load my bets
  useEffect(() => {
    if (!round?.roundId || !user) return;
    api.get('/games/ludo/my-bets').then(r => setMyBets(r.data || [])).catch(() => {});
    if (round.phase === 'revealing') {
      api.get('/auth/me').then(r => updateBalance(r.data.balance)).catch(() => {});
    }
  }, [round?.roundId, round?.phase, user]);

  // Countdown
  useEffect(() => {
    const target = round?.bettingEndsAt ? new Date(round.bettingEndsAt).getTime() : null;
    if (!target || round?.phase !== 'betting') { setSecondsLeft(0); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    tickRef.current = setInterval(tick, 250);
    return () => clearInterval(tickRef.current);
  }, [round?.bettingEndsAt, round?.phase]);

  const isBetting = round?.phase === 'betting' && secondsLeft > 0;
  const racing = round?.phase === 'racing';
  const revealing = round?.phase === 'revealing';

  const placeBet = async () => {
    if (!selection) { setError('Pick a color'); return; }
    if (!isBetting) { setError('Betting closed'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlacing(true);
    try {
      const res = await api.post('/games/ludo', { selection, stake });
      updateBalance(res.data.newBalance);
      const mb = await api.get('/games/ludo/my-bets');
      setMyBets(mb.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const winner = round?.winner;
  const positions = round?.positions || { red: 0, blue: 0, green: 0, yellow: 0 };
  const lastRoll = round?.lastRoll || {};
  const history = round?.lastResults || [];

  return (
    <div className="main-content ludo-page" style={{ maxWidth: 720 }}>
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Ludo Race</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Round status bar */}
      <div className="coinflip-round-bar" style={{ marginBottom: 14 }}>
        <div>
          <div className="coinflip-phase">
            {isBetting && 'Betting open'}
            {racing && `Racing · Turn ${round?.turnNumber || 0}`}
            {revealing && winner && `${winner.toUpperCase()} WINS!`}
          </div>
          <div className="coinflip-timer">
            {isBetting ? `${secondsLeft}s` : racing ? '...' : '✓'}
          </div>
        </div>
        <div className="coinflip-round-id">Round {round?.roundId?.slice(-8) || '—'}</div>
      </div>

      {/* Recent winners strip */}
      {history.length > 0 && (
        <div className="ludo-recent">
          <span className="ludo-recent-label">Last:</span>
          {history.slice(0, 10).map((r, i) => {
            const c = COLORS.find(x => x.id === r.winner);
            return <span key={i} className="ludo-recent-dot" style={{ background: c?.hex || '#888' }} title={r.winner} />;
          })}
        </div>
      )}

      {/* The Ludo Board — 2x2 colored corners with big dice */}
      <div className="ludo-board-v2">
        {COLORS.map(c => {
          const progress = Math.min(100, (positions[c.id] / TRACK) * 100);
          const roll = lastRoll[c.id] || 0;
          const isWinner = winner === c.id;
          const isLoser = winner && winner !== c.id;
          return (
            <div
              key={c.id}
              className={`ludo-corner ${c.pos} ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}`}
              style={{ '--c': c.hex, '--soft': c.soft }}
            >
              <div className={`ludo-dice ${shakeColor === c.id ? 'rolling' : ''}`}>
                {roll > 0 ? (
                  <div className="dice-face">
                    {dicePips(roll).map((row, ri) => row.map((on, ci) => (
                      <span key={`${ri}-${ci}`} className={`dice-pip ${on ? 'on' : ''}`} style={{ background: on ? c.hex : 'transparent' }} />
                    )))}
                  </div>
                ) : (
                  <div className="dice-face idle" style={{ color: c.hex }}>
                    <Dice5 size={48} />
                  </div>
                )}
              </div>
              <div className="ludo-corner-label">{c.label}</div>
              <div className="ludo-corner-track">
                <div className="ludo-corner-fill" style={{ width: `${progress}%` }} />
                <span className="ludo-corner-progress">{positions[c.id]}/{TRACK}</span>
              </div>
            </div>
          );
        })}

        {/* Center cross decoration */}
        <div className="ludo-center">
          <div className="ludo-center-triangle t-top" />
          <div className="ludo-center-triangle t-right" />
          <div className="ludo-center-triangle t-bottom" />
          <div className="ludo-center-triangle t-left" />
        </div>
      </div>

      {/* My bets */}
      {myBets.length > 0 && (
        <div className="wingo-mybets">
          <strong>Your bets:</strong>
          {myBets.map(b => (
            <span key={b._id} className="wingo-mybet-chip" style={{ textTransform: 'capitalize' }}>
              {b.selection} · ₹{b.stake}
              {b.status === 'settled' && (b.won ? ` · +₹${b.payout}` : ' · lost')}
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      {isBetting && (
        <>
          <div className="game-section">
            <div className="game-section-title">Pick a color to win</div>
            <div className="ludo-color-grid">
              {COLORS.map(c => (
                <button key={c.id}
                  className={`ludo-color-btn ${selection === c.id ? 'selected' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setSelection(c.id)}
                  disabled={placing}
                >
                  {c.label}
                  <span className="ludo-color-payout">{PAYOUT}×</span>
                </button>
              ))}
            </div>
          </div>

          <div className="game-section">
            <div className="game-section-title">Stake</div>
            <div className="game-stake-grid">
              {STAKES.map(s => (
                <button key={s} className={`game-stake-btn ${stake === s ? 'selected' : ''}`}
                  onClick={() => setStake(s)} disabled={placing}>
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
                  disabled={placing} placeholder={`${MIN_STAKE}-${MAX_STAKE}`} />
              </div>
              <span className="custom-stake-hint">Win ₹{(stake * PAYOUT).toFixed(0)} • Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn" onClick={placeBet}
            disabled={!selection || placing || !isBetting}>
            <Dice5 size={18} /> Bet ₹{stake}
          </button>
        </>
      )}

      {racing && (
        <div className="aviator-live-payout">
          <Dice5 size={16} style={{ verticalAlign: '-3px' }} /> Race in progress — pawns moving...
        </div>
      )}

      {revealing && (
        <div className="aviator-live-payout">
          Next race starting soon...
        </div>
      )}
    </div>
  );
}
