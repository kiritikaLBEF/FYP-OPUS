import { type CSSProperties } from 'react';
import { fmtDate, fmtNPR } from './dashboardUtils';
import DashboardPagination from './DashboardPagination';
import './DashboardPagination.css';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardRecentTransactions.css';

export interface TransactionItem {
  _id?: string;
  transactionId: string;
  occurredAt: string | Date;
  description: string;
  organizationRef?: string;
  organizationName?: string;
  projectRef?: string;
  projectTitle?: string;
  paymentType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentStatus: string;
  transactionStatus?: string;
}

export interface DashboardRecentTransactionsProps {
  transactions: TransactionItem[];
  loading?: boolean;
  total?: number;
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
  onViewAll?: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  milestone: 'Milestone',
  withdrawal: 'Withdrawal',
  platform_fee: 'Platform fee',
  refund: 'Refund',
  bonus: 'Bonus',
  adjustment: 'Adjustment',
};

export default function DashboardRecentTransactions({
  transactions,
  loading = false,
  total = 0,
  page = 1,
  pages = 1,
  onPageChange,
  onViewAll,
}: DashboardRecentTransactionsProps) {
  return (
    <section className="glass-surface drt" aria-label="Recent transactions" style={{ '--glass-delay': '480ms' } as CSSProperties}>
      <header className="drt__head">
        <div>
          <h2 className="drt__title">Transactions</h2>
          <p className="drt__sub">
            {total > 0
              ? `${total} transaction${total === 1 ? '' : 's'}`
              : 'Your latest financial activity'}
          </p>
        </div>
        {onViewAll && total > 0 && (
          <button type="button" className="drt__view-all" onClick={onViewAll}>
            View all
          </button>
        )}
      </header>

      {loading ? (
        <div className="drt-loading" role="status" aria-label="Loading transactions" />
      ) : transactions.length === 0 ? (
        <div className="drt-empty">
          <p className="drt-empty__title">No transactions yet</p>
          <p className="drt-empty__sub">Payments and withdrawals will appear here once recorded.</p>
        </div>
      ) : (
        <div className="drt-list" role="list">
          {transactions.map((txn, index) => (
            <article
              key={txn.transactionId}
              className="drt-item"
              role="listitem"
              style={{ '--drt-delay': `${index * 60}ms` } as CSSProperties}
            >
              <div className="drt-item__main">
                <div className="drt-item__top">
                  <time className="drt-item__date" dateTime={new Date(txn.occurredAt).toISOString()}>
                    {fmtDate(txn.occurredAt)}
                  </time>
                  <span className="drt-item__id">{txn.transactionId}</span>
                </div>
                <p className="drt-item__desc">{txn.description}</p>
                {(txn.projectTitle || txn.organizationName) && (
                  <p className="drt-item__meta">
                    {txn.projectTitle && <span>{txn.projectTitle}</span>}
                    {txn.organizationName && (
                      <span>{txn.projectTitle ? ' · ' : ''}{txn.organizationName}</span>
                    )}
                  </p>
                )}
                <div className="drt-item__tags">
                  <span className="drt-tag">{PAYMENT_LABELS[txn.paymentType] || txn.paymentType}</span>
                  <span className={`drt-pill drt-pill--${txn.paymentStatus}`}>{txn.paymentStatus}</span>
                </div>
              </div>
              <div className="drt-item__amounts">
                {txn.credit > 0 && (
                  <span className="drt-amount drt-amount--credit">+{fmtNPR(txn.credit)}</span>
                )}
                {txn.debit > 0 && (
                  <span className="drt-amount drt-amount--debit">−{fmtNPR(txn.debit)}</span>
                )}
                <span className="drt-item__balance">Bal. {fmtNPR(txn.runningBalance)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && pages > 1 && onPageChange && (
        <DashboardPagination
          page={page}
          pages={pages}
          onPageChange={onPageChange}
          label="Transaction pages"
        />
      )}
    </section>
  );
}
