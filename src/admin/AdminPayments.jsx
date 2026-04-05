import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Check, X, Eye, Download, Filter } from 'lucide-react';
import api, { SERVER_URL } from '../utils/api';

export default function AdminPayments({ onPendingCount }) {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [viewImage, setViewImage] = useState(null);
  const [toast, setToast] = useState('');
  const [processing, setProcessing] = useState(null);

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
    setProcessing(id);
    try {
      await api.patch(`/admin/payments/${id}/approve`);
      showToast('Payment approved! Balance credited.');
      loadPayments();
    } catch (err) {
      showToast('Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const rejectPayment = async (id) => {
    if (!window.confirm('Reject this payment? If withdrawal, amount will be refunded.')) return;
    setProcessing(id);
    try {
      await api.patch(`/admin/payments/${id}/reject`);
      showToast('Payment rejected');
      loadPayments();
    } catch (err) {
      showToast('Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filters = [
    { key: 'pending', label: 'Pending', color: 'var(--accent-warning)' },
    { key: 'approved', label: 'Approved', color: 'var(--accent-success)' },
    { key: 'rejected', label: 'Rejected', color: 'var(--accent-danger)' },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Payments</h1>
          <p className="admin-page-subtitle">Manage deposit and withdrawal requests</p>
        </div>
        <div className="filter-tabs">
          {filters.map(f => (
            <button
              key={f.key}
              className={`filter-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <span className="filter-dot" style={{ background: f.color }} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap"><Filter size={32} /></div>
          <div className="empty-state-title">No {filter} payments</div>
          <div className="empty-state-desc">
            {filter === 'pending' ? 'All caught up! No payments to review.' : `No ${filter} payments found.`}
          </div>
        </div>
      ) : (
        <div className="payments-cards">
          {payments.map(p => (
            <div key={p._id} className="payment-card">
              <div className="payment-card-top">
                <div className="payment-card-user">
                  <div className="payment-card-avatar">
                    {p.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="payment-card-name">{p.userId?.name || 'Unknown'}</div>
                    <div className="payment-card-email">{p.userId?.email}</div>
                  </div>
                </div>
                <div className="payment-card-amount-wrap">
                  <span className={`payment-type-badge ${p.type}`}>{p.type}</span>
                  <span className="payment-card-amount">{formatCurrency(p.amount)}</span>
                </div>
              </div>

              <div className="payment-card-details">
                <div className="payment-detail">
                  <span className="payment-detail-label">Phone</span>
                  <span className="payment-detail-value">{p.userId?.phone || '-'}</span>
                </div>
                {p.utrNumber && (
                  <div className="payment-detail">
                    <span className="payment-detail-label">UTR Number</span>
                    <span className="payment-detail-value">{p.utrNumber}</span>
                  </div>
                )}
                <div className="payment-detail">
                  <span className="payment-detail-label">Date</span>
                  <span className="payment-detail-value">{formatDateTime(p.createdAt)}</span>
                </div>
                {p.screenshotUrl && (
                  <div className="payment-detail">
                    <span className="payment-detail-label">Screenshot</span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setViewImage(`${SERVER_URL}${p.screenshotUrl}`)}
                    >
                      <Eye size={14} /> View
                    </button>
                  </div>
                )}

                {/* Withdrawal Bank/UPI Details */}
                {p.type === 'withdrawal' && p.withdrawMethod && (
                  <div className="withdraw-info-box">
                    <div className="withdraw-info-title">
                      {p.withdrawMethod === 'bank' ? '🏦 Bank Transfer' : '📱 UPI Transfer'}
                    </div>
                    {p.withdrawMethod === 'bank' && (
                      <>
                        <div className="payment-detail">
                          <span className="payment-detail-label">Account Holder</span>
                          <span className="payment-detail-value">{p.accountHolder}</span>
                        </div>
                        <div className="payment-detail">
                          <span className="payment-detail-label">Account Number</span>
                          <span className="payment-detail-value" style={{ fontFamily: 'monospace' }}>{p.accountNumber}</span>
                        </div>
                        <div className="payment-detail">
                          <span className="payment-detail-label">IFSC Code</span>
                          <span className="payment-detail-value" style={{ fontFamily: 'monospace' }}>{p.ifscCode}</span>
                        </div>
                        {p.bankName && (
                          <div className="payment-detail">
                            <span className="payment-detail-label">Bank</span>
                            <span className="payment-detail-value">{p.bankName}</span>
                          </div>
                        )}
                      </>
                    )}
                    {p.withdrawMethod === 'upi' && (
                      <div className="payment-detail">
                        <span className="payment-detail-label">UPI ID</span>
                        <span className="payment-detail-value" style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{p.withdrawUpiId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {filter === 'pending' && (
                <div className="payment-card-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => approvePayment(p._id)}
                    disabled={processing === p._id}
                    style={{ flex: 1 }}
                  >
                    <Check size={16} /> {processing === p._id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => rejectPayment(p._id)}
                    disabled={processing === p._id}
                    style={{ flex: 1 }}
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              )}

              {filter !== 'pending' && (
                <div className="payment-card-footer">
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                  {p.processedAt && (
                    <span className="payment-processed-time">Processed {formatDateTime(p.processedAt)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Viewer */}
      {viewImage && (
        <div className="modal-overlay" onClick={() => setViewImage(null)}>
          <div className="image-viewer" onClick={e => e.stopPropagation()}>
            <button className="image-viewer-close" onClick={() => setViewImage(null)}><X size={20} /></button>
            <img src={viewImage} alt="Payment Screenshot" />
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
