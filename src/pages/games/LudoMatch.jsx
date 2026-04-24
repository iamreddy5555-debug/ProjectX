import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Wallet, Dice5, Users, X, Bot } from 'lucide-react';
import api from '../../utils/api';
import { getSocket, onGameEvent } from '../../utils/gameSocket';

const STAKES = [20, 50, 100, 500, 1000];
const MIN_STAKE = 10;
const MAX_STAKE = 10000;

const COLOR_MAP = {
  red:    { hex: '#ef4444', soft: '#fee2e2' },
  blue:   { hex: '#3b82f6', soft: '#dbeafe' },
  green:  { hex: '#22c55e', soft: '#dcfce7' },
  yellow: { hex: '#eab308', soft: '#fef9c3' },
};

const TRACK = 40;

const dicePips = (v) => {
  const p = {
    1: [[0,0,0],[0,1,0],[0,0,0]],
    2: [[1,0,0],[0,0,0],[0,0,1]],
    3: [[1,0,0],[0,1,0],[0,0,1]],
    4: [[1,0,1],[0,0,0],[1,0,1]],
    5: [[1,0,1],[0,1,0],[1,0,1]],
    6: [[1,0,1],[1,0,1],[1,0,1]],
  };
  return p[v] || p[1];
};

export default function LudoMatch() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(20);
  const [status, setStatus] = useState('idle');     // idle | queued | in-match | finished
  const [queue, setQueue] = useState(null);
  const [match, setMatch] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastRollEvt, setLastRollEvt] = useState(null);
  const [captureEvt, setCaptureEvt] = useState(null);
  const [finishedEvt, setFinishedEvt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tickRef = useRef(null);

  // Load current state on mount
  useEffect(() => {
    refresh();

    // Subscribe to match events (once we're in a match, server pushes updates)
    const offState = onGameEvent('ludomatch:state', (m) => {
      setMatch(m);
      if (m.phase === 'playing') setStatus('in-match');
      if (m.phase === 'finished') setStatus('finished');
    });
    const offRoll = onGameEvent('ludomatch:roll', (r) => {
      setLastRollEvt({ ...r, ts: Date.now() });
      setTimeout(() => setLastRollEvt(null), 2200);
    });
    const offCapture = onGameEvent('ludomatch:capture', (c) => {
      setCaptureEvt(c);
      setTimeout(() => setCaptureEvt(null), 2500);
    });
    const offFinished = onGameEvent('ludomatch:finished', (f) => {
      setFinishedEvt(f);
      api.get('/auth/me').then(r => updateBalance(r.data.balance)).catch(() => {});
    });

    return () => { offState(); offRoll(); offCapture(); offFinished(); };
  }, []);

  // Tell the socket to subscribe to our match room when we join one
  useEffect(() => {
    if (!match?.matchId) return;
    const s = getSocket();
    s.emit('ludomatch:subscribe', { matchId: match.matchId });
  }, [match?.matchId]);

  const refresh = async () => {
    try {
      const res = await api.get('/games/ludo-match/current');
      if (res.data.inMatch) { setMatch(res.data.match); setStatus(res.data.match.phase === 'finished' ? 'finished' : 'in-match'); }
      else if (res.data.inQueue) { setQueue(res.data.queue); setStatus('queued'); }
      else { setStatus('idle'); setQueue(null); setMatch(null); }
    } catch {}
  };

  // Poll queue while waiting (in case server restarted)
  useEffect(() => {
    if (status !== 'queued') return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [status]);

  // Queue countdown
  useEffect(() => {
    const target = queue?.startsAt ? new Date(queue.startsAt).getTime() : null;
    if (!target || status !== 'queued') { setSecondsLeft(0); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    tickRef.current = setInterval(tick, 500);
    return () => clearInterval(tickRef.current);
  }, [queue?.startsAt, status]);

  // Turn countdown
  useEffect(() => {
    const target = match?.turnEndsAt ? new Date(match.turnEndsAt).getTime() : null;
    if (!target || status !== 'in-match') { return; }
    const tick = () => {
      const s = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      // used inline via computation
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [match?.turnEndsAt, status]);

  const join = async () => {
    if ((user?.balance || 0) < stake) { setError('Insufficient balance'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/games/ludo-match/join', { stake });
      updateBalance(res.data.newBalance);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      const res = await api.post('/games/ludo-match/leave');
      if (res.data.newBalance) updateBalance(res.data.newBalance);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave');
    } finally {
      setBusy(false);
    }
  };

  const roll = async () => {
    if (!match?.matchId) return;
    setBusy(true);
    try {
      await api.post('/games/ludo-match/roll', { matchId: match.matchId });
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot roll');
    } finally {
      setBusy(false);
    }
  };

  // Derived state
  const myIndex = match?.players?.findIndex(p => String(p.userId) === String(user?.id));
  const me = myIndex >= 0 ? match?.players[myIndex] : null;
  const isMyTurn = match?.phase === 'playing' && myIndex === match?.currentTurn;
  const currentPlayer = match?.players?.[match?.currentTurn];

  const turnSecondsLeft = match?.turnEndsAt
    ? Math.max(0, Math.ceil((new Date(match.turnEndsAt).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className="main-content ludo-match-page" style={{ maxWidth: 720 }}>
      <div className="game-page-header">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/games')}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Ludo Match</h1>
        <div className="game-wallet">
          <Wallet size={14} /> {formatCurrency(user?.balance || 0)}
        </div>
      </div>

      {status === 'idle' && (
        <>
          <div className="ludo-match-hero">
            <h2>4-Player Live Ludo</h2>
            <p>Join a table, race 3 opponents, first pawn to finish wins <strong>3.5× your stake</strong>.</p>
            <ul>
              <li>Roll 6 to leave base</li>
              <li>Land on an opponent's pawn to capture them (back to start)</li>
              <li>First to square {TRACK} wins</li>
              <li>Waits up to 1 minute for real players; then AI bots auto-fill empty seats</li>
            </ul>
          </div>

          <div className="game-section">
            <div className="game-section-title">Entry Stake</div>
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
                  onChange={e => { const v = parseInt(e.target.value, 10); if (Number.isFinite(v)) setStake(v); }} />
              </div>
              <span className="custom-stake-hint">Pot ₹{stake * 4} · Winner gets ₹{Math.floor(stake * 4 * 0.875)}</span>
            </div>
          </div>

          {error && <div className="form-error-box">{error}</div>}

          <button className="btn btn-primary btn-lg game-play-btn" onClick={join} disabled={busy}>
            <Users size={18} /> Join Table (₹{stake})
          </button>
        </>
      )}

      {status === 'queued' && (
        <div className="ludo-match-queue">
          <div className="ludo-match-queue-icon"><Users size={32} /></div>
          <h3>Waiting for players...</h3>
          <div className="ludo-match-queue-stake">Stake: <strong>₹{queue?.stake}</strong></div>
          <div className="ludo-match-queue-count">
            {queue?.waiting} / {queue?.needed} seats filled
          </div>
          <div className="ludo-match-queue-bar">
            <div className="ludo-match-queue-fill" style={{ width: `${((queue?.waiting || 0) / (queue?.needed || 4)) * 100}%` }} />
          </div>
          <div className="ludo-match-queue-timer">
            Bots join in <strong>{secondsLeft}s</strong> if seats aren't filled
          </div>
          <button className="btn btn-danger btn-lg" onClick={leave} disabled={busy} style={{ marginTop: 20 }}>
            <X size={16} /> Leave Queue (refunds ₹{queue?.stake})
          </button>
        </div>
      )}

      {(status === 'in-match' || status === 'finished') && match && (
        <>
          {/* Players panel */}
          <div className="ludo-match-players">
            {match.players.map((p, i) => {
              const c = COLOR_MAP[p.color];
              const isTurn = i === match.currentTurn && match.phase === 'playing';
              const winner = match.winner === p.color;
              return (
                <div key={i} className={`ludo-match-player ${isTurn ? 'turn' : ''} ${winner ? 'winner' : ''}`}
                  style={{ '--c': c.hex, '--soft': c.soft }}>
                  <div className="ludo-match-player-dot" />
                  <div className="ludo-match-player-info">
                    <div className="ludo-match-player-name">
                      {p.isBot && <Bot size={12} />} {p.name}
                    </div>
                    <div className="ludo-match-player-pos">Pos {p.position}/{TRACK}</div>
                  </div>
                  {winner && <span className="ludo-match-win-badge">WIN</span>}
                </div>
              );
            })}
          </div>

          {/* Current turn banner */}
          {match.phase === 'playing' && (
            <div className={`ludo-match-turnbar ${isMyTurn ? 'mine' : ''}`}>
              {isMyTurn ? (
                <>Your turn! <span>({turnSecondsLeft}s)</span></>
              ) : (
                <><span className="ludo-match-turn-color" style={{ background: COLOR_MAP[currentPlayer?.color]?.hex }} />
                  <strong>{currentPlayer?.name}</strong>'s turn ({turnSecondsLeft}s)</>
              )}
            </div>
          )}

          {/* The board — linear track with 4 bases at corners */}
          <div className="ludo-match-board">
            {/* Bases */}
            {match.players.map((p, i) => {
              const c = COLOR_MAP[p.color];
              const atBase = p.position === 0;
              const baseClass = `ludo-match-base ${['tl','tr','br','bl'][i]}`;
              return (
                <div key={i} className={baseClass} style={{ '--c': c.hex, '--soft': c.soft }}>
                  <div className="ludo-match-base-label">{p.color.toUpperCase()}</div>
                  {atBase && <div className="ludo-match-base-pawn" style={{ background: c.hex }} />}
                </div>
              );
            })}

            {/* Track (40 squares along a rectangle perimeter) */}
            <div className="ludo-match-track">
              {Array.from({ length: TRACK }, (_, i) => {
                const square = i + 1;
                const pawnsHere = match.players.filter(p => p.position === square);
                return (
                  <div key={i} className="ludo-match-cell">
                    <span className="ludo-match-cell-num">{square}</span>
                    {pawnsHere.map((p, pi) => (
                      <div key={pi} className="ludo-match-pawn"
                        style={{ background: COLOR_MAP[p.color].hex, left: `${pi * 6}px` }}
                        title={p.name} />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Dice center */}
            <div className="ludo-match-center">
              <div className={`ludo-dice ${lastRollEvt ? 'rolling' : ''}`}>
                {match.lastRoll > 0 ? (
                  <div className="dice-face">
                    {dicePips(match.lastRoll).map((row, ri) => row.map((on, ci) => (
                      <span key={`${ri}-${ci}`} className={`dice-pip ${on ? 'on' : ''}`} style={{ background: on ? '#1f2937' : 'transparent' }} />
                    )))}
                  </div>
                ) : (
                  <div className="dice-face idle"><Dice5 size={40} /></div>
                )}
              </div>
              {lastRollEvt && (
                <div className="ludo-match-roll-flash" style={{ color: COLOR_MAP[lastRollEvt.color]?.hex }}>
                  {lastRollEvt.color} rolled {lastRollEvt.roll}!
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          {match.phase === 'playing' && isMyTurn && (
            <button className="btn btn-primary btn-lg game-play-btn" onClick={roll} disabled={busy}>
              <Dice5 size={18} /> Roll the Dice
            </button>
          )}
          {match.phase === 'playing' && !isMyTurn && (
            <div className="aviator-live-payout">Waiting for {currentPlayer?.name} to roll...</div>
          )}
          {match.phase === 'finished' && (
            <div className={`ludo-result ${match.winner && me && match.winner === me.color ? 'won' : 'lost'}`}>
              <div className="ludo-result-winner">
                Winner: <strong style={{ color: COLOR_MAP[match.winner]?.hex }}>{match.winner?.toUpperCase()}</strong>
              </div>
              <div className="ludo-result-payout">
                {me && match.winner === me.color
                  ? `You won ₹${finishedEvt?.payout || Math.floor(match.pot * 0.875)}! 🎉`
                  : `You lost ₹${me?.stake || 0}`}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setStatus('idle'); setMatch(null); setFinishedEvt(null); refresh(); }}>
                Play Again
              </button>
            </div>
          )}

          {/* Capture banner */}
          {captureEvt && (
            <div className="ludo-match-capture-banner">
              <span style={{ color: COLOR_MAP[captureEvt.by]?.hex }}>{captureEvt.by}</span> captured <span style={{ color: COLOR_MAP[captureEvt.victim]?.hex }}>{captureEvt.victim}</span>!
            </div>
          )}

          {error && <div className="form-error-box" style={{ marginTop: 12 }}>{error}</div>}
        </>
      )}
    </div>
  );
}
