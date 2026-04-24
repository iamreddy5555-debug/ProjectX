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

// Must match server: 52-square outer track, color start indexes.
const COLOR_START = { green: 0, yellow: 13, blue: 26, red: 39 };
const OUTER_LAST = 51;
const HOME_START = 52;
const FINISH = 57;
const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// 52 outer-track cells mapped clockwise onto a 15×15 grid.
// Start at (2,7) = green's entry, clockwise.
const OUTER_CELLS = (() => {
  const P = [];
  // 0: green entry + 4 more in left arm row 7
  for (let c = 2; c <= 6; c++) P.push({ col: c, row: 7 });       // 0..4
  P.push({ col: 7, row: 6 });                                    // 5
  for (let r = 5; r >= 1; r--) P.push({ col: 7, row: r });       // 6..10
  P.push({ col: 8, row: 1 });                                    // 11
  P.push({ col: 9, row: 1 });                                    // 12
  for (let r = 2; r <= 5; r++) P.push({ col: 9, row: r });       // 13..16 (yellow entry 13)
  P.push({ col: 9, row: 6 });                                    // 17
  P.push({ col: 10, row: 7 });                                   // 18
  for (let c = 11; c <= 15; c++) P.push({ col: c, row: 7 });     // 19..23
  P.push({ col: 15, row: 8 });                                   // 24
  P.push({ col: 15, row: 9 });                                   // 25
  for (let c = 14; c >= 10; c--) P.push({ col: c, row: 9 });     // 26..30 (blue entry 26)
  P.push({ col: 9, row: 10 });                                   // 31
  for (let r = 11; r <= 15; r++) P.push({ col: 9, row: r });     // 32..36
  P.push({ col: 8, row: 15 });                                   // 37
  P.push({ col: 7, row: 15 });                                   // 38
  for (let r = 14; r >= 10; r--) P.push({ col: 7, row: r });     // 39..43 (red entry 39)
  P.push({ col: 6, row: 9 });                                    // 44
  for (let c = 5; c >= 1; c--) P.push({ col: c, row: 9 });       // 45..49
  P.push({ col: 1, row: 8 });                                    // 50
  P.push({ col: 1, row: 7 });                                    // 51
  return P;
})();

// Home column cells per color (5 cells leading to center)
const HOME_CELLS = {
  green:  [{ col: 2, row: 8 }, { col: 3, row: 8 }, { col: 4, row: 8 }, { col: 5, row: 8 }, { col: 6, row: 8 }],
  yellow: [{ col: 8, row: 2 }, { col: 8, row: 3 }, { col: 8, row: 4 }, { col: 8, row: 5 }, { col: 8, row: 6 }],
  blue:   [{ col: 14, row: 8 }, { col: 13, row: 8 }, { col: 12, row: 8 }, { col: 11, row: 8 }, { col: 10, row: 8 }],
  red:    [{ col: 8, row: 14 }, { col: 8, row: 13 }, { col: 8, row: 12 }, { col: 8, row: 11 }, { col: 8, row: 10 }],
};

const FINISH_CELL = { col: 8, row: 8 };

// Base slot positions inside each quadrant (4 slots per base)
const BASE_SLOTS = {
  green:  [{ c: 2, r: 2 }, { c: 5, r: 2 }, { c: 2, r: 5 }, { c: 5, r: 5 }],
  yellow: [{ c: 11, r: 2 }, { c: 14, r: 2 }, { c: 11, r: 5 }, { c: 14, r: 5 }],
  red:    [{ c: 2, r: 11 }, { c: 5, r: 11 }, { c: 2, r: 14 }, { c: 5, r: 14 }],
  blue:   [{ c: 11, r: 11 }, { c: 14, r: 11 }, { c: 11, r: 14 }, { c: 14, r: 14 }],
};

// Where to render a pawn (grid col, row) given its color and progress
const cellFor = (color, progress, pawnIdx) => {
  if (progress === 0) {
    const slot = BASE_SLOTS[color][pawnIdx];
    return { col: slot.c, row: slot.r };
  }
  if (progress >= 1 && progress <= OUTER_LAST) {
    const outerIdx = (COLOR_START[color] + progress - 1) % 52;
    return OUTER_CELLS[outerIdx];
  }
  if (progress >= HOME_START && progress <= HOME_START + 4) {
    const homeIdx = progress - HOME_START;
    return HOME_CELLS[color][homeIdx];
  }
  if (progress === FINISH) return FINISH_CELL;
  return { col: 8, row: 8 };
};

const DICE_PIP_LAYOUT = {
  1: [[0,0,0],[0,1,0],[0,0,0]],
  2: [[1,0,0],[0,0,0],[0,0,1]],
  3: [[1,0,0],[0,1,0],[0,0,1]],
  4: [[1,0,1],[0,0,0],[1,0,1]],
  5: [[1,0,1],[0,1,0],[1,0,1]],
  6: [[1,0,1],[1,0,1],[1,0,1]],
};

export default function LudoMatch() {
  const { user, updateBalance } = useAuth();
  const navigate = useNavigate();

  const [stake, setStake] = useState(20);
  const [status, setStatus] = useState('idle');
  const [queue, setQueue] = useState(null);
  const [match, setMatch] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastRollEvt, setLastRollEvt] = useState(null);
  const [captureEvt, setCaptureEvt] = useState(null);
  const [finishedEvt, setFinishedEvt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tickRef = useRef(null);

  useEffect(() => {
    refresh();
    const offState = onGameEvent('ludomatch:state', (m) => {
      setMatch(m);
      if (m.phase === 'playing') setStatus('in-match');
      if (m.phase === 'finished') setStatus('finished');
    });
    const offRoll = onGameEvent('ludomatch:roll', (r) => {
      setLastRollEvt({ ...r, ts: Date.now() });
      setTimeout(() => setLastRollEvt(null), 2000);
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

  useEffect(() => {
    if (status !== 'queued') return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    const target = queue?.startsAt ? new Date(queue.startsAt).getTime() : null;
    if (!target || status !== 'queued') { setSecondsLeft(0); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    tickRef.current = setInterval(tick, 500);
    return () => clearInterval(tickRef.current);
  }, [queue?.startsAt, status]);

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

  const pickPawn = async (pawnId) => {
    if (!match?.matchId) return;
    setBusy(true);
    try {
      await api.post('/games/ludo-match/pick', { matchId: match.matchId, pawnId });
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot pick');
    } finally {
      setBusy(false);
    }
  };

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
            <p>Real Ludo rules — 4 pawns each, roll 6 to exit base, capture opponents, first to get all 4 pawns home wins <strong>3.5× your stake</strong>.</p>
            <ul>
              <li>Roll <strong>6</strong> to take a pawn out of base</li>
              <li>Rolling 6 grants an extra turn (three 6s = forfeit)</li>
              <li>Land on an opponent's pawn (non-safe) to capture → back to base</li>
              <li>8 safe squares (★) where pawns can't be captured</li>
              <li>After a full lap, enter your color's home column</li>
              <li>Exact roll required to finish</li>
              <li>Waits up to 1 minute for real players, then AI bots fill empty seats</li>
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
          <div className="ludo-match-queue-count">{queue?.waiting} / {queue?.needed} seats filled</div>
          <div className="ludo-match-queue-bar">
            <div className="ludo-match-queue-fill" style={{ width: `${((queue?.waiting || 0) / (queue?.needed || 4)) * 100}%` }} />
          </div>
          <div className="ludo-match-queue-timer">Bots join in <strong>{secondsLeft}s</strong> if seats aren't filled</div>
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
              const homeCount = p.pawns.filter(pn => pn.progress === FINISH).length;
              return (
                <div key={i} className={`ludo-match-player ${isTurn ? 'turn' : ''} ${p.rank === 1 ? 'winner' : ''}`}
                  style={{ '--c': c.hex, '--soft': c.soft }}>
                  <div className="ludo-match-player-dot" />
                  <div className="ludo-match-player-info">
                    <div className="ludo-match-player-name">
                      {p.isBot && <Bot size={12} />} {p.name}
                    </div>
                    <div className="ludo-match-player-pos">{homeCount}/4 home</div>
                  </div>
                  {p.rank && <span className="ludo-match-win-badge">#{p.rank}</span>}
                </div>
              );
            })}
          </div>

          {/* Turn banner */}
          {match.phase === 'playing' && (
            <div className={`ludo-match-turnbar ${isMyTurn ? 'mine' : ''}`}>
              {isMyTurn ? (
                <>Your turn! <span>({turnSecondsLeft}s)</span> — {match.awaitingMove ? 'Pick a pawn to move' : 'Roll the dice'}</>
              ) : (
                <><span className="ludo-match-turn-color" style={{ background: COLOR_MAP[currentPlayer?.color]?.hex }} />
                  <strong>{currentPlayer?.name}</strong>'s turn ({turnSecondsLeft}s)</>
              )}
            </div>
          )}

          {/* The proper Ludo board */}
          <LudoBoard match={match} me={me} isMyTurn={isMyTurn} onPickPawn={pickPawn} />

          {/* Action bar */}
          {match.phase === 'playing' && isMyTurn && !match.awaitingMove && (
            <button className="btn btn-primary btn-lg game-play-btn" onClick={roll} disabled={busy}>
              <Dice5 size={18} /> Roll the Dice
            </button>
          )}
          {match.phase === 'playing' && isMyTurn && match.awaitingMove && (
            <div className="aviator-live-payout" style={{ color: COLOR_MAP[me?.color]?.hex, borderColor: COLOR_MAP[me?.color]?.hex }}>
              You rolled <strong>{match.awaitingMove.roll}</strong> — click a highlighted pawn to move
            </div>
          )}
          {match.phase === 'playing' && !isMyTurn && (
            <div className="aviator-live-payout">Waiting for {currentPlayer?.name}...</div>
          )}
          {match.phase === 'finished' && (
            <div className={`ludo-result ${match.winner && me && match.winner === me.color ? 'won' : 'lost'}`}>
              <div className="ludo-result-winner">
                Winner: <strong style={{ color: COLOR_MAP[match.winner]?.hex }}>{match.winner?.toUpperCase()}</strong>
              </div>
              <div className="ludo-result-payout">
                {me && match.winner === me.color
                  ? `You won ₹${finishedEvt?.payout || Math.floor(match.pot * 0.875)}! 🎉`
                  : `You lost ₹${me?.stake || stake}`}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setStatus('idle'); setMatch(null); setFinishedEvt(null); refresh(); }}>
                Play Again
              </button>
            </div>
          )}

          {/* Last roll + capture banners */}
          {lastRollEvt && (
            <div className="ludo-match-roll-flash" style={{ color: COLOR_MAP[lastRollEvt.color]?.hex }}>
              {lastRollEvt.color} rolled {lastRollEvt.roll}!
            </div>
          )}
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

// -----------------------------------------------------------------------------
// Ludo Board — 15×15 grid, 6×6 corner quadrants with 4-slot bases, cross arms
// with colored home columns, 8 safe stars, center triangle + finish.
// All pawns (4 per color) positioned via cellFor(color, progress, pawnIdx).
// -----------------------------------------------------------------------------
function LudoBoard({ match, me, isMyTurn, onPickPawn }) {
  const movableIds = match.awaitingMove?.options || [];

  const renderCell = (col, row, key, style = {}, children = null) => (
    <div key={key} className="ludo-cell" style={{ gridColumn: col, gridRow: row, ...style }}>
      {children}
    </div>
  );

  const cells = [];

  // 4 Quadrants (6x6)
  const quadrantSpec = [
    { color: 'green',  gc: '1 / span 6', gr: '1 / span 6' },
    { color: 'yellow', gc: '10 / span 6', gr: '1 / span 6' },
    { color: 'red',    gc: '1 / span 6', gr: '10 / span 6' },
    { color: 'blue',   gc: '10 / span 6', gr: '10 / span 6' },
  ];
  for (const q of quadrantSpec) {
    const c = COLOR_MAP[q.color];
    cells.push(
      <div key={`quad-${q.color}`} className="ludo-quad-v2"
        style={{ gridColumn: q.gc, gridRow: q.gr, background: c.hex }} />
    );
  }

  // Top arm cells (cols 7-9, rows 1-6) — yellow home path is col 8
  for (let r = 1; r <= 6; r++) {
    for (let c = 7; c <= 9; c++) {
      const bg = c === 8 ? COLOR_MAP.yellow.hex : '#fff';
      cells.push(renderCell(c, r, `top-${c}-${r}`, { background: bg }));
    }
  }
  // Bottom arm
  for (let r = 10; r <= 15; r++) {
    for (let c = 7; c <= 9; c++) {
      const bg = c === 8 ? COLOR_MAP.red.hex : '#fff';
      cells.push(renderCell(c, r, `bot-${c}-${r}`, { background: bg }));
    }
  }
  // Left arm
  for (let c = 1; c <= 6; c++) {
    for (let r = 7; r <= 9; r++) {
      const bg = r === 8 ? COLOR_MAP.green.hex : '#fff';
      cells.push(renderCell(c, r, `left-${c}-${r}`, { background: bg }));
    }
  }
  // Right arm
  for (let c = 10; c <= 15; c++) {
    for (let r = 7; r <= 9; r++) {
      const bg = r === 8 ? COLOR_MAP.blue.hex : '#fff';
      cells.push(renderCell(c, r, `right-${c}-${r}`, { background: bg }));
    }
  }

  // Entry squares — colored cell at each color's entry point
  const entryBgs = {
    [COLOR_START.green]:  COLOR_MAP.green.soft,
    [COLOR_START.yellow]: COLOR_MAP.yellow.soft,
    [COLOR_START.blue]:   COLOR_MAP.blue.soft,
    [COLOR_START.red]:    COLOR_MAP.red.soft,
  };
  Object.entries(entryBgs).forEach(([idx, bg]) => {
    const cell = OUTER_CELLS[Number(idx)];
    if (!cell) return;
    const color = Object.entries(COLOR_START).find(([, v]) => v === Number(idx))[0];
    cells.push(
      <div key={`entry-${idx}`} className="ludo-entry"
        style={{ gridColumn: cell.col, gridRow: cell.row, background: COLOR_MAP[color].soft }} />
    );
  });

  // Safe stars on 8 safe cells
  SAFE_SET.forEach(idx => {
    const cell = OUTER_CELLS[idx];
    if (!cell) return;
    cells.push(
      <div key={`star-${idx}`} className="ludo-star-cell"
        style={{ gridColumn: cell.col, gridRow: cell.row }}>★</div>
    );
  });

  // Center triangle
  cells.push(
    <div key="center" className="ludo-center-v2" style={{ gridColumn: '7 / span 3', gridRow: '7 / span 3' }}>
      <div className="tri-v2 tri-top-v2"    style={{ background: COLOR_MAP.yellow.hex }} />
      <div className="tri-v2 tri-right-v2"  style={{ background: COLOR_MAP.blue.hex }} />
      <div className="tri-v2 tri-bottom-v2" style={{ background: COLOR_MAP.red.hex }} />
      <div className="tri-v2 tri-left-v2"   style={{ background: COLOR_MAP.green.hex }} />
    </div>
  );

  // All pawns (4 per player × 4 players = 16)
  const pawnEls = [];
  for (const p of match.players) {
    for (const pawn of p.pawns) {
      const pos = cellFor(p.color, pawn.progress, pawn.id);
      const isMyPawn = me && p.color === me.color;
      const canMove = isMyTurn && isMyPawn && movableIds.includes(pawn.id);
      const isFinished = pawn.progress === FINISH;
      pawnEls.push(
        <button
          key={`${p.color}-${pawn.id}`}
          className={`ludo-pawn-v2 ${canMove ? 'movable' : ''} ${isFinished ? 'finished' : ''}`}
          style={{
            gridColumn: pos.col,
            gridRow: pos.row,
            background: COLOR_MAP[p.color].hex,
          }}
          onClick={() => canMove && onPickPawn(pawn.id)}
          disabled={!canMove}
          title={`${p.name} · pawn ${pawn.id + 1}`}
        >
          <span className="ludo-pawn-num">{pawn.id + 1}</span>
        </button>
      );
    }
  }

  return (
    <div className="ludo-board-v3">
      <div className="ludo-grid-v2">
        {cells}
        {pawnEls}
      </div>

      {/* Dice display */}
      <div className="ludo-board-dice">
        <div className={`ludo-dice ${match.lastRoll && match.awaitingMove ? 'rolling' : ''}`}>
          {match.lastRoll > 0 ? (
            <div className="dice-face">
              {DICE_PIP_LAYOUT[match.lastRoll].map((row, ri) => row.map((on, ci) => (
                <span key={`${ri}-${ci}`} className={`dice-pip ${on ? 'on' : ''}`}
                  style={{ background: on ? '#1f2937' : 'transparent' }} />
              )))}
            </div>
          ) : (
            <div className="dice-face idle"><Dice5 size={36} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
