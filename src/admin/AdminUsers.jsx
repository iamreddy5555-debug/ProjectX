import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Ban, DollarSign } from 'lucide-react';
import api from '../utils/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users');
    }
  };

  const updateBalance = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/balance`, { balance: parseFloat(newBalance) });
      setEditingId(null);
      setNewBalance('');
      loadUsers();
      showToast('Balance updated');
    } catch (err) {
      showToast('Failed to update balance');
    }
  };

  const toggleBan = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/ban`);
      loadUsers();
      showToast('User status updated');
    } catch (err) {
      showToast('Failed to update user');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <h1 className="admin-page-title">👥 Users ({users.length})</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id}>
              <td style={{ fontWeight: 600 }}>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.phone}</td>
              <td>
                {editingId === u._id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={newBalance}
                      onChange={e => setNewBalance(e.target.value)}
                      style={{ width: 100, padding: '4px 8px', borderRadius: 6, fontSize: '0.85rem' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => updateBalance(u._id)}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>✕</button>
                  </div>
                ) : (
                  <span style={{ fontWeight: 700 }}>{formatCurrency(u.balance)}</span>
                )}
              </td>
              <td>
                <span className={`status-badge ${u.banned ? 'status-rejected' : 'status-approved'}`}>
                  {u.banned ? 'Banned' : 'Active'}
                </span>
              </td>
              <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{formatDateTime(u.createdAt)}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditingId(u._id); setNewBalance(String(u.balance)); }}>
                    <DollarSign size={14} /> Edit
                  </button>
                  <button className={`btn btn-sm ${u.banned ? 'btn-success' : 'btn-danger'}`} onClick={() => toggleBan(u._id)}>
                    <Ban size={14} /> {u.banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}
