import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Shuffle, HelpCircle } from 'lucide-react';
import api from '../../utils/api';

const MODES = [
  { id: '30sec', label: 'WinGo', sub: '30sec', seconds: 30 },
  { id: '1min',  label: 'WinGo', sub: '1 Min',  seconds: 60 },
  { id: '3min',  label: 'WinGo', sub: '3 Min',  seconds: 180 },
  { id: '5min',  label: 'WinGo', sub: '5 Min',  seconds: 300 },
];

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];
const BASE_STAKE = 10;

const colorsOfNumber = (n) => {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if ([2, 4, 6, 8].includes(n)) return ['red'];
  return ['green'];
};

// Ball styling based on a number's colors
const ballStyle = (n) => {
  const cs = colorsOfNumber(n);
  if (cs.length === 2) {
    // Split ball — two colors diagonally
    const [c1, c2] = cs;
    const map = { red: '#ef4444', green: '#22c55e', violet: '#a855f7' };
    return { background: `linear-gradient(135deg, ${map[c1]} 0%, ${map[c1]} 50%, ${map[c2]} 50%, ${map[c2]} 100%)` };
  }
  if (cs[0] === 'red') return { background: 'radial-gradient(circle at 30% 30%, #fca5a5, #dc2626 60%, #7f1d1d)' };
  if (cs[0] === 'green') return { background: 'radial-gradient(circle at 30% 30%, #86efac, #16a34a 60%, #14532d)' };
  return { background: 'radial-gradient(circle at 30% 30%, #d8b4fe, #9333ea 60%, #4c1d95)' };
};

export default function ColorGame() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('30sec');
  const [multiplier, setMultiplier] = useState(1);
  const [selection, setSelection] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [roundId, setRoundId] = useState(Date.now().toString());
  const timerRef = useRef(null);

  const modeCfg = MODES.find(m => m.id === mode);
  const stake = BASE_STAKE * multiplier;

  useEffect(() => { loadRecent(); }, []);

  // Cosmetic countdown — resets every mode interval
  useEffect(() => {
    const total = modeCfg.seconds;
    setSecondsLeft(total);
    setRoundId(`${Date.now()}`.slice(0, 13));
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          setRoundId(`${Date.now()}`.slice(0, 13));
          return total;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [mode]);

  const loadRecent = async () => {
    try {
      const res = await api.get('/games/color/recent');
      setRecent(res.data);
    } catch {}
  };

  const play = async () => {
    if (!selection) { setError('Pick a color, number, or big/small'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlaying(true);
    setResult(null);
    try {
      const res = await api.post('/games/color', { selection, stake });
      setTimeout(() => {
        setResult(res.data);
        updateBalance(res.data.newBalance);
        setPlaying(false);
        loadRecent();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to play');
      setPlaying(false);
    }
  };

  const pickRandom = () => {
    const opts = ['red', 'green', 'violet', 'big', 'small', '0','1','2','3','4','5','6','7','8','9'];
    setSelection(opts[Math.floor(Math.random() * opts.length)]);
    const mOpts = MULTIPLIERS.filter(m => m <= 20);
    setMultiplier(mOpts[Math.floor(Math.random() * mOpts.length)]);
  };

  const closeResult = () => { setResult(null); setSelection(null); };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="main-content wingo-page" style={{ maxWidth: 620 }}>
      {/* Header */}
      <div className="wingo-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <div className="wingo-logo">CricketX</div>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {/* Deposit / Withdraw row */}
      <div className="wingo-wallet-row">
        <button className="wingo-wd-btn withdraw" onClick={() => navigate('/wallet')}>Withdraw</button>
        <button className="wingo-wd-btn deposit" onClick={() => navigate('/wallet')}>Deposit</button>
      </div>

      {/* Marquee banner */}
      <div className="wingo-marquee">
        <span className="wingo-marquee-icon">📢</span>
        <span className="wingo-marquee-text">🎉 🎁 🎉 Welcome to CricketX — pick your lucky number and win up to 9× instantly!</span>
        <button className="wingo-marquee-detail">Detail</button>
      </div>

      {/* Mode tabs */}
      <div className="wingo-modes">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`wingo-mode ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <div className="wingo-mode-icon">⏱</div>
            <div className="wingo-mode-label">{m.label}</div>
            <div className="wingo-mode-sub">{m.sub}</div>
          </button>
        ))}
      </div>

      {/* Round info card */}
      <div className="wingo-round">
        <div className="wingo-round-left">
          <button className="wingo-howto"><HelpCircle size={14} /> How to play</button>
          <div className="wingo-round-title">WinGo {modeCfg.sub}</div>
          <div className="wingo-recent">
            {recent.slice(0, 5).map((r, i) => (
              <span key={i} className="wingo-recent-ball" style={ballStyle(r.number)}>
                <span>{r.number}</span>
              </span>
            ))}
            {recent.length === 0 && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>No history yet</span>}
          </div>
        </div>
        <div className="wingo-round-right">
          <div className="wingo-timer-label">Time remaining</div>
          <div className="wingo-timer">
            <span>{mm[0]}</span><span>{mm[1]}</span>
            <span className="wingo-timer-sep">:</span>
            <span>{ss[0]}</span><span>{ss[1]}</span>
          </div>
          <div className="wingo-round-id">{roundId}</div>
        </div>
      </div>

      {/* Result popup */}
      {result && (
        <div className={`wingo-result ${result.won ? 'won' : 'lost'}`}>
          <div className="wingo-result-ball" style={ballStyle(result.roll)}><span>{result.roll}</span></div>
          <div className="wingo-result-text">
            <div className="wingo-result-title">{result.won ? `You won ₹${result.payout}!` : 'You lost'}</div>
            <div className="wingo-result-sub">
              Rolled {result.roll} ({result.colors?.join(' + ')})
              {result.won && ` • ${result.multiplier}× payout`}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={closeResult}>OK</button>
        </div>
      )}

      {/* Color picker (3 pills) */}
      <div className="wingo-colors">
        <button
          className={`wingo-color-pill green ${selection === 'green' ? 'selected' : ''}`}
          onClick={() => setSelection('green')}
          disabled={playing}
        >Green</button>
        <button
          className={`wingo-color-pill violet ${selection === 'violet' ? 'selected' : ''}`}
          onClick={() => setSelection('violet')}
          disabled={playing}
        >Violet</button>
        <button
          className={`wingo-color-pill red ${selection === 'red' ? 'selected' : ''}`}
          onClick={() => setSelection('red')}
          disabled={playing}
        >Red</button>
      </div>

      {/* Number balls */}
      <div className="wingo-balls">
        {[0,1,2,3,4,5,6,7,8,9].map(n => (
          <button
            key={n}
            className={`wingo-ball ${selection === String(n) ? 'selected' : ''}`}
            style={ballStyle(n)}
            onClick={() => setSelection(String(n))}
            disabled={playing}
          >
            <span>{n}</span>
          </button>
        ))}
      </div>

      {/* Multiplier chips */}
      <div className="wingo-mults">
        <button className="wingo-mult random" onClick={pickRandom} disabled={playing}>
          <Shuffle size={12} /> Random
        </button>
        {MULTIPLIERS.map(m => (
          <button
            key={m}
            className={`wingo-mult ${multiplier === m ? 'selected' : ''}`}
            onClick={() => setMultiplier(m)}
            disabled={playing}
          >
            X{m}
          </button>
        ))}
      </div>

      {/* Big / Small */}
      <div className="wingo-bigsmall">
        <button
          className={`wingo-bigsmall-btn big ${selection === 'big' ? 'selected' : ''}`}
          onClick={() => setSelection('big')}
          disabled={playing}
        >Big</button>
        <button
          className={`wingo-bigsmall-btn small ${selection === 'small' ? 'selected' : ''}`}
          onClick={() => setSelection('small')}
          disabled={playing}
        >Small</button>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      {/* Play button */}
      <button
        className="btn btn-primary btn-lg wingo-play-btn"
        onClick={play}
        disabled={!selection || playing}
      >
        {playing ? 'Rolling...' : `Play ₹${stake}`}
      </button>

      {/* History tabs */}
      <div className="wingo-history-tabs">
        <button className="wingo-htab active">Game History</button>
        <button className="wingo-htab">Chart</button>
        <button className="wingo-htab">My History</button>
      </div>
      <div className="wingo-history-list">
        <div className="wingo-history-head">
          <span>Period</span><span>Number</span><span>Big/Small</span><span>Color</span>
        </div>
        {recent.slice(0, 10).map((r, i) => (
          <div key={i} className="wingo-history-row">
            <span className="wingo-hrow-period">#{i + 1}</span>
            <span className="wingo-hrow-num" style={ballStyle(r.number)}>{r.number}</span>
            <span className="wingo-hrow-bs">{r.number >= 5 ? 'Big' : 'Small'}</span>
            <span className="wingo-hrow-colors">
              {r.colors.map(c => (
                <span key={c} className={`wingo-dot ${c}`} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
