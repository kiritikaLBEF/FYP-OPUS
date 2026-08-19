import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../Dashboard/Dashboard.css';
import './Wallet.css';

export default function WalletCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const provider = params.get('provider') === 'khalti' ? 'khalti' : 'esewa';
      const failed = params.get('status') === 'failed';
      const home = user?.role === 'employer' ? '/employer/wallet' : '/wallet';
      if (failed) {
        navigate(home, { replace: true, state: { walletNotice: 'Payment was cancelled or did not complete.' } });
        return;
      }
      try {
        const data = await api.verifyWalletPayment({
          provider,
          intentId: params.get('intent') || params.get('purchase_order_id') || '',
          pidx: params.get('pidx') || '',
          data: params.get('data') || '',
        });
        if (cancelled) return;
        navigate(data.successRedirect || home, {
          replace: true,
          state: { walletNotice: data.message || 'Payment confirmed' },
        });
      } catch (err) {
        if (cancelled) return;
        navigate(home, {
          replace: true,
          state: { walletNotice: err.message || 'Could not confirm this payment' },
        });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [navigate, params, user?.role]);

  return (
    <div className="db-page db-page--single">
      <div className="wal-page">
        <div className="wal-spinner" role="status" aria-label="Confirming payment" />
        <p className="wal-empty" style={{ textAlign: 'center' }}>{message}</p>
      </div>
    </div>
  );
}
