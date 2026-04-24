import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Upload, X } from 'lucide-react';
import api, { resolveImageUrl } from '../utils/api';

export default function Wallet() {
  const { user, updateBalance } = useAuth();
  const [payments, setPayments] = useState([]);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [bankDetails, setBankDetails] = useState({ accountNumber: '', ifscCode: '', accountHolder: '', bankName: '' });
  const [withdrawUpiId, setWithdrawUpiId] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const res = await api.get('/payments/history');
      setPayments(res.data);
    } catch (err) {
      console.error('Failed to load payments');
    }
  };

  const openDeposit = async () => {
    try {
      const res = await api.get('/payments/qr');
      setQrCode(res.data);
      setShowDeposit(true);
    } catch (err) {
      setToast('No payment methods available. Contact admin.');
    }
  };

  const submitDeposit = async () => {
    if (!amount || parseFloat(amount) < 100) {
      setToast('Minimum deposit is ₹100');
      return;
    }
    if (!screenshot) {
      setToast('Please upload payment screenshot');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('screenshot', screenshot);
      formData.append('qrCodeId', qrCode?._id || '');
      formData.append('utrNumber', utr);
      await api.post('/payments/deposit', formData);
      setShowDeposit(false);
      setAmount('');
      setScreenshot(null);
      setUtr('');
      setToast('Deposit request submitted! Admin will approve shortly.');
      loadPayments();
    } catch (err) {
      setToast(err.response?.data?.message || 'Failed to submit deposit');
    } finally {
      setLoading(false);
    }
  };

  const submitWithdraw = async () => {
    if (!amount || parseFloat(amount) < 100) {
      setToast('Minimum withdrawal is ₹100'); return;
    }
    if (!withdrawMethod) {
      setToast('Select a withdrawal method'); return;
    }
    if (withdrawMethod === 'bank') {
      if (!bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolder) {
        setToast('Fill all bank account details'); return;
      }
    }
    if (withdrawMethod === 'upi' && !withdrawUpiId) {
      setToast('Enter your UPI ID'); return;
    }
    setLoading(true);
    try {
      const res = await api.post('/payments/withdraw', {
        amount: parseFloat(amount),
        withdrawMethod,
        ...(withdrawMethod === 'bank' ? bankDetails : {}),
        withdrawUpiId: withdrawMethod === 'upi' ? withdrawUpiId : '',
      });
      updateBalance(res.data.newBalance);
      setShowWithdraw(false);
      setAmount('');
      setWithdrawMethod('');
      setBankDetails({ accountNumber: '', ifscCode: '', accountHolder: '', bankName: '' });
      setWithdrawUpiId('');
      setToast('Withdrawal request submitted! Admin will process shortly.');
      loadPayments();
    } catch (err) {
      setToast(err.response?.data?.message || 'Failed to submit withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      {/* Balance Card */}
      <div className="wallet-card">
        <div className="wallet-balance-label">Available Balance</div>
        <div className="wallet-balance-amount">{formatCurrency(user?.balance || 0)}</div>
        <div className="wallet-actions">
          <button className="btn" onClick={openDeposit}>
            <ArrowDownCircle size={18} /> Deposit
          </button>
          <button className="btn" onClick={() => setShowWithdraw(true)}>
            <ArrowUpCircle size={18} /> Withdraw
          </button>
        </div>
      </div>

      {/* Payment History */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Transaction History</h2>
      {payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💳</div>
          <div className="empty-state-title">No transactions yet</div>
          <div className="empty-state-desc">Make your first deposit to start betting</div>
        </div>
      ) : (
        <div className="payment-list">
          {payments.map(p => (
            <div key={p._id} className="payment-item">
              <div className="payment-item-info">
                <div className={`payment-item-icon ${p.type}`}>
                  {p.type === 'deposit' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                </div>
                <div>
                  <div className="payment-item-title">{p.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</div>
                  <div className="payment-item-date">{formatDateTime(p.createdAt)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`status-badge status-${p.status}`}>{p.status}</span>
                <span className={`payment-item-amount ${p.type === 'deposit' ? 'positive' : 'negative'}`}>
                  {p.type === 'deposit' ? '+' : '-'}{formatCurrency(p.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="modal-overlay" onClick={() => setShowDeposit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">💰 Deposit Funds</h3>
              <button className="bet-slip-close" onClick={() => setShowDeposit(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {qrCode && (
                <div className="qr-display">
                  <div className="qr-image" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {qrCode.imageUrl ? (
                      <img src={resolveImageUrl(qrCode.imageUrl)} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} />
                    ) : (
                      <span>QR Code</span>
                    )}
                  </div>
                  <div className="qr-upi-id">{qrCode.upiId}</div>
                  <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    Scan the QR code or send to UPI ID above
                  </p>
                </div>
              )}

              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" placeholder="Enter amount (min ₹100)" value={amount} onChange={e => setAmount(e.target.value)} min="100" />
              </div>

              <div className="form-group">
                <label>UTR / Reference Number (Optional)</label>
                <input type="text" placeholder="Enter UTR number" value={utr} onChange={e => setUtr(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Payment Screenshot *</label>
                <div className="file-upload">
                  <input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files[0])} />
                  <div className="file-upload-icon">📸</div>
                  <div className="file-upload-label">
                    {screenshot ? screenshot.name : 'Click to upload payment screenshot'}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeposit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitDeposit} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Withdraw Funds</h3>
              <button className="modal-close" onClick={() => setShowWithdraw(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--accent-success-light)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: '0.9rem' }}>
                Available Balance: <strong style={{ color: 'var(--accent-success)' }}>{formatCurrency(user?.balance || 0)}</strong>
              </div>

              <div className="form-group">
                <label>Amount (₹) *</label>
                <input type="number" placeholder="Enter amount (min ₹100)" value={amount} onChange={e => setAmount(e.target.value)} min="100" />
              </div>

              {/* Withdrawal Method Selection */}
              <div className="form-group">
                <label>Withdrawal Method *</label>
                <div className="withdraw-method-tabs">
                  <button
                    type="button"
                    className={`withdraw-method-tab ${withdrawMethod === 'bank' ? 'active' : ''}`}
                    onClick={() => setWithdrawMethod('bank')}
                  >
                    🏦 Bank Transfer
                  </button>
                  <button
                    type="button"
                    className={`withdraw-method-tab ${withdrawMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setWithdrawMethod('upi')}
                  >
                    📱 UPI
                  </button>
                </div>
              </div>

              {/* Bank Details */}
              {withdrawMethod === 'bank' && (
                <div className="withdraw-details-section">
                  <div className="form-group">
                    <label>Account Holder Name *</label>
                    <input type="text" placeholder="As per bank records" value={bankDetails.accountHolder}
                      onChange={e => setBankDetails({ ...bankDetails, accountHolder: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Account Number *</label>
                    <input type="text" placeholder="Enter account number" value={bankDetails.accountNumber}
                      onChange={e => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '') })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>IFSC Code *</label>
                      <input type="text" placeholder="e.g. SBIN0001234" value={bankDetails.ifscCode}
                        onChange={e => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                        maxLength={11} />
                    </div>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input type="text" placeholder="e.g. SBI, HDFC" value={bankDetails.bankName}
                        onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* UPI Details */}
              {withdrawMethod === 'upi' && (
                <div className="withdraw-details-section">
                  <div className="form-group">
                    <label>UPI ID *</label>
                    <input type="text" placeholder="yourname@upi" value={withdrawUpiId}
                      onChange={e => setWithdrawUpiId(e.target.value)} />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: -8 }}>
                    Money will be sent to this UPI ID
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowWithdraw(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={submitWithdraw} disabled={loading || !withdrawMethod}>
                {loading ? 'Submitting...' : 'Request Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
