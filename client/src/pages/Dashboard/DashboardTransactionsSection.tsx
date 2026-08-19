import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api, getEStatementPdfUrl } from '../../services/api';
import DashboardRecentTransactions, { type TransactionItem } from './DashboardRecentTransactions';
import { HOME_PAGE_SIZE } from './DashboardPagination';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardTransactionsSection.css';

const DATE_PRESETS = [
  { value: '', label: 'All time' },
  { value: 'current_month', label: 'Current month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'current_year', label: 'Current year' },
  { value: 'custom', label: 'Custom range' },
];

interface DashboardTransactionsSectionProps {
  freelancerId: string;
}

export default function DashboardTransactionsSection({ freelancerId }: DashboardTransactionsSectionProps) {
  const [preset, setPreset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedPreset, setAppliedPreset] = useState('');

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const loadTransactions = useCallback(async (activePage: number, filterPreset: string, filterFrom: string, filterTo: string) => {
    setLoading(true);
    try {
      const data = await api.getTransactions({
        sort: 'date_desc',
        page: activePage,
        limit: HOME_PAGE_SIZE,
        preset: filterPreset,
        from: filterFrom,
        to: filterTo,
      });
      setTransactions(data.transactions || []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setPage(data.page ?? activePage);
    } catch {
      setTransactions([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(1, appliedPreset, appliedFrom, appliedTo);
  }, [loadTransactions, appliedPreset, appliedFrom, appliedTo]);

  const applyFilter = () => {
    setAppliedPreset(preset);
    setAppliedFrom(preset === 'custom' ? from : '');
    setAppliedTo(preset === 'custom' ? to : '');
    setPage(1);
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== 'custom') {
      setAppliedPreset(value);
      setAppliedFrom('');
      setAppliedTo('');
      setPage(1);
    }
  };

  const handlePage = (n: number) => {
    setPage(n);
    loadTransactions(n, appliedPreset, appliedFrom, appliedTo);
  };

  const downloadEStatement = async () => {
    setDownloading(true);
    try {
      const estPreset = appliedPreset || 'last_3_months';
      const url = getEStatementPdfUrl({
        preset: estPreset,
        from: appliedFrom,
        to: appliedTo,
      });
      const token = localStorage.getItem('opus_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `OPUS-E-Statement-${freelancerId || 'account'}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* silent */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="dts" style={{ '--glass-delay': '460ms' } as CSSProperties}>
      <header className="dts__head">
        <h2 className="glass-section-title">Transactions</h2>
        <p className="glass-section-sub">Filter by date or download your e-statement</p>
      </header>
      <div className="glass-surface dts-toolbar">
        <div className="dts-toolbar__filters">
          <label className="dts-label">
            <span className="dts-label__text">Filter by date</span>
            <select
              className="dts-select"
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value || 'all'} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="dts-label">
                <span className="dts-label__text">From</span>
                <input
                  type="date"
                  className="dts-select"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="dts-label">
                <span className="dts-label__text">To</span>
                <input
                  type="date"
                  className="dts-select"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button type="button" className="dts-btn dts-btn--ghost" onClick={applyFilter}>
                Apply
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className="dts-btn dts-btn--primary"
          onClick={downloadEStatement}
          disabled={downloading}
        >
          {downloading ? 'Downloading…' : 'Download E-Statement'}
        </button>
      </div>

      <DashboardRecentTransactions
        transactions={transactions}
        total={total}
        page={page}
        pages={pages}
        loading={loading}
        onPageChange={handlePage}
      />
    </div>
  );
}
