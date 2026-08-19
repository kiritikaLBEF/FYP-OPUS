import { useCallback, useEffect, useState } from 'react';
import { api, getEmployerEStatementPdfUrl } from '../../services/api';
import '../../components/Layout/EmployerLayout.css';

const DATE_PRESETS = [
  { value: '', label: 'All time' },
  { value: 'current_month', label: 'Current month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'current_year', label: 'Current year' },
];

const fmtMoney = (n) => `NPR ${Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function EmployerDashboard() {
  const [greeting, setGreeting] = useState('Welcome');
  const [orgName, setOrgName] = useState('');
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(true);
  const [preset, setPreset] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    api.getEmployerOverview()
      .then((data) => {
        setGreeting(data.greeting || 'Welcome');
        setOrgName(data.user?.organizationName || '');
        setStats(data.stats || null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const loadTransactions = useCallback(async (p, filterPreset) => {
    setTxnLoading(true);
    try {
      const data = await api.getEmployerTransactions({ page: p, limit: 10, preset: filterPreset });
      setTransactions(data.transactions || []);
      setPages(data.pages || 1);
      setPage(data.page || p);
    } catch {
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(1, preset);
  }, [loadTransactions, preset]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('opus_token');
      const url = getEmployerEStatementPdfUrl({ preset: preset || 'last_3_months' });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `opus-estatement.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* ignore */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <header className="emp-page-header">
        <h1>Dashboard</h1>
        <p>{greeting}, {orgName || 'Organization'} · wallet, spending & e-statement</p>
      </header>

      <div className="emp-stats">
        <div className="emp-stat">
          <div className="emp-stat__label">Wallet balance</div>
          <div className="emp-stat__value">{loading ? '-' : fmtMoney(stats?.walletBalance ?? 0)}</div>
        </div>
        <div className="emp-stat">
          <div className="emp-stat__label">Total spent</div>
          <div className="emp-stat__value">{loading ? '-' : fmtMoney(stats?.totalSpent ?? 0)}</div>
        </div>
        <div className="emp-stat">
          <div className="emp-stat__label">Jobs posted</div>
          <div className="emp-stat__value">{loading ? '-' : (stats?.jobsPosted ?? 0)}</div>
        </div>
        <div className="emp-stat">
          <div className="emp-stat__label">Open market jobs</div>
          <div className="emp-stat__value">{loading ? '-' : (stats?.openMarketJobs ?? 0)}</div>
        </div>
      </div>

      <div className="emp-card">
        <div className="emp-filter-bar">
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, flex: 1 }}>Transactions</h2>
          <select value={preset} onChange={(e) => { setPreset(e.target.value); setPage(1); }}>
            {DATE_PRESETS.map((p) => (
              <option key={p.value || 'all'} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button type="button" className="emp-btn emp-btn--primary" onClick={downloadPdf} disabled={downloading}>
            {downloading ? 'Generating…' : 'Download e-statement'}
          </button>
        </div>

        {txnLoading ? (
          <div className="emp-empty">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="emp-empty">No transactions in this period.</div>
        ) : (
          <>
            <div className="emp-table-wrap">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{fmtDateTime(t.occurredAt)}</td>
                      <td>{t.description}</td>
                      <td>{t.debit ? fmtMoney(t.debit) : '-'}</td>
                      <td>{t.credit ? fmtMoney(t.credit) : '-'}</td>
                      <td>{fmtMoney(t.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="emp-filter-bar" style={{ marginTop: 12 }}>
                <button type="button" className="emp-btn emp-btn--ghost" disabled={page <= 1} onClick={() => loadTransactions(page - 1, preset)}>Previous</button>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Page {page} of {pages}</span>
                <button type="button" className="emp-btn emp-btn--ghost" disabled={page >= pages} onClick={() => loadTransactions(page + 1, preset)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
