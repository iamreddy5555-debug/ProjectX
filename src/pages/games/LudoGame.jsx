import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Dice5, Flag } from 'lucide-react';
import api from '../../utils/api';

const STAKES = [10, 50, 100, 500, 1000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;
const PAYOUT = 3.6;

const COLORS = [
  { id: 'red',    label: 'Red',    hex: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)' },
  { id: 'blue',   label: 'Blue',   hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  { id: 'green',  label: 'Green',  hex: '#22c55e', glow: 'rgba(34, 197, 94, 0.5)' },
  { id: 'yellow', label: 'Yellow', hex: '#fbbf24', glow: 'rgba(251, 191, 36, 0.5)' },
];

const TRACK_LENGTH = 50;

export default function LudoGame() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [selection, setSelection] = useState(null);
  const [stake, setStake] = useState(10);
  const [phase, setPhase] = useState('idle');   // idle | racing | result
  const [positions, setPositions] = useState({ red: 0, blue: 0, green: 0, yellow: 0 });
  const [currentRolls, setCurrentRolls] = useState({ red: 0, blue: 0, green: 0, yellow: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => { loadRecent(); }, []);

  const loadRecent = async () => {
    try {
      const res = await api.get('/games/ludo/recent');
      setRecent(res.data);
    } catch {}
  };

  const play = async () => {
    if (!selection) { setError('Pick a color to bet on'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setResult(null);
    setPhase('racing');
    setPositions({ red: 0, blue: 0, green: 0, yellow: 0 });

    try {
      const res = await api.post('/games/ludo', { selection, stake });
      updateBalance(res.data.newBalance);

      // Animate the race using the returned rolls sequence
      const rolls = res.data.race.rolls;
      let turn = 0;
      const pos = { red: 0, blue: 0, green: 0, yellow: 0 };

      const step = () => {
        if (turn >= rolls.length) {
          // Snap winner to full, reveal result
          pos[res.data.winner] = TRACK_LENGTH;
          setPositions({ ...pos });
          setTimeout(() => {
            setResult(res.data);
            setPhase('result');
            loadRecent();
          }, 600);
          return;
        }
        const roll = rolls[turn];
        setCurrentRolls(roll);
        for (const c of Object.keys(roll)) {
          pos[c] = Math.min(TRACK_LENGTH, pos[c] + roll[c]);
        }
        setPositions({ ...pos });
        turn++;
        timerRef.current = setTimeout(step, 550);
      };
      step();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to play');
      setPhase('idle');
    }
  };

  const playAgain = () => {
    clearTimeout(timerRef.current);
    setPhase('idle');
    setResult(null);
    setSelection(null);
    setPositions({ red: 0, blue: 0, green: 0, yellow: 0 });
    setCurrentRolls({ red: 0, blue: 0, green: 0, yellow: 0 });
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="main-content ludo-page" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Ludo Race</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Recent winners */}
      {recent.length > 0 && (
        <div className="ludo-recent">
          <span className="ludo-recent-label">Last:</span>
          {recent.slice(0, 10).map((r, i) => {
            const c = COLORS.find(x => x.id === r.winner);
            return <span key={i} className="ludo-recent-dot" style={{ background: c?.hex || '#888' }} />;
          })}
        </div>
      )}

      {/* Race track */}
      <div className="ludo-board">
        <div className="ludo-finish-line"><Flag size={14} /> Finish</div>
        {COLORS.map(c => {
          const isWinner = phase === 'result' && result?.winner === c.id;
          const isLoser = phase === 'result' && result?.winner !== c.id;
          const progress = Math.min(100, (positions[c.id] / TRACK_LENGTH) * 100);
          return (
            <div key={c.id} className={`ludo-lane ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}`}>
              <div className="ludo-lane-label" style={{ color: c.hex }}>{c.label}</div>
              <div className="ludo-lane-track">
                <div
                  className="ludo-lane-fill"
                  style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${c.hex}44, ${c.hex})` }}
                />
                <div
                  className={`ludo-pawn ${phase === 'racing' ? 'racing' : ''}`}
                  style={{
                    left: `calc(${progress}% - 18px)`,
                    background: `radial-gradient(circle at 30% 30%, #fff, ${c.hex})`,
                    boxShadow: `0 0 12px ${c.glow}, inset 0 -3px 4px rgba(0,0,0,0.25)`,
                  }}
                />
                {phase === 'racing' && currentRolls[c.id] > 0 && (
                  <span className="ludo-dice-chip" style={{ color: c.hex, borderColor: c.hex }}>
                    <Dice5 size={10} /> {currentRolls[c.id]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result popup */}
      {result && (
        <div className={`ludo-result ${result.won ? 'won' : 'lost'}`}>
          <div className="ludo-result-winner">
            Winner: <strong style={{ color: COLORS.find(c => c.id === result.winner)?.hex }}>{result.winner.toUpperCase()}</strong>
          </div>
          <div className="ludo-result-payout">
            {result.won ? `You won ₹${result.payout}!` : `You lost ₹${stake}`}
          </div>
        </div>
      )}

      {/* Controls */}
      {phase === 'idle' && (
        <>
          <div className="game-section">
            <div className="game-section-title">Pick a color to win</div>
            <div className="ludo-color-grid">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  className={`ludo-color-btn ${selection === c.id ? 'selected' : ''}`}
                  style={{ background: c.hex, '--glow': c.glow }}
                  onClick={() => setSelection(c.id)}
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
              <span className="custom-stake-hint">Win ₹{(stake * PAYOUT).toFixed(0)} • Min ₹{MIN_STAKE} • Max ₹{MAX_STAKE}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn" onClick={play} disabled={!selection}>
            <Dice5 size={18} /> Roll the Dice — ₹{stake}
          </button>
        </>
      )}

      {phase === 'result' && (
        <button className="btn btn-primary btn-lg game-play-btn" onClick={playAgain}>
          Play Again
        </button>
      )}

      {phase === 'racing' && (
        <div className="ludo-racing-hint">
          <Dice5 size={16} /> Racing... don't look away!
        </div>
      )}
    </div>
  );
}
