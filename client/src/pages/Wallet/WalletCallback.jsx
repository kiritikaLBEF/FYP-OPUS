import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  clearPendingPayment,
  decodeEsewaDataParam,
  readPendingPayment,
} from './walletFormat';
import './Wallet.css';

export default function WalletCallback() {
  const [params] = useSearchParams();
  const { intentId: pathIntentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      const home = user.role === 'employer' ? '/employer/wallet' : '/wallet';
      try {
        const providerParam = params.get('provider');
        const pending = readPendingPayment();
        const provider = providerParam === 'khalti' || pending?.provider === 'khalti'
          ? 'khalti'
          : 'esewa';
        const failed = params.get('status') === 'failed';
        if (failed) {
          clearPendingPayment();
          navigate(home, { replace: true, state: { walletNotice: 'Payment was cancelled or did not complete.' } });
          return;
        }

        const dataParam = params.get('data') || '';
        const payload = decodeEsewaDataParam(dataParam);
        let intentId = pathIntentId
          || params.get('intent')
          || params.get('purchase_order_id')
          || pending?.intentId
          || payload?.transaction_uuid
          || '';

        setMessage('Verifying payment and updating wallet…');
        const data = await api.verifyWalletPayment({
          provider,
          intentId,
          pidx: params.get('pidx') || '',
          data: dataParam,
        });
        clearPendingPayment();
        if (cancelled) return;
        navigate(data.successRedirect || home, {
          replace: true,
          state: { walletNotice: data.message || 'Payment confirmed. Balance updated.' },
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
  }, [navigate, params, pathIntentId, user]);

  return (
    <div className="wal-page">
      <div className="wal-spinner" role="status" aria-label="Confirming payment" />
      <p className="wal-empty" style={{ textAlign: 'center' }}>{message}</p>
    </div>
  );
}
