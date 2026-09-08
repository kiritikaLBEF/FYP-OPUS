import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  ChevronRight,
  X,
} from 'lucide-react';
import { api, getEStatementPdfUrl, getEmployerEStatementPdfUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  fmtNPR,
  fmtNPRFigure,
  fmtLedgerDate,
  postGatewayForm,
  typeLabel,
  txnRef,
} from './walletFormat';
import './Wallet.css';

const TABS = ['Overview', 'Ledger', 'Settings'];
const AMOUNT_PRESETS = [1000, 5000, 10000, 25000];

function LedgerRow({ t }) {
  const credit = Number(t.credit) > 0;
  const amount = credit ? t.credit : t.debit;
  return (
    <div className="wal-row">
      <div className="wal-row__body">
        <div className="wal-row__desc">{t.description || typeLabel(t)}</div>
        <div className="wal-row__meta">
          {t.transactionId || t.id}
          {t.occurredAt ? `, ${fmtLedgerDate(t.occurredAt)}` : ''}
          {`, ${txnRef(t)}`}
        </div>
      </div>
      <div className={`wal-row__amt ${credit ? 'pos' : 'neg'}`}>
        {credit ? '+' : '-'}{fmtNPR(amount)}
      </div>
    </div>
  );
}

export default function Wallet() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isFreelancer = user?.role === 'freelancer';
  const isEmployer = user?.role === 'employer';

  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.walletNotice || '');
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [busy, setBusy] = useState('');

  const [modal, setModal] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(AMOUNT_PRESETS[1]);
  const [customAmount, setCustomAmount] = useState('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [modalProvider, setModalProvider] = useState('esewa');
  const [linkPhone, setLinkPhone] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const [editingMethod, setEditingMethod] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState('10000');

  const load = useCallback(async (filter = ledgerFilter) => {
    setError('');
    const [w, l] = await Promise.all([
      api.getWallet(),
      api.getWalletLedger({ filter, limit: 40 }),
    ]);
    setWallet(w);
    setLedger(l.items || []);
  }, [ledgerFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load wallet'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (location.state?.walletNotice) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const methodFor = (provider) => (wallet?.payoutMethods || []).find((m) => m.provider === provider);
  const primary = useMemo(
    () => (wallet?.payoutMethods || []).find((m) => m.isPrimary) || (wallet?.payoutMethods || [])[0],
    [wallet],
  );

  const khaltiOn = !!wallet?.providers?.khalti?.collection;
  const esewaOn = wallet?.providers?.esewa?.collection !== false;
  const available = Number(wallet?.availableBalance || 0);
  const processing = Number(wallet?.pendingBalance || 0);
  const lifetimeAdded = Number(wallet?.lifetimeEarned || 0);
  const paidOut = isFreelancer
    ? Number(wallet?.lifetimeWithdrawn || 0)
    : Number(wallet?.lifetimeWithdrawn || 0);
  const platformFees = Number(wallet?.platformFees || 0);
  const threshold = Number(wallet?.settings?.lowBalanceThreshold ?? 10000);
  const effectiveAmount = usingCustom ? Number(customAmount) || 0 : selectedPreset;

  const startGateway = async ({ provider, kind, amount, successRedirect }) => {
    const data = await api.initiateWalletPayment({ provider, kind, amount, successRedirect });
    if (data.paymentUrl) {
      try {
        sessionStorage.setItem(
          'opus_pending_payment',
          JSON.stringify({
            intentId: data.intentId,
            provider,
            amount: data.amount,
            at: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }
      window.location.href = data.paymentUrl;
      return;
    }
    if (data.form?.action) {
      postGatewayForm(data.form.action, data.form.fields, {
        intentId: data.intentId,
        provider,
        amount: data.amount,
      });
    }
  };

  const openAddFunds = (provider = 'esewa') => {
    setModalProvider(provider === 'khalti' && khaltiOn ? 'khalti' : 'esewa');
    setUsingCustom(false);
    setSelectedPreset(AMOUNT_PRESETS[1]);
    setCustomAmount('');
    setModal('topup');
  };

  const openWithdraw = (provider) => {
    setModalProvider(provider || primary?.provider || 'esewa');
    setWithdrawAmount(available ? String(available) : '');
    setModal('withdraw');
  };

  const openLink = (provider) => {
    setModalProvider(provider);
    setLinkPhone(wallet?.phone || '');
    setModal('link');
  };

  const onTopup = async () => {
    if (effectiveAmount < 10) {
      setError('Minimum top-up is NPR 10');
      return;
    }
    setBusy('topup');
    setError('');
    try {
      await startGateway({
        provider: modalProvider,
        kind: 'topup',
        amount: effectiveAmount,
        successRedirect: isEmployer ? '/employer/wallet' : '/wallet',
      });
    } catch (err) {
      setError(err.message || 'Could not start payment');
      setBusy('');
    }
  };

  const onWithdraw = async () => {
    setBusy('withdraw');
    setError('');
    try {
      const amount = Number(withdrawAmount);
      const data = await api.withdrawFromWallet({ provider: modalProvider, amount });
      setNotice(data.message || 'Withdrawal submitted');
      setModal(null);
      await load();
    } catch (err) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setBusy('');
    }
  };

  const onLink = async () => {
    setBusy('link');
    setError('');
    try {
      await api.linkWalletPayoutMethod({
        provider: modalProvider,
        accountId: linkPhone,
        isPrimary: true,
      });
      setNotice(`${modalProvider === 'esewa' ? 'eSewa' : 'Khalti'} linked`);
      setModal(null);
      setLinkPhone('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not link account');
    } finally {
      setBusy('');
    }
  };

  const downloadStatement = async () => {
    setBusy('pdf');
    try {
      const token = localStorage.getItem('opus_token');
      const url = isEmployer
        ? getEmployerEStatementPdfUrl({ preset: 'last_3_months' })
        : getEStatementPdfUrl({ preset: 'last_3_months' });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'OPUS-e-statement.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err.message || 'Could not download statement');
    } finally {
      setBusy('');
    }
  };

  const saveThreshold = async () => {
    setBusy('threshold');
    try {
      await api.updateWalletSettings({ lowBalanceThreshold: Number(thresholdDraft) || 0 });
      setEditingThreshold(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save threshold');
    } finally {
      setBusy('');
    }
  };

  if (loading && !wallet) {
    return (
      <div className="wal-page">
        <div className="wal-spinner" role="status" aria-label="Loading wallet" />
      </div>
    );
  }

  const esewaMethod = methodFor('esewa');
  const khaltiMethod = methodFor('khalti');

  return (
    <div className="wal-page">
      <div className="wal-topbar">
        <div className="wal-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={`wal-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="wal-actions">
          <button type="button" className="wal-btn wal-btn--ghost" disabled={busy === 'pdf'} onClick={downloadStatement}>
            <Download size={14} /> Download e-statement
          </button>
          {isEmployer && (
            <button type="button" className="wal-btn wal-btn--primary" onClick={() => openAddFunds()}>
              <Plus size={14} /> Add funds
            </button>
          )}
          {isFreelancer && (
            <button type="button" className="wal-btn wal-btn--primary" onClick={() => openWithdraw()}>
              Withdraw
            </button>
          )}
        </div>
      </div>

      <div className="wal-heading-row">
        <h1 className="wal-heading">Wallet</h1>
        {notice ? <span className="wal-confirm">{notice}</span> : null}
      </div>
      <p className="wal-sub">
        {isFreelancer
          ? 'Job payments land here after OPUS takes its service charge. Withdraw to a linked eSewa or Khalti account when you are ready.'
          : 'Add funds here, then release them to a freelancer once you approve their delivery.'}
      </p>

      {error ? <p className="wal-banner wal-banner--err">{error}</p> : null}

      {tab !== 'Settings' && (
        <section className="wal-hero">
          <div className="wal-hero__left">
            <div className="wal-hero__label">
              {isFreelancer ? 'Available to withdraw' : 'Available to pay'}
            </div>
            <div className="wal-hero__figure">
              <span>NPR</span> {fmtNPRFigure(available)}
            </div>
            {isFreelancer && !primary && (
              <p className="wal-hero__note">
                <button type="button" onClick={() => openLink('esewa')}>
                  Link a payout account.
                </button>
              </p>
            )}
            {isEmployer && (
              <p className="wal-hero__note">
                <button type="button" onClick={() => openAddFunds()}>
                  Add more from a linked method.
                </button>
              </p>
            )}
            {available < threshold && (
              <p className="wal-low">Balance is below your alert of {fmtNPR(threshold, { digits: 0 })}.</p>
            )}
          </div>

          <div className="wal-hero__right">
            <div className="wal-methods-label">
              {isFreelancer ? 'Payout methods' : 'Payment methods'}
            </div>

            <div className="wal-method">
              <div className="wal-method__mark wal-method__mark--esewa">eS</div>
              <div className="wal-method__body">
                <div className="wal-method__name">eSewa</div>
                <div className={`wal-method__meta${esewaMethod || (isEmployer && esewaOn) ? ' linked' : ''}`}>
                  {isFreelancer
                    ? (esewaMethod ? `Linked, wallet ending ${esewaMethod.last4}` : 'Not connected')
                    : (esewaOn ? 'Ready for top-up' : 'Not configured on server')}
                </div>
              </div>
              {isEmployer ? (
                <button
                  type="button"
                  className="wal-method__cta wal-method__cta--esewa"
                  disabled={!esewaOn}
                  onClick={() => openAddFunds('esewa')}
                >
                  Top up
                </button>
              ) : esewaMethod ? (
                <button type="button" className="wal-method__cta wal-method__cta--esewa" onClick={() => openWithdraw('esewa')}>
                  Withdraw
                </button>
              ) : (
                <button type="button" className="wal-method__cta" onClick={() => openLink('esewa')}>
                  Connect
                </button>
              )}
            </div>

            <div className="wal-method">
              <div className="wal-method__mark wal-method__mark--khalti">Kh</div>
              <div className="wal-method__body">
                <div className="wal-method__name">Khalti</div>
                <div className={`wal-method__meta${khaltiMethod || (isEmployer && khaltiOn) ? ' linked' : ''}`}>
                  {isFreelancer
                    ? (khaltiMethod ? `Linked, wallet ending ${khaltiMethod.last4}` : 'Not connected')
                    : (khaltiOn ? 'Ready for top-up' : 'Not connected')}
                </div>
              </div>
              {isEmployer ? (
                <button
                  type="button"
                  className="wal-method__cta"
                  disabled={!khaltiOn}
                  onClick={() => openAddFunds('khalti')}
                >
                  {khaltiOn ? 'Top up' : 'Unavailable'}
                </button>
              ) : khaltiMethod ? (
                <button type="button" className="wal-method__cta" onClick={() => openWithdraw('khalti')}>
                  Withdraw
                </button>
              ) : (
                <button type="button" className="wal-method__cta" onClick={() => openLink('khalti')}>
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'Overview' && (
        <>
          <section className="wal-stats">
            <div className="wal-stat">
              <div className="wal-stat__value">
                <span className="wal-dot wal-dot--amber" />
                {fmtNPR(processing)}
              </div>
              <div className="wal-stat__label">Processing</div>
            </div>
            <div className="wal-stat">
              <div className="wal-stat__value">
                <span className="wal-dot wal-dot--ok" />
                {fmtNPR(lifetimeAdded)}
              </div>
              <div className="wal-stat__label">{isFreelancer ? 'Lifetime earned' : 'Lifetime added'}</div>
            </div>
            <div className="wal-stat">
              <div className="wal-stat__value">
                <span className="wal-dot" />
                {fmtNPR(isFreelancer ? platformFees : paidOut)}
              </div>
              <div className="wal-stat__label">
                {isFreelancer
                  ? `OPUS fees (${Math.round((wallet?.feeRate || 0.1) * 100)}%)`
                  : 'Paid to talent'}
              </div>
            </div>
          </section>

          <section className="wal-grid">
            <div className="wal-panel wal-ledger">
              <div className="wal-panel__head">
                <div>
                  <div className="wal-panel__title">Recent activity</div>
                  <div className="wal-panel__sub">Latest credits and payouts for this account</div>
                </div>
                <button type="button" className="wal-link" onClick={() => setTab('Ledger')}>
                  View full ledger
                </button>
              </div>
              {ledger.length === 0 ? (
                <p className="wal-empty">No movements yet for this wallet.</p>
              ) : (
                ledger.slice(0, 5).map((t) => <LedgerRow key={t.id} t={t} />)
              )}
            </div>

            <div className="wal-panel wal-side">
              <div className="wal-panel__head">
                <div className="wal-panel__title">Quick settings</div>
              </div>
              {isFreelancer && (
                <div className="wal-settings-row static">
                  <div>
                    <div className="wal-settings__label">Auto-withdraw</div>
                    <div className="wal-settings__meta">
                      {primary
                        ? `Send to ${primary.provider === 'esewa' ? 'eSewa' : 'Khalti'} when enabled`
                        : 'Link a payout account first'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`wal-toggle${wallet?.settings?.autoWithdraw ? ' on' : ''}`}
                    aria-pressed={!!wallet?.settings?.autoWithdraw}
                    disabled={!primary}
                    onClick={() => api.updateWalletSettings({
                      autoWithdraw: !wallet?.settings?.autoWithdraw,
                      autoWithdrawProvider: primary?.provider || '',
                    }).then(load)}
                  >
                    <span className="wal-toggle__knob" />
                  </button>
                </div>
              )}
              <div className="wal-settings-row static">
                <div>
                  <div className="wal-settings__label">Email receipts</div>
                  <div className="wal-settings__meta">
                    {wallet?.email ? `Via ${wallet.email}` : 'Uses your account email'}
                  </div>
                </div>
                <button
                  type="button"
                  className={`wal-toggle${wallet?.settings?.emailReceipts !== false ? ' on' : ''}`}
                  aria-pressed={wallet?.settings?.emailReceipts !== false}
                  onClick={() => api.updateWalletSettings({
                    emailReceipts: wallet?.settings?.emailReceipts === false,
                  }).then(load)}
                >
                  <span className="wal-toggle__knob" />
                </button>
              </div>
              <button type="button" className="wal-link wal-link--block" onClick={() => setTab('Settings')}>
                Open full settings
              </button>
            </div>
          </section>

          {isFreelancer && (wallet?.earningsByClient || []).length > 0 && (
            <section className="wal-panel" style={{ marginTop: 18 }}>
              <div className="wal-panel__head">
                <div className="wal-panel__title">Earnings by client</div>
              </div>
              {wallet.earningsByClient.map((row) => (
                <div key={row.name} className="wal-bd">
                  <span>{row.name}</span>
                  <strong>{fmtNPR(row.amount, { digits: 0 })}</strong>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'Ledger' && (
        <section className="wal-panel wal-ledger wal-ledger--full">
          <div className="wal-panel__head">
            <div>
              <div className="wal-panel__title">Transaction ledger</div>
              <div className="wal-panel__sub">Every credit and payout for the signed-in account</div>
            </div>
            <div className="wal-chips">
              {[['all', 'All'], ['credits', 'Credits'], ['payouts', 'Payouts']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`wal-chip${ledgerFilter === key ? ' active' : ''}`}
                  onClick={() => setLedgerFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {ledger.length === 0 ? (
            <p className="wal-empty">No transactions in this filter.</p>
          ) : (
            ledger.map((t) => <LedgerRow key={t.id} t={t} />)
          )}
        </section>
      )}

      {tab === 'Settings' && (
        <section className="wal-panel">
          <div className="wal-settings-page">
            <div className="wal-settings-section">Notifications</div>
            <div className="wal-settings-row static">
              <div>
                <div className="wal-settings__label">Email receipts</div>
                <div className="wal-settings__meta">
                  {wallet?.email ? `Via ${wallet.email}` : 'Uses your account email'}
                </div>
              </div>
              <button
                type="button"
                className={`wal-toggle${wallet?.settings?.emailReceipts !== false ? ' on' : ''}`}
                onClick={() => api.updateWalletSettings({
                  emailReceipts: wallet?.settings?.emailReceipts === false,
                }).then(load)}
              >
                <span className="wal-toggle__knob" />
              </button>
            </div>

            {isFreelancer && (
              <>
                <div className="wal-settings-section">Payouts</div>
                <div
                  className={`wal-settings-row${editingMethod ? ' static' : ''}`}
                  onClick={() => !editingMethod && setEditingMethod(true)}
                  onKeyDown={() => {}}
                  role="presentation"
                >
                  <div>
                    <div className="wal-settings__label">Default payout method</div>
                    {!editingMethod && (
                      <div className="wal-settings__meta">
                        {primary
                          ? `${primary.provider === 'esewa' ? 'eSewa' : 'Khalti'}, wallet ending ${primary.last4}`
                          : 'None linked yet'}
                      </div>
                    )}
                  </div>
                  {editingMethod ? (
                    <div className="wal-inline-select">
                      {['esewa', 'khalti'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`wal-inline-option${primary?.provider === p ? ' selected' : ''}`}
                          disabled={!methodFor(p)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const m = methodFor(p);
                            if (m) api.setPrimaryWalletPayout(m.id).then(load);
                          }}
                        >
                          {p === 'esewa' ? 'eSewa' : 'Khalti'}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="wal-mini"
                        onClick={(e) => { e.stopPropagation(); setEditingMethod(false); }}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <ChevronRight size={16} className="wal-chevron" />
                  )}
                </div>

                {(wallet?.payoutMethods || []).map((m) => (
                  <div key={m.id} className="wal-settings-row static">
                    <div>
                      <div className="wal-settings__label">
                        {m.provider === 'esewa' ? 'eSewa' : 'Khalti'} · {m.masked}
                      </div>
                      <div className="wal-settings__meta">{m.isPrimary ? 'Primary payout' : 'Linked'}</div>
                    </div>
                    <div className="wal-inline-select">
                      {!m.isPrimary && (
                        <button
                          type="button"
                          className="wal-mini"
                          onClick={() => api.setPrimaryWalletPayout(m.id).then(load)}
                        >
                          Make primary
                        </button>
                      )}
                      <button
                        type="button"
                        className="wal-mini wal-mini--muted"
                        onClick={() => api.unlinkWalletPayout(m.id).then(load)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="wal-settings-section">Alerts</div>
            <div
              className={`wal-settings-row${editingThreshold ? ' static' : ''}`}
              onClick={() => {
                if (!editingThreshold) {
                  setThresholdDraft(String(threshold));
                  setEditingThreshold(true);
                }
              }}
              onKeyDown={() => {}}
              role="presentation"
            >
              <div>
                <div className="wal-settings__label">Low-balance alert</div>
                {!editingThreshold && (
                  <div className="wal-settings__meta">
                    Notify below {fmtNPR(threshold, { digits: 0 })}
                  </div>
                )}
              </div>
              {editingThreshold ? (
                <div className="wal-inline-edit" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="wal-inline-input"
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    aria-label="Low balance threshold"
                  />
                  <button type="button" className="wal-mini" disabled={busy === 'threshold'} onClick={saveThreshold}>
                    Save
                  </button>
                  <button type="button" className="wal-mini wal-mini--muted" onClick={() => setEditingThreshold(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <ChevronRight size={16} className="wal-chevron" />
              )}
            </div>
          </div>
        </section>
      )}

      {modal && (
        <div className="wal-overlay" onClick={() => setModal(null)} role="presentation">
          <div
            className="wal-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wal-modal__head">
              <div className="wal-modal__title">
                {modal === 'topup' && 'Add funds'}
                {modal === 'withdraw' && 'Withdraw funds'}
                {modal === 'link' && `Link ${modalProvider === 'esewa' ? 'eSewa' : 'Khalti'}`}
              </div>
              <button type="button" className="wal-modal__close" onClick={() => setModal(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {modal === 'topup' && (
              <>
                <p className="wal-modal__sub">Choose an amount to add. You will finish on the payment gateway.</p>
                <div className="wal-preset-row">
                  {AMOUNT_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`wal-preset${!usingCustom && selectedPreset === p ? ' selected' : ''}`}
                      onClick={() => { setUsingCustom(false); setSelectedPreset(p); }}
                    >
                      {p.toLocaleString('en-NP')}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`wal-preset${usingCustom ? ' selected' : ''}`}
                    onClick={() => setUsingCustom(true)}
                  >
                    Custom
                  </button>
                </div>
                {usingCustom && (
                  <input
                    className="wal-custom-input"
                    placeholder="Enter amount in NPR"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                )}
                <div className="wal-method-select">
                  <button
                    type="button"
                    className={`wal-method-option${modalProvider === 'esewa' ? ' selected' : ''}`}
                    disabled={!esewaOn}
                    onClick={() => setModalProvider('esewa')}
                  >
                    <span className="wal-method__mark wal-method__mark--esewa sm">eS</span>
                    <span>eSewa</span>
                  </button>
                  <button
                    type="button"
                    className={`wal-method-option${modalProvider === 'khalti' ? ' selected' : ''}`}
                    disabled={!khaltiOn}
                    onClick={() => setModalProvider('khalti')}
                  >
                    <span className="wal-method__mark wal-method__mark--khalti sm">Kh</span>
                    <span>{khaltiOn ? 'Khalti' : 'Khalti, not configured'}</span>
                  </button>
                </div>
                <div className="wal-modal__actions">
                  <button type="button" className="wal-btn wal-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button
                    type="button"
                    className="wal-btn wal-btn--primary"
                    disabled={busy === 'topup' || effectiveAmount <= 0}
                    onClick={onTopup}
                  >
                    {busy === 'topup' ? 'Opening…' : `Add ${effectiveAmount > 0 ? fmtNPR(effectiveAmount) : ''}`}
                  </button>
                </div>
              </>
            )}

            {modal === 'withdraw' && (
              <>
                <p className="wal-modal__sub">Send available balance to a linked payout account.</p>
                <div className="wal-method-select">
                  {['esewa', 'khalti'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`wal-method-option${modalProvider === p ? ' selected' : ''}`}
                      disabled={!methodFor(p)}
                      onClick={() => setModalProvider(p)}
                    >
                      <span className={`wal-method__mark wal-method__mark--${p} sm`}>
                        {p === 'esewa' ? 'eS' : 'Kh'}
                      </span>
                      <span>
                        {p === 'esewa' ? 'eSewa' : 'Khalti'}
                        {methodFor(p) ? `, ending ${methodFor(p).last4}` : ' (not linked)'}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  className="wal-custom-input"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  aria-label="Withdraw amount"
                />
                <p className="wal-modal__sub">Max available: {fmtNPR(available)}</p>
                <div className="wal-modal__actions">
                  <button type="button" className="wal-btn wal-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button
                    type="button"
                    className="wal-btn wal-btn--primary"
                    disabled={busy === 'withdraw' || !methodFor(modalProvider)}
                    onClick={onWithdraw}
                  >
                    {busy === 'withdraw' ? 'Sending…' : 'Confirm withdrawal'}
                  </button>
                </div>
              </>
            )}

            {modal === 'link' && (
              <>
                <p className="wal-modal__sub">Use the mobile number registered on that wallet.</p>
                <input
                  className="wal-custom-input"
                  value={linkPhone}
                  onChange={(e) => setLinkPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  inputMode="tel"
                  aria-label="Mobile number"
                />
                <div className="wal-modal__actions">
                  <button type="button" className="wal-btn wal-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button
                    type="button"
                    className="wal-btn wal-btn--primary"
                    disabled={busy === 'link'}
                    onClick={onLink}
                  >
                    {busy === 'link' ? 'Saving…' : 'Save account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
