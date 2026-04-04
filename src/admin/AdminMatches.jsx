import { useState, useEffect } from 'react';
import { formatDateTime } from '../utils/formatters';
import { Plus, Trash2, X, RefreshCw, Trophy } from 'lucide-react';
import api from '../utils/api';

export default function AdminMatches() {
  const [matches, setMatches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
  const [editingScore, setEditingScore] = useState(null);
  const [scoreForm, setScoreForm] = useState({ scoreA: '', scoreB: '', result: '' });
  const [form, setForm] = useState({
    title: '', teamA: '', teamB: '', league: 'IPL 2026',
    startTime: '', status: 'upcoming',
    oddsTeamA: { back: 1.5, lay: 1.55 },
    oddsTeamB: { back: 2.5, lay: 2.55 },
  });

  useEffect(() => { loadMatches(); }, []);

  const loadMatches = async () => {
    try {
      const res = await api.get('/admin/matches');
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to load matches');
    }
  };

  const addMatch = async () => {
    if (!form.teamA || !form.teamB || !form.startTime) {
      showToast('Team names and start time are required');
      return;
    }
    try {
      await api.post('/admin/matches', {
        ...form,
        title: form.title || `${form.teamA} vs ${form.teamB}`,
      });
      setShowAdd(false);
      setForm({ title: '', teamA: '', teamB: '', league: 'IPL 2026', startTime: '', status: 'upcoming', oddsTeamA: { back: 1.5, lay: 1.55 }, oddsTeamB: { back: 2.5, lay: 2.55 } });
      showToast('Match added!');
      loadMatches();
    } catch (err) {
      showToast('Failed to add match');
    }
  };

  const updateMatch = async (id, data) => {
    try {
      await api.patch(`/admin/matches/${id}`, data);
      loadMatches();
      showToast('Match updated');
    } catch (err) {
      showToast('Failed to update');
    }
  };

  const saveScore = async (id) => {
    await updateMatch(id, scoreForm);
    setEditingScore(null);
  };

  const deleteMatch = async (id) => {
    if (!window.confirm('Delete this match and all associated data?')) return;
    try {
      await api.delete(`/admin/matches/${id}`);
      showToast('Match deleted');
      loadMatches();
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const statusColors = { upcoming: 'status-pending', live: 'status-approved', completed: 'status-rejected' };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Matches</h1>
          <p className="admin-page-subtitle">{matches.length} matches</p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-outline" onClick={loadMatches}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Add Match
          </button>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>League</th>
              <th>Start Time</th>
              <th>Score</th>
              <th>Status</th>
              <th>Odds (A/B)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m._id}>
                <td>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.teamA}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>vs {m.teamB}</div>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{m.league}</td>
                <td style={{ fontSize: '0.8rem' }}>{formatDateTime(m.startTime)}</td>
                <td>
                  {editingScore === m._id ? (
                    <div className="score-edit">
                      <input placeholder="Score A" value={scoreForm.scoreA} onChange={e => setScoreForm({ ...scoreForm, scoreA: e.target.value })} />
                      <input placeholder="Score B" value={scoreForm.scoreB} onChange={e => setScoreForm({ ...scoreForm, scoreB: e.target.value })} />
                      <input placeholder="Result" value={scoreForm.result} onChange={e => setScoreForm({ ...scoreForm, result: e.target.value })} />
                      <button className="btn btn-primary btn-sm" onClick={() => saveScore(m._id)}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingScore(null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: '0.8rem', cursor: 'pointer', color: m.scoreA ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                      onClick={() => { setEditingScore(m._id); setScoreForm({ scoreA: m.scoreA || '', scoreB: m.scoreB || '', result: m.result || '' }); }}
                    >
                      {m.scoreA || m.scoreB ? <>{m.scoreA} | {m.scoreB}</> : 'Click to edit'}
                      {m.result && <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)' }}>{m.result}</div>}
                    </div>
                  )}
                </td>
                <td>
                  <select
                    value={m.status}
                    onChange={e => updateMatch(m._id, { status: e.target.value })}
                    className="status-select"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--back-blue-dark)' }}>{m.oddsTeamA?.back}</span>
                  {' / '}
                  <span style={{ color: 'var(--back-blue-dark)' }}>{m.oddsTeamB?.back}</span>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteMatch(m._id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Match Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Match</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Team A *</label>
                  <input type="text" placeholder="e.g. Mumbai Indians" value={form.teamA} onChange={e => setForm({ ...form, teamA: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Team B *</label>
                  <input type="text" placeholder="e.g. Chennai Super Kings" value={form.teamB} onChange={e => setForm({ ...form, teamB: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>League</label>
                  <input type="text" value={form.league} onChange={e => setForm({ ...form, league: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Start Time *</label>
                  <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>A Back</label>
                  <input type="number" step="0.01" value={form.oddsTeamA.back} onChange={e => setForm({ ...form, oddsTeamA: { ...form.oddsTeamA, back: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>A Lay</label>
                  <input type="number" step="0.01" value={form.oddsTeamA.lay} onChange={e => setForm({ ...form, oddsTeamA: { ...form.oddsTeamA, lay: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>B Back</label>
                  <input type="number" step="0.01" value={form.oddsTeamB.back} onChange={e => setForm({ ...form, oddsTeamB: { ...form.oddsTeamB, back: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>B Lay</label>
                  <input type="number" step="0.01" value={form.oddsTeamB.lay} onChange={e => setForm({ ...form, oddsTeamB: { ...form.oddsTeamB, lay: parseFloat(e.target.value) } })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addMatch}>Add Match</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
