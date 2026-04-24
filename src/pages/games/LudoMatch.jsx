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

          {/* Classic Ludo board: 15×15 grid with colored quadrants,
              cross-shaped path, center triangle, safe stars, arrows */}
          <LudoBoard match={match} lastRollEvt={lastRollEvt} dicePips={dicePips} />

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

// -----------------------------------------------------------------
// Classic Ludo board — 15×15 grid with 6×6 corner quadrants, 3-wide
// cross arms, center triangle, safe stars. 40 track cells mapped around
// the cross perimeter clockwise from the top arm.
// -----------------------------------------------------------------
const BOARD_COLORS = {
  red:    { hex: '#ef4444', soft: '#fee2e2' },
  blue:   { hex: '#3b82f6', soft: '#dbeafe' },
  green:  { hex: '#22c55e', soft: '#dcfce7' },
  yellow: { hex: '#eab308', soft: '#fef9c3' },
};

// 40 track positions → grid (col, row) on a 15×15 grid, clockwise starting
// at the top of the YELLOW home column (col 8, row 1).
const TRACK_PATH = (() => {
  const P = [];
  // Top arm — go down along col 9 (right side of top arm), rows 1-5
  for (let r = 1; r <= 5; r++) P.push({ col: 9, row: r });
  // Turn right across row 6, cols 10-15
  for (let c = 10; c <= 15; c++) P.push({ col: c, row: 6 });
  // Down along col 15, rows 7-9 (but cross center blocked, use col 15 all the way)
  // Wait, the track wraps around. Simpler: go down along col 15 rows 7-10
  for (let r = 7; r <= 9; r++) P.push({ col: 15, row: r });
  // Left along row 10, cols 14-10
  for (let c = 14; c >= 10; c--) P.push({ col: c, row: 10 });
  // Down along col 9, rows 11-15
  for (let r = 11; r <= 15; r++) P.push({ col: 9, row: r });
  // Left along row 15, cols 8-7
  for (let c = 8; c >= 7; c--) P.push({ col: c, row: 15 });
  // Up along col 7, rows 14-11
  for (let r = 14; r >= 11; r--) P.push({ col: 7, row: r });
  // Left along row 10, cols 6-1
  for (let c = 6; c >= 1; c--) P.push({ col: c, row: 10 });
  // Up along col 1, rows 9-7
  for (let r = 9; r >= 7; r--) P.push({ col: 1, row: r });
  // Right along row 6, cols 2-6
  for (let c = 2; c <= 6; c++) P.push({ col: c, row: 6 });
  // Up along col 7, rows 5-1
  for (let r = 5; r >= 1; r--) P.push({ col: 7, row: r });
  // Right along row 1 back to start area: col 8
  P.push({ col: 8, row: 1 });
  return P.slice(0, 40);
})();

// Star (safe) squares — indices in TRACK_PATH that show a star icon
const SAFE_STARS = [1, 9, 16, 21, 29, 36];

const DICE_PIP_LAYOUT = {
  1: [[0,0,0],[0,1,0],[0,0,0]],
  2: [[1,0,0],[0,0,0],[0,0,1]],
  3: [[1,0,0],[0,1,0],[0,0,1]],
  4: [[1,0,1],[0,0,0],[1,0,1]],
  5: [[1,0,1],[0,1,0],[1,0,1]],
  6: [[1,0,1],[1,0,1],[1,0,1]],
};

function LudoBoard({ match, lastRollEvt }) {
  // Map each color to its quadrant position
  const quadrantOf = (color) => ({
    green: 'tl', yellow: 'tr', red: 'bl', blue: 'br',
  }[color]);

  const pawnsAt = (pathIdx) =>
    match.players.filter(p => p.position === pathIdx + 1);

  return (
    <div className="ludo-board-classic">
      <div className="ludo-grid">
        {/* The 4 colored quadrants with big dice */}
        {match.players.map((p) => {
          const c = BOARD_COLORS[p.color];
          const q = quadrantOf(p.color);
          const atBase = p.position === 0;
          const rollForThisPlayer = match.currentTurn >= 0 && match.players[match.currentTurn]?.color === p.color
            ? match.lastRoll
            : 0;
          return (
            <div key={p.color} className={`ludo-quad q-${q}`} style={{ '--c': c.hex, '--soft': c.soft }}>
              <div className="ludo-quad-inner">
                <div className="ludo-quad-dice">
                  <div className="dice-face-big">
                    {(DICE_PIP_LAYOUT[rollForThisPlayer || 4]).map((row, ri) =>
                      row.map((on, ci) => (
                        <span key={`${ri}-${ci}`} className="pip-big" style={{ background: on ? c.hex : 'transparent' }} />
                      ))
                    )}
                  </div>
                </div>
                {atBase && (
                  <div className="ludo-quad-pawn" style={{ background: c.hex }} title={p.name} />
                )}
              </div>
            </div>
          );
        })}

        {/* Cross arm cells (home paths colored; outer lanes white) */}
        {/* Top arm — rows 1-6, cols 7-9 */}
        {Array.from({ length: 6 }).map((_, r) =>
          [7, 8, 9].map((col) => {
            const row = r + 1;
            const isHome = col === 8; // yellow home path
            return (
              <div key={`top-${col}-${row}`} className="ludo-cell" style={{
                gridColumn: col, gridRow: row,
                background: isHome ? BOARD_COLORS.yellow.hex : '#fff',
              }} />
            );
          })
        )}
        {/* Bottom arm — rows 10-15, cols 7-9 */}
        {Array.from({ length: 6 }).map((_, r) =>
          [7, 8, 9].map((col) => {
            const row = r + 10;
            const isHome = col === 8; // red home path
            return (
              <div key={`bot-${col}-${row}`} className="ludo-cell" style={{
                gridColumn: col, gridRow: row,
                background: isHome ? BOARD_COLORS.red.hex : '#fff',
              }} />
            );
          })
        )}
        {/* Left arm — cols 1-6, rows 7-9 */}
        {[7, 8, 9].map((row) =>
          Array.from({ length: 6 }).map((_, c) => {
            const col = c + 1;
            const isHome = row === 8; // green home path
            return (
              <div key={`lef-${col}-${row}`} className="ludo-cell" style={{
                gridColumn: col, gridRow: row,
                background: isHome ? BOARD_COLORS.green.hex : '#fff',
              }} />
            );
          })
        )}
        {/* Right arm — cols 10-15, rows 7-9 */}
        {[7, 8, 9].map((row) =>
          Array.from({ length: 6 }).map((_, c) => {
            const col = c + 10;
            const isHome = row === 8; // blue home path
            return (
              <div key={`rig-${col}-${row}`} className="ludo-cell" style={{
                gridColumn: col, gridRow: row,
                background: isHome ? BOARD_COLORS.blue.hex : '#fff',
              }} />
            );
          })
        )}

        {/* Track cell markers (safe stars + pawns) */}
        {TRACK_PATH.map((pos, idx) => {
          const pawns = pawnsAt(idx);
          const isSafe = SAFE_STARS.includes(idx);
          if (!isSafe && pawns.length === 0) return null;
          return (
            <div
              key={`trk-${idx}`}
              className="ludo-track-marker"
              style={{ gridColumn: pos.col, gridRow: pos.row }}
            >
              {isSafe && pawns.length === 0 && <span className="ludo-star">★</span>}
              {pawns.map((p, pi) => (
                <span
                  key={pi}
                  className="ludo-pawn-marker"
                  style={{
                    background: BOARD_COLORS[p.color].hex,
                    left: `${pi * 4}px`,
                    top: `${pi * 4}px`,
                  }}
                  title={p.name}
                />
              ))}
            </div>
          );
        })}

        {/* Center triangles (4 colored triangles meeting at center) */}
        <div className="ludo-center-box">
          <div className="ludo-tri tri-top"    style={{ background: BOARD_COLORS.yellow.hex }} />
          <div className="ludo-tri tri-right"  style={{ background: BOARD_COLORS.blue.hex }} />
          <div className="ludo-tri tri-bottom" style={{ background: BOARD_COLORS.red.hex }} />
          <div className="ludo-tri tri-left"   style={{ background: BOARD_COLORS.green.hex }} />
        </div>

        {/* Directional arrows pointing toward center entry for each color */}
        <div className="ludo-arrow arrow-top"    style={{ color: BOARD_COLORS.yellow.hex }}>▼</div>
        <div className="ludo-arrow arrow-right"  style={{ color: BOARD_COLORS.blue.hex }}>◀</div>
        <div className="ludo-arrow arrow-bottom" style={{ color: BOARD_COLORS.red.hex }}>▲</div>
        <div className="ludo-arrow arrow-left"   style={{ color: BOARD_COLORS.green.hex }}>▶</div>
      </div>

      {lastRollEvt && (
        <div className="ludo-match-roll-flash" style={{ color: BOARD_COLORS[lastRollEvt.color]?.hex }}>
          {lastRollEvt.color} rolled {lastRollEvt.roll}!
        </div>
      )}
    </div>
  );
}
