import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Check, X, Eye } from 'lucide-react';
import api from '../utils/api';

export default function AdminPayments({ onPendingCount }) {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [viewImage, setViewImage] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { loadPayments(); }, [filter]);

  const loadPayments = async () => {
    try {
      const res = await api.get(`/admin/payments?status=${filter}`);
      setPayments(res.data);
      if (filter === 'pending') onPendingCount?.(res.data.length);
    } catch (err) {
      console.error('Failed to load payments');
    }
  };

  const approvePayment = async (id) => {
    try {
      await api.patch(`/admin/payments/${id}/approve`);
      showToast('Payment approved!');
      loadPayments();
    } catch (err) {
      showToast('Failed to approve');
    }
  };

  const rejectPayment = async (id) => {
    try {
      await api.patch(`/admin/payments/${id}/reject`);
      showToast('Payment rejected');
      loadPayments();
    } catch (err) {
      showToast('Failed to reject');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>💳 Payments</h1>
        <div className="filter-tabs">
          {['pending', 'approved', 'rejected'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">No {filter} payments</div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Amount</th>
              <th>UTR</th>
              <th>Screenshot</th>
              <th>Date</th>
              <th>Status</th>
              {filter === 'pending' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p._id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.userId?.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.userId?.email}</div>
                </td>
                <td>
                  <span className={`status-badge ${p.type === 'deposit' ? 'status-approved' : 'status-rejected'}`}>
                    {p.type}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(p.amount)}</td>
                <td style={{ fontSize: '0.85rem' }}>{p.utrNumber || '-'}</td>
                <td>
                  {p.screenshotUrl ? (
                    <img
                      src={`http://localhost:5000${p.screenshotUrl}`}
                      alt="Screenshot"
                      className="screenshot-preview"
                      onClick={() => setViewImage(`http://localhost:5000${p.screenshotUrl}`)}
                      style={{ width: 60, height: 45 }}
                    />
                  ) : '-'}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{formatDateTime(p.createdAt)}</td>
                <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                {filter === 'pending' && (
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success btn-sm" onClick={() => approvePayment(p._id)}>
                        <Check size={14} /> Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => rejectPayment(p._id)}>
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Image Viewer */}
      {viewImage && (
        <div className="modal-overlay" onClick={() => setViewImage(null)}>
          <div style={{ maxWidth: '90%', maxHeight: '90%' }}>
            <img src={viewImage} alt="Payment Screenshot" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12 }} />
          </div>
        </div>
      )}

      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}
