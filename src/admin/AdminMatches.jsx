import { useState, useEffect } from 'react';
import { formatDateTime } from '../utils/formatters';
import { Plus, Trash2, RefreshCw, X } from 'lucide-react';
import api from '../utils/api';

export default function AdminMatches() {
  const [matches, setMatches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
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
      const data = {
        ...form,
        title: form.title || `${form.teamA} vs ${form.teamB}`,
      };
      await api.post('/admin/matches', data);
      setShowAdd(false);
      setForm({ title: '', teamA: '', teamB: '', league: 'IPL 2026', startTime: '', status: 'upcoming', oddsTeamA: { back: 1.5, lay: 1.55 }, oddsTeamB: { back: 2.5, lay: 2.55 } });
      showToast('Match added!');
      loadMatches();
    } catch (err) {
      showToast('Failed to add match');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/matches/${id}`, { status });
      loadMatches();
      showToast(`Match set to ${status}`);
    } catch (err) {
      showToast('Failed to update');
    }
  };

  const deleteMatch = async (id) => {
    if (!window.confirm('Delete this match?')) return;
    try {
      await api.delete(`/admin/matches/${id}`);
      showToast('Match deleted');
      loadMatches();
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>🏏 Matches ({matches.length})</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Add Match
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Match</th>
            <th>League</th>
            <th>Start Time</th>
            <th>Status</th>
            <th>Team A Odds</th>
            <th>Team B Odds</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => (
            <tr key={m._id}>
              <td style={{ fontWeight: 600 }}>{m.teamA} vs {m.teamB}</td>
              <td>{m.league}</td>
              <td style={{ fontSize: '0.8rem' }}>{formatDateTime(m.startTime)}</td>
              <td>
                <select
                  value={m.status}
                  onChange={e => updateStatus(m._id, e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem', border: '1px solid var(--border-light)' }}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                </select>
              </td>
              <td style={{ fontSize: '0.85rem' }}>{m.oddsTeamA?.back} / {m.oddsTeamA?.lay}</td>
              <td style={{ fontSize: '0.85rem' }}>{m.oddsTeamB?.back} / {m.oddsTeamB?.lay}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => deleteMatch(m._id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Match Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Match</h3>
              <button className="bet-slip-close" onClick={() => setShowAdd(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Team A *</label>
                <input type="text" placeholder="e.g. Mumbai Indians" value={form.teamA} onChange={e => setForm({ ...form, teamA: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Team B *</label>
                <input type="text" placeholder="e.g. Chennai Super Kings" value={form.teamB} onChange={e => setForm({ ...form, teamB: e.target.value })} />
              </div>
              <div className="form-group">
                <label>League</label>
                <input type="text" placeholder="IPL 2026" value={form.league} onChange={e => setForm({ ...form, league: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Team A Back Odds</label>
                  <input type="number" step="0.01" value={form.oddsTeamA.back} onChange={e => setForm({ ...form, oddsTeamA: { ...form.oddsTeamA, back: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>Team A Lay Odds</label>
                  <input type="number" step="0.01" value={form.oddsTeamA.lay} onChange={e => setForm({ ...form, oddsTeamA: { ...form.oddsTeamA, lay: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>Team B Back Odds</label>
                  <input type="number" step="0.01" value={form.oddsTeamB.back} onChange={e => setForm({ ...form, oddsTeamB: { ...form.oddsTeamB, back: parseFloat(e.target.value) } })} />
                </div>
                <div className="form-group">
                  <label>Team B Lay Odds</label>
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

      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}
