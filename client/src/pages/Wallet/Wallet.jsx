import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, getEStatementPdfUrl, getEmployerEStatementPdfUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fmtNPR, fmtLedgerDate, postGatewayForm, typeLabel } from './walletFormat';
import '../Dashboard/Dashboard.css';
import '../Dashboard/dashboard-tokens.css';
import '../Dashboard/dashboard-glass.css';
import '../Dashboard/dashboard-theme.css';
import './Wallet.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'settings', label: 'Settings' },
];

function Switch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      className={`wal-switch ${on ? 'wal-switch--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    />
  );
}

function PayCard({ provider, method, holder, onPrimary, onLink }) {
  const linked = !!method;
  const isEsewa = provider === 'esewa';
  return (
    <button
      type="button"
      className={`wal-paycard wal-paycard--${provider} ${linked ? 'wal-paycard--linked' : ''}`}
      onClick={() => (linked ? onPrimary?.(method) : onLink?.(provider))}
    >
      <div className="wal-paycard__top">
        <span className="wal-paycard__brand">{isEsewa ? 'eSewa' : 'Khalti'}</span>
        <span className="wal-paycard__tag">
          {linked ? (method.isPrimary ? 'Primary' : 'Linked') : 'Not linked'}
        </span>
      </div>
      <p className="wal-paycard__num">{linked ? method.masked : '•••• •••• ••••'}</p>
      <div className="wal-paycard__bottom">
        <span>{holder || 'Your name'}</span>
        <small>{linked ? 'Tap to set as primary' : 'Tap to connect'}</small>
      </div>
    </button>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="wal-sheet" role="dialog" aria-modal="true" aria-labelledby="wal-sheet-title">
      <button type="button" className="wal-sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="wal-sheet__panel">
        <header className="wal-sheet__head">
          <button type="button" className="wal-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          <h3 id="wal-sheet-title">{title}</h3>
        </header>
        <div className="wal-sheet__body">{children}</div>
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

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.walletNotice || '');
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [busy, setBusy] = useState('');

  const [sheet, setSheet] = useState(null);
  const [withdrawProvider, setWithdrawProvider] = useState('esewa');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [linkProvider, setLinkProvider] = useState('esewa');
  const [linkPhone, setLinkPhone] = useState('');
  const [topupProvider, setTopupProvider] = useState('esewa');
  const [topupAmount, setTopupAmount] = useState('');

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

  const startGateway = async ({ provider, kind, amount, sessionId, successRedirect }) => {
    const data = await api.initiateWalletPayment({
      provider,
      kind,
      amount,
      sessionId,
      successRedirect,
    });
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
      return;
    }
    if (data.form?.action) {
      postGatewayForm(data.form.action, data.form.fields);
    }
  };

  const onWithdraw = async () => {
    setBusy('withdraw');
    setError('');
    try {
      const amount = Number(withdrawAmount);
      const data = await api.withdrawFromWallet({ provider: withdrawProvider, amount });
      setNotice(data.message);
      setSheet(null);
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
      await api.linkWalletPayoutMethod({ provider: linkProvider, accountId: linkPhone, isPrimary: true });
      setNotice(`${linkProvider === 'esewa' ? 'eSewa' : 'Khalti'} linked`);
      setSheet(null);
      setLinkPhone('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not link account');
    } finally {
      setBusy('');
    }
  };

  const onTopup = async () => {
    setBusy('topup');
    setError('');
    try {
      await startGateway({
        provider: topupProvider,
        kind: 'topup',
        amount: Number(topupAmount),
        successRedirect: isEmployer ? '/employer/wallet' : '/wallet',
      });
    } catch (err) {
      setError(err.message || 'Could not start payment');
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

  const openWithdraw = (provider) => {
    const next = provider || primary?.provider || 'esewa';
    setWithdrawProvider(next);
    setWithdrawAmount(wallet?.availableBalance ? String(wallet.availableBalance) : '');
    setSheet('withdraw');
  };

  const openLink = (provider) => {
    setLinkProvider(provider);
    setLinkPhone(wallet?.phone || '');
    setSheet('link');
  };

  if (loading && !wallet) {
    return (
      <div className="db-page db-page--single">
        <div className="wal-page"><div className="wal-spinner" role="status" aria-label="Loading wallet" /></div>
      </div>
    );
  }

  const available = wallet?.availableBalance || 0;
  const holder = wallet?.displayName || '';
  const khaltiOn = !!wallet?.providers?.khalti?.collection;
  const esewaOn = wallet?.providers?.esewa?.collection !== false;

  return (
    <div className="db-page db-page--single">
      <div className="db-ambient" aria-hidden="true">
        <div className="db-ambient__blob db-ambient__blob--1" />
        <div className="db-ambient__blob db-ambient__blob--2" />
        <div className="db-ambient__blob db-ambient__blob--3" />
      </div>
      <main className="wal-page dashboard-token-scope">
        <header className="wal-toolbar">
          <div className="wal-seg" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={tab === t.id ? 'on' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="wal-toolbar__actions">
            <button type="button" className="opus-btn opus-btn--secondary" disabled={busy === 'pdf'} onClick={downloadStatement}>
              Download e-statement
            </button>
            {isFreelancer && (
              <button type="button" className="opus-btn opus-btn--primary" onClick={() => openWithdraw()}>
                Withdraw
              </button>
            )}
            {isEmployer && (
              <button type="button" className="opus-btn opus-btn--primary" onClick={() => { setTopupAmount(''); setSheet('topup'); }}>
                Add funds
              </button>
            )}
          </div>
        </header>

        {notice ? <p className="wal-banner wal-banner--ok">{notice}</p> : null}
        {error ? <p className="wal-banner wal-banner--err">{error}</p> : null}

        {tab === 'overview' && (
          <>
            <div className="wal-pagehead">
              <h1>Wallet</h1>
              <p>
                {isFreelancer
                  ? 'Job payments land here first. Withdraw to eSewa or Khalti when you are ready.'
                  : 'Add funds, then pay freelancers from this OPUS balance when work is approved.'}
              </p>
            </div>

            <section className="wal-hero glass-surface">
              <div className="wal-cards">
                <PayCard
                  provider="esewa"
                  method={methodFor('esewa')}
                  holder={holder}
                  onPrimary={(m) => isFreelancer && api.setPrimaryWalletPayout(m.id).then(load)}
                  onLink={isFreelancer ? openLink : () => { setTopupProvider('esewa'); setSheet('topup'); }}
                />
                <PayCard
                  provider="khalti"
                  method={methodFor('khalti')}
                  holder={holder}
                  onPrimary={(m) => isFreelancer && api.setPrimaryWalletPayout(m.id).then(load)}
                  onLink={isFreelancer ? openLink : () => { setTopupProvider('khalti'); setSheet('topup'); }}
                />
              </div>
              <div className="wal-balance">
                <p className="wal-balance__eye">{isFreelancer ? 'Available to withdraw' : 'Available to pay'}</p>
                <p className="wal-balance__amt"><span>रु</span>{Number(available).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="wal-balance__sub">
                  {isFreelancer
                    ? 'Cleared job payments after the 10% OPUS service charge. Withdraw to a linked wallet when you are ready.'
                    : 'Held in OPUS until you pay an approved job. Top up with eSewa or Khalti.'}
                </p>
                <div className="wal-minis">
                  <div>
                    <strong>{fmtNPR(wallet?.pendingBalance || 0, { digits: 0 })}</strong>
                    <span>Processing</span>
                  </div>
                  <div>
                    <strong>{fmtNPR(isFreelancer ? wallet?.lifetimeEarned : (wallet?.lifetimeEarned || 0), { digits: 0 })}</strong>
                    <span>{isFreelancer ? 'Lifetime earned' : 'Lifetime added'}</span>
                  </div>
                  <div>
                    <strong>{isFreelancer ? fmtNPR(wallet?.platformFees || 0, { digits: 0 }) : fmtNPR(wallet?.lifetimeWithdrawn || 0, { digits: 0 })}</strong>
                    <span>{isFreelancer ? `OPUS fees (${Math.round((wallet?.feeRate || 0.1) * 100)}%)` : 'Paid to talent'}</span>
                  </div>
                </div>
                <div className="wal-balance__actions">
                  {isFreelancer && (
                    <>
                      <button type="button" className="opus-btn opus-btn--primary" onClick={() => openWithdraw()}>Withdraw funds</button>
                      {!methodFor('khalti') && (
                        <button type="button" className="opus-btn opus-btn--secondary" onClick={() => openLink('khalti')}>Add Khalti</button>
                      )}
                      {!methodFor('esewa') && (
                        <button type="button" className="opus-btn opus-btn--secondary" onClick={() => openLink('esewa')}>Add eSewa</button>
                      )}
                    </>
                  )}
                  {isEmployer && (
                    <>
                      <button type="button" className="opus-btn opus-btn--primary" disabled={!esewaOn} onClick={() => { setTopupProvider('esewa'); setSheet('topup'); }}>Add with eSewa</button>
                      <button type="button" className="opus-btn opus-btn--secondary" disabled={!khaltiOn} onClick={() => { setTopupProvider('khalti'); setSheet('topup'); }}>
                        {khaltiOn ? 'Add with Khalti' : 'Khalti not configured'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <div className="wal-two">
              <section className="glass-surface wal-panel">
                <header className="wal-panel__head">
                  <div>
                    <h3>Transaction ledger</h3>
                    <p>Every credit and payout, in order</p>
                  </div>
                  <div className="wal-seg wal-seg--sm">
                    {['all', 'credits', 'payouts'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={ledgerFilter === f ? 'on' : ''}
                        onClick={() => setLedgerFilter(f)}
                      >
                        {f === 'all' ? 'All' : f === 'credits' ? 'Credits' : 'Payouts'}
                      </button>
                    ))}
                  </div>
                </header>
                {ledger.length === 0 ? (
                  <p className="wal-empty">No movements yet. They will appear here when money enters or leaves this wallet.</p>
                ) : (
                  ledger.slice(0, 8).map((t) => (
                    <div key={t.id} className="wal-row">
                      <span className="wal-row__date">{fmtLedgerDate(t.occurredAt)}</span>
                      <div className="wal-row__desc">
                        <strong>{t.description}</strong>
                        <small>
                          {t.projectTitle || t.organizationName || typeLabel(t)}
                          {t.method === 'esewa' ? <em className="wal-tag wal-tag--esewa">eSewa</em> : null}
                          {t.method === 'khalti' ? <em className="wal-tag wal-tag--khalti">Khalti</em> : null}
                        </small>
                      </div>
                      <span className={`wal-pill ${t.credit > 0 ? 'wal-pill--in' : 'wal-pill--out'}`}>{typeLabel(t)}</span>
                      <span className={`wal-row__amt ${t.credit > 0 ? 'pos' : 'neg'}`}>
                        {t.credit > 0 ? '+' : '-'}{fmtNPR(t.credit || t.debit)}
                      </span>
                    </div>
                  ))
                )}
              </section>

              <div className="wal-side">
                {isFreelancer && (
                  <section className="glass-surface wal-panel">
                    <header className="wal-panel__head"><h3>Earnings by client</h3></header>
                    {(wallet?.earningsByClient || []).length === 0 ? (
                      <p className="wal-empty">No client credits yet.</p>
                    ) : (
                      wallet.earningsByClient.map((row) => (
                        <div key={row.name} className="wal-bd">
                          <span>{row.name}</span>
                          <strong>{fmtNPR(row.amount, { digits: 0 })}</strong>
                        </div>
                      ))
                    )}
                  </section>
                )}
                <section className="glass-surface wal-panel">
                  <header className="wal-panel__head"><h3>Payout settings</h3></header>
                  {isFreelancer && (
                    <div className="wal-set">
                      <div>
                        <p>Auto-withdraw</p>
                        <small>{primary ? `Send to ${primary.provider === 'esewa' ? 'eSewa' : 'Khalti'} when enabled` : 'Link a wallet first'}</small>
                      </div>
                      <Switch
                        on={!!wallet?.settings?.autoWithdraw}
                        label="Auto-withdraw"
                        onToggle={() => api.updateWalletSettings({
                          autoWithdraw: !wallet?.settings?.autoWithdraw,
                          autoWithdrawProvider: primary?.provider || '',
                        }).then(load)}
                      />
                    </div>
                  )}
                  <div className="wal-set">
                    <div>
                      <p>Email receipts</p>
                      <small>{wallet?.email ? `Via ${wallet.email}` : 'Uses your account email'}</small>
                    </div>
                    <Switch
                      on={wallet?.settings?.emailReceipts !== false}
                      label="Email receipts"
                      onToggle={() => api.updateWalletSettings({
                        emailReceipts: wallet?.settings?.emailReceipts === false,
                      }).then(load)}
                    />
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {tab === 'ledger' && (
          <section className="glass-surface wal-panel">
            <header className="wal-panel__head">
              <div>
                <h3>Full ledger</h3>
                <p>Source of truth for this OPUS wallet</p>
              </div>
              <div className="wal-seg wal-seg--sm">
                {['all', 'credits', 'payouts'].map((f) => (
                  <button key={f} type="button" className={ledgerFilter === f ? 'on' : ''} onClick={() => setLedgerFilter(f)}>
                    {f === 'all' ? 'All' : f === 'credits' ? 'Credits' : 'Payouts'}
                  </button>
                ))}
              </div>
            </header>
            {ledger.length === 0 ? (
              <p className="wal-empty">No transactions in this filter.</p>
            ) : ledger.map((t) => (
              <div key={t.id} className="wal-row">
                <span className="wal-row__date">{fmtLedgerDate(t.occurredAt)}</span>
                <div className="wal-row__desc">
                  <strong>{t.description}</strong>
                  <small>{t.transactionId}</small>
                </div>
                <span className={`wal-pill ${t.credit > 0 ? 'wal-pill--in' : 'wal-pill--out'}`}>{typeLabel(t)}</span>
                <span className={`wal-row__amt ${t.credit > 0 ? 'pos' : 'neg'}`}>
                  {t.credit > 0 ? '+' : '-'}{fmtNPR(t.credit || t.debit)}
                </span>
              </div>
            ))}
          </section>
        )}

        {tab === 'settings' && (
          <section className="glass-surface wal-panel">
            <header className="wal-panel__head">
              <div>
                <h3>Wallet settings</h3>
                <p>Linked accounts and how OPUS talks to you about money</p>
              </div>
            </header>
            {isFreelancer && (wallet?.payoutMethods || []).map((m) => (
              <div key={m.id} className="wal-set">
                <div>
                  <p>{m.provider === 'esewa' ? 'eSewa' : 'Khalti'} · {m.masked}</p>
                  <small>{m.isPrimary ? 'Primary payout' : 'Linked'}</small>
                </div>
                <div className="wal-set__actions">
                  {!m.isPrimary && (
                    <button type="button" className="opus-btn opus-btn--secondary" onClick={() => api.setPrimaryWalletPayout(m.id).then(load)}>Make primary</button>
                  )}
                  <button type="button" className="opus-btn opus-btn--secondary" onClick={() => api.unlinkWalletPayout(m.id).then(load)}>Remove</button>
                </div>
              </div>
            ))}
            {isFreelancer && (wallet?.payoutMethods || []).length === 0 && (
              <p className="wal-empty">No payout accounts yet. Link eSewa or Khalti from Overview.</p>
            )}
            {isEmployer && (
              <p className="wal-empty">
                {khaltiOn ? 'Khalti checkout is ready. ' : 'Add KHALTI_SECRET_KEY on the server to enable Khalti. '}
                eSewa {esewaOn ? 'is ready for top-ups.' : 'is not configured.'}
              </p>
            )}
          </section>
        )}
      </main>

      {sheet === 'withdraw' && (
        <Sheet title="Withdraw funds" onClose={() => setSheet(null)}>
          <div className="wal-methods">
            {['esewa', 'khalti'].map((p) => (
              <button
                key={p}
                type="button"
                className={`wal-opt ${withdrawProvider === p ? 'sel' : ''}`}
                onClick={() => setWithdrawProvider(p)}
              >
                {p === 'esewa' ? 'eSewa' : 'Khalti'}
                {!methodFor(p) ? <small>Not linked</small> : null}
              </button>
            ))}
          </div>
          <input
            className="wal-amt"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
            aria-label="Amount"
          />
          <p className="wal-hint">Max available: {fmtNPR(available)}</p>
          <div className="wal-fee"><span>Transfer fee</span><b>NPR 0.00</b></div>
          <div className="wal-fee"><span>Arrives</span><b>{wallet?.providers?.sandbox ? 'Sandbox (instant ledger)' : 'After the gateway confirms'}</b></div>
          <div className="wal-sheet__actions">
            <button type="button" className="opus-btn opus-btn--secondary" onClick={() => setSheet(null)}>Cancel</button>
            <button type="button" className="opus-btn opus-btn--primary" disabled={busy === 'withdraw' || !methodFor(withdrawProvider)} onClick={onWithdraw}>
              {busy === 'withdraw' ? 'Sending…' : 'Confirm withdrawal'}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'link' && (
        <Sheet title={`Link ${linkProvider === 'esewa' ? 'eSewa' : 'Khalti'}`} onClose={() => setSheet(null)}>
          <p className="wal-hint" style={{ marginTop: 0 }}>Use the mobile number registered on that wallet.</p>
          <input
            className="wal-phone"
            value={linkPhone}
            onChange={(e) => setLinkPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            inputMode="tel"
            aria-label="Mobile number"
          />
          <div className="wal-sheet__actions">
            <button type="button" className="opus-btn opus-btn--secondary" onClick={() => setSheet(null)}>Cancel</button>
            <button type="button" className="opus-btn opus-btn--primary" disabled={busy === 'link'} onClick={onLink}>
              {busy === 'link' ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'topup' && (
        <Sheet title="Add funds" onClose={() => setSheet(null)}>
          <div className="wal-methods">
            <button type="button" className={`wal-opt ${topupProvider === 'esewa' ? 'sel' : ''}`} onClick={() => setTopupProvider('esewa')}>eSewa</button>
            <button type="button" className={`wal-opt ${topupProvider === 'khalti' ? 'sel' : ''}`} disabled={!khaltiOn} onClick={() => setTopupProvider('khalti')}>Khalti</button>
          </div>
          <input
            className="wal-amt"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            inputMode="decimal"
            aria-label="Top up amount"
          />
          <p className="wal-hint">Minimum NPR 10. You will finish on {topupProvider === 'esewa' ? 'eSewa' : 'Khalti'}.</p>
          <div className="wal-sheet__actions">
            <button type="button" className="opus-btn opus-btn--secondary" onClick={() => setSheet(null)}>Cancel</button>
            <button type="button" className="opus-btn opus-btn--primary" disabled={busy === 'topup'} onClick={onTopup}>
              {busy === 'topup' ? 'Opening…' : 'Continue'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
