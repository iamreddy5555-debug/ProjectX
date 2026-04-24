import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Shuffle, HelpCircle } from 'lucide-react';
import api from '../../utils/api';
import { onGameEvent } from '../../utils/gameSocket';

const MULTIPLIERS = [1, 5, 10, 20, 50, 100];
const BASE_STAKE = 10;

const colorsOfNumber = (n) => {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if ([2, 4, 6, 8].includes(n)) return ['red'];
  return ['green'];
};

const ballStyle = (n) => {
  const cs = colorsOfNumber(n);
  if (cs.length === 2) {
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

  const [multiplier, setMultiplier] = useState(1);
  const [selection, setSelection] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [round, setRound] = useState(null);        // { roundId, phase, bettingEndsAt, revealAt, result, lastResults }
  const [myBets, setMyBets] = useState([]);        // pending bets on this round
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef(null);

  const stake = BASE_STAKE * multiplier;

  // Initial state + subscribe to round events
  useEffect(() => {
    api.get('/games/color/current').then(r => setRound(r.data)).catch(() => {});
    const off = onGameEvent('color:round', (r) => {
      setRound(r);
      if (r.phase === 'betting') {
        // new round — clear old bets + last result
        setMyBets([]);
        setLastResult(null);
      }
    });
    const offResult = onGameEvent('color:result', (r) => setLastResult(r));
    return () => { off(); offResult(); };
  }, []);

  // Load my bets whenever the round changes
  useEffect(() => {
    if (!round?.roundId || !user) return;
    api.get('/games/color/my-bets').then(r => setMyBets(r.data || [])).catch(() => {});
    // Refresh balance after settle (when result arrives)
    if (round.phase === 'revealing') {
      api.get('/auth/me').then(r => updateBalance(r.data.balance)).catch(() => {});
    }
  }, [round?.roundId, round?.phase, user]);

  // Countdown tick
  useEffect(() => {
    const target = round?.bettingEndsAt ? new Date(round.bettingEndsAt).getTime() : null;
    if (!target) { setSecondsLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    tickRef.current = setInterval(tick, 250);
    return () => clearInterval(tickRef.current);
  }, [round?.bettingEndsAt]);

  const isBetting = round?.phase === 'betting' && secondsLeft > 0;

  const placeBet = async () => {
    if (!selection) { setError('Pick a color, number, or big/small'); return; }
    if (!isBetting) { setError('Betting is closed — wait for next round'); return; }
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setPlacing(true);
    try {
      const res = await api.post('/games/color', { selection, stake });
      updateBalance(res.data.newBalance);
      // Refresh my bets
      const mb = await api.get('/games/color/my-bets');
      setMyBets(mb.data || []);
      setSelection(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const pickRandom = () => {
    const opts = ['red', 'green', 'violet', 'big', 'small', '0','1','2','3','4','5','6','7','8','9'];
    setSelection(opts[Math.floor(Math.random() * opts.length)]);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const lastResults = round?.lastResults || [];
  const revealing = round?.phase === 'revealing';

  return (
    <div className="main-content wingo-page" style={{ maxWidth: 620 }}>
      <div className="wingo-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <div className="wingo-logo">CricketX</div>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      <div className="wingo-wallet-row">
        <button className="wingo-wd-btn withdraw" onClick={() => navigate('/wallet')}>Withdraw</button>
        <button className="wingo-wd-btn deposit" onClick={() => navigate('/wallet')}>Deposit</button>
      </div>

      <div className="wingo-marquee">
        <span className="wingo-marquee-icon">📢</span>
        <span className="wingo-marquee-text">🎉 Live shared WinGo rounds — everyone plays the same round!</span>
        <button className="wingo-marquee-detail">Detail</button>
      </div>

      {/* Round info card */}
      <div className="wingo-round">
        <div className="wingo-round-left">
          <button className="wingo-howto"><HelpCircle size={14} /> How to play</button>
          <div className="wingo-round-title">WinGo 30sec</div>
          <div className="wingo-recent">
            {lastResults.slice(0, 5).map((r, i) => (
              <span key={i} className="wingo-recent-ball" style={ballStyle(r.number)}>
                <span>{r.number}</span>
              </span>
            ))}
            {lastResults.length === 0 && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>No history yet</span>}
          </div>
        </div>
        <div className="wingo-round-right">
          <div className="wingo-timer-label">{revealing ? 'Revealing' : 'Time remaining'}</div>
          <div className="wingo-timer">
            <span>{mm[0]}</span><span>{mm[1]}</span>
            <span className="wingo-timer-sep">:</span>
            <span>{ss[0]}</span><span>{ss[1]}</span>
          </div>
          <div className="wingo-round-id">{round?.roundId || '—'}</div>
        </div>
      </div>

      {/* Reveal popup */}
      {revealing && round?.result && (
        <div className="wingo-result won">
          <div className="wingo-result-ball" style={ballStyle(round.result.number)}><span>{round.result.number}</span></div>
          <div className="wingo-result-text">
            <div className="wingo-result-title">Round result: {round.result.number}</div>
            <div className="wingo-result-sub">Colors: {round.result.colors?.join(' + ')}</div>
          </div>
        </div>
      )}

      {/* My bets on this round */}
      {myBets.length > 0 && (
        <div className="wingo-mybets">
          <strong>Your bets this round:</strong>
          {myBets.map(b => (
            <span key={b._id} className="wingo-mybet-chip">
              {b.selection} · ₹{b.stake}
            </span>
          ))}
        </div>
      )}

      {/* Color picker */}
      <div className="wingo-colors">
        <button className={`wingo-color-pill green ${selection === 'green' ? 'selected' : ''}`}
          onClick={() => setSelection('green')} disabled={!isBetting || placing}>Green</button>
        <button className={`wingo-color-pill violet ${selection === 'violet' ? 'selected' : ''}`}
          onClick={() => setSelection('violet')} disabled={!isBetting || placing}>Violet</button>
        <button className={`wingo-color-pill red ${selection === 'red' ? 'selected' : ''}`}
          onClick={() => setSelection('red')} disabled={!isBetting || placing}>Red</button>
      </div>

      {/* Number balls */}
      <div className="wingo-balls">
        {[0,1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} className={`wingo-ball ${selection === String(n) ? 'selected' : ''}`}
            style={ballStyle(n)} onClick={() => setSelection(String(n))} disabled={!isBetting || placing}>
            <span>{n}</span>
          </button>
        ))}
      </div>

      {/* Multiplier chips */}
      <div className="wingo-mults">
        <button className="wingo-mult random" onClick={pickRandom} disabled={!isBetting || placing}>
          <Shuffle size={12} /> Random
        </button>
        {MULTIPLIERS.map(m => (
          <button key={m} className={`wingo-mult ${multiplier === m ? 'selected' : ''}`}
            onClick={() => setMultiplier(m)} disabled={!isBetting || placing}>X{m}</button>
        ))}
      </div>

      {/* Big / Small */}
      <div className="wingo-bigsmall">
        <button className={`wingo-bigsmall-btn big ${selection === 'big' ? 'selected' : ''}`}
          onClick={() => setSelection('big')} disabled={!isBetting || placing}>Big</button>
        <button className={`wingo-bigsmall-btn small ${selection === 'small' ? 'selected' : ''}`}
          onClick={() => setSelection('small')} disabled={!isBetting || placing}>Small</button>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      <button className="btn btn-primary btn-lg wingo-play-btn" onClick={placeBet}
        disabled={!selection || !isBetting || placing}>
        {placing ? 'Placing...' : isBetting ? `Place Bet ₹${stake}` : 'Betting closed — next round soon'}
      </button>
    </div>
  );
}
