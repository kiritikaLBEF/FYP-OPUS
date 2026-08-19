import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getEStatementPdfUrl, getProfileUrl } from '../../services/api';
import { fmtNPR, fmtDate, STATUS_LABELS } from './dashboardUtils';
import {
  WelcomeHero,
  MetricCard,
  ProgressRing,
  SparkAreaChart,
  AnimatedBarChart,
  ActivityTimeline,
  AchievementStrip,
  InsightCards,
  CategoryDonut,
  MetricIcons,
} from './CreatorUI';

function StatCard({ label, value, sub, accent }) {
  return (
    <article className={`db-stat ${accent ? 'db-stat--accent' : ''}`}>
      <p className="db-stat__label">{label}</p>
      <p className="db-stat__value">{value}</p>
      {sub && <p className="db-stat__sub">{sub}</p>}
    </article>
  );
}

function BarChart({ data, valueKey = 'amount', labelKey = 'month' }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="db-chart">
      {data.map((d) => (
        <div key={d[labelKey]} className="db-chart__col">
          <div className="db-chart__bar-wrap">
            <div className="db-chart__bar" style={{ height: `${(d[valueKey] / max) * 100}%` }} title={fmtNPR(d[valueKey])} />
          </div>
          <span className="db-chart__label">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ title, desc }) {
  return <div className="db-empty"><p className="db-empty__title">{title}</p>{desc && <p className="db-empty__desc">{desc}</p>}</div>;
}

export function PanelHeader({ title, subtitle, icon: Icon }) {
  return (
    <header className="db-panel__head">
      <div className="db-panel__head-inner">
        {Icon && <span className="db-panel__head-icon"><Icon /></span>}
        <div>
          <h2 className="db-panel__title">{title}</h2>
          {subtitle && <p className="db-panel__sub">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function OverviewPanel({ freelancerId, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getDashboardOverview().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="db-panel__body db-panel__body--creator"><div className="db-loading" /></div>;
  if (!data) return <div className="db-panel__body"><Empty title="Unable to load overview" /></div>;

  const s = data.stats;
  const heroStats = {
    ...s,
    performanceThisMonth: data.performance?.thisMonth,
    earningsGrowthPct: data.performance?.changePct,
  };

  const handleInsight = (action) => {
    if (action === 'edit_profile') navigate('/profile/edit');
    else if (action) onNavigate?.(action);
  };

  return (
    <div className="db-panel__body db-panel__body--creator">
      <WelcomeHero
        greeting={data.greeting}
        user={data.user}
        profileUrl={getProfileUrl(data.user?.profilePicture)}
        stats={heroStats}
        freelancerId={freelancerId || data.freelancerId}
      />

      <InsightCards insights={data.insights} onAction={handleInsight} />

      <div className="db-metric-grid">
        <MetricCard label="Total Earnings" value={fmtNPR(s.totalEarnings)} variant="gradient" icon={MetricIcons.earnings} trend={data.performance?.changePct} delay={0} />
        <MetricCard label="Available Balance" value={fmtNPR(s.walletBalance)} icon={MetricIcons.wallet} delay={50} />
        <MetricCard label="Completed" value={s.completedProjects} sub="projects delivered" icon={MetricIcons.projects} delay={100} />
        <MetricCard label="Active" value={s.activeProjects} sub="in progress now" icon={MetricIcons.active} delay={150} />
        <MetricCard label="Accepted" value={s.acceptedProjects} sub="ongoing engagements" variant="soft" delay={200} />
        <MetricCard label="Bids Won" value={s.bidsWon} sub={`${s.bidSuccessRate}% acceptance`} icon={MetricIcons.bids} delay={250} />
        <MetricCard label="Organizations" value={s.organizationsWorkedWith} sub="clients worked with" icon={MetricIcons.orgs} delay={300} />
        <MetricCard label="Avg. Rating" value={`${s.averageRating} ★`} icon={MetricIcons.rating} delay={350} />
      </div>

      <div className="db-creator-split">
        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Earnings Trend</h3>
              <p className="db-glass-card__sub">Your growth over recent months</p>
            </div>
            <button type="button" className="db-link-btn" onClick={() => onNavigate?.('analytics')}>View analytics →</button>
          </div>
          {data.earningsTrend?.length > 0 ? (
            <SparkAreaChart data={data.earningsTrend} />
          ) : (
            <Empty title="No earnings data yet" desc="Complete projects to see your trend." />
          )}
        </section>

        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Profile Strength</h3>
              <p className="db-glass-card__sub">Stronger profiles get more views</p>
            </div>
            <Link to="/profile/edit" className="db-link-btn">Improve →</Link>
          </div>
          <div className="db-strength-row">
            <ProgressRing value={s.profileCompletion} label="Complete" />
            <div className="db-strength-tips">
              <p>{s.profileCompletion >= 80 ? 'Your profile looks great!' : 'Add certifications and portfolio work to boost visibility.'}</p>
              <div className="db-strength-bar">
                <div style={{ width: `${s.profileCompletion}%` }} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Achievements</h3>
            <p className="db-glass-card__sub">Milestones on your creator journey</p>
          </div>
        </div>
        <AchievementStrip achievements={data.achievements} />
      </section>

      {data.spotlightProjects?.length > 0 && (
        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Active Projects</h3>
              <p className="db-glass-card__sub">Work that needs your attention</p>
            </div>
            <button type="button" className="db-link-btn" onClick={() => onNavigate?.('projects')}>View all →</button>
          </div>
          <div className="db-spotlight">
            {data.spotlightProjects.map((p) => (
              <article key={p._id} className="db-spotlight__card">
                <span className={`db-status db-status--${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span>
                <h4>{p.title}</h4>
                <p>{p.organizationName}</p>
                <strong>{fmtNPR(p.paymentAmount)}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Recent Activity</h3>
            <p className="db-glass-card__sub">Everything happening in your workspace</p>
          </div>
        </div>
        {data.activityFeed?.length > 0 ? (
          <ActivityTimeline items={data.activityFeed} />
        ) : (
          <Empty title="No activity yet" desc="Your journey updates will appear here." />
        )}
      </section>
    </div>
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6m');

  useEffect(() => {
    api.getDashboardAnalytics().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="db-panel__body db-panel__body--creator"><div className="db-loading" /></div>;
  if (!data) return <div className="db-panel__body"><Empty title="Unable to load analytics" /></div>;

  const maxProj = Math.max(...data.projectStats.map((x) => x.count), 1);
  const earningsSlice = period === '3m' ? data.monthlyEarnings.slice(-3) : data.monthlyEarnings.slice(-6);

  return (
    <div className="db-panel__body db-panel__body--creator">
      <div className="db-analytics-hero">
        <div className="db-analytics-hero__card">
          <span>This month</span>
          <strong>{fmtNPR(data.earningsComparison?.thisMonth)}</strong>
          <span className={`db-trend ${data.earningsComparison?.changePct >= 0 ? 'db-trend--up' : 'db-trend--down'}`}>
            {data.earningsComparison?.changePct >= 0 ? '↑' : '↓'} {Math.abs(data.earningsComparison?.changePct || 0)}% vs last month
          </span>
        </div>
        <div className="db-analytics-hero__card">
          <span>Last month</span>
          <strong>{fmtNPR(data.earningsComparison?.lastMonth)}</strong>
        </div>
        <div className="db-analytics-hero__card db-analytics-hero__card--accent">
          <span>Bid success</span>
          <strong>{data.bidStats.successRate}%</strong>
          <span className="db-analytics-hero__meta">{data.bidStats.accepted} of {data.bidStats.total} won</span>
        </div>
        <div className="db-analytics-hero__card">
          <span>Completion rate</span>
          <strong>{data.productivity?.completionRate}%</strong>
        </div>
      </div>

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Monthly Earnings Growth</h3>
            <p className="db-glass-card__sub">Track how your income evolves over time</p>
          </div>
          <div className="db-period-toggle">
            <button type="button" className={period === '3m' ? 'active' : ''} onClick={() => setPeriod('3m')}>3M</button>
            <button type="button" className={period === '6m' ? 'active' : ''} onClick={() => setPeriod('6m')}>6M</button>
          </div>
        </div>
        <AnimatedBarChart data={earningsSlice.length ? earningsSlice : [{ month: '-', amount: 0 }]} />
      </section>

      <div className="db-creator-split">
        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Project Completions</h3>
              <p className="db-glass-card__sub">Delivery momentum over time</p>
            </div>
          </div>
          {data.completionTrend?.length > 0 ? (
            <AnimatedBarChart data={data.completionTrend.map((d) => ({ month: d.month, amount: d.count }))} valueKey="amount" />
          ) : (
            <Empty title="No completions yet" />
          )}
        </section>

        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Bid Acceptance</h3>
              <p className="db-glass-card__sub">How often your proposals win</p>
            </div>
          </div>
          <div className="db-donut-wrap db-donut-wrap--lg">
            <div className="db-donut db-donut--lg" style={{ '--pct': data.bidStats.successRate }}>
              <span>{data.bidStats.successRate}%</span>
            </div>
            <ul className="db-legend">
              <li><span className="db-dot db-dot--green" /> Accepted: {data.bidStats.accepted}</li>
              <li><span className="db-dot db-dot--orange" /> Pending: {data.bidStats.pending}</li>
              <li><span className="db-dot db-dot--red" /> Declined: {data.bidStats.rejected}</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="db-creator-split">
        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Earnings by Category</h3>
              <p className="db-glass-card__sub">Where your expertise pays most</p>
            </div>
          </div>
          {data.earningsByCategory?.length > 0 ? (
            <CategoryDonut data={data.earningsByCategory} />
          ) : <Empty title="No category data" />}
        </section>

        <section className="db-glass-card">
          <div className="db-glass-card__head">
            <div>
              <h3 className="db-glass-card__title">Client Engagement</h3>
              <p className="db-glass-card__sub">Visibility and interaction metrics</p>
            </div>
          </div>
          <div className="db-engagement-grid">
            {[
              ['Profile views', data.engagement?.profileViews],
              ['Portfolio views', data.engagement?.portfolioViews],
              ['Invitations', data.engagement?.invitations],
              ['Reviews', data.engagement?.reviews],
            ].map(([label, val]) => (
              <div key={label} className="db-engagement-item">
                <strong>{val}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Productivity Insights</h3>
            <p className="db-glass-card__sub">Key performance indicators at a glance</p>
          </div>
        </div>
        <div className="db-productivity-grid">
          <div className="db-productivity-item">
            <strong>{fmtNPR(data.productivity?.avgProjectValue)}</strong>
            <span>Avg. project value</span>
          </div>
          <div className="db-productivity-item">
            <strong>{data.productivity?.activeEngagements}</strong>
            <span>Active engagements</span>
          </div>
          <div className="db-productivity-item">
            <strong>{data.productivity?.clientRetention}%</strong>
            <span>Repeat clients</span>
          </div>
        </div>
      </section>

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Projects by Status</h3>
            <p className="db-glass-card__sub">Current workload distribution</p>
          </div>
        </div>
        <div className="db-status-bars">
          {data.projectStats.map((p) => (
            <div key={p.status} className="db-status-row">
              <span>{STATUS_LABELS[p.status] || p.status}</span>
              <div className="db-status-row__track"><div style={{ width: `${(p.count / maxProj) * 100}%` }} /></div>
              <span>{p.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="db-glass-card">
        <div className="db-glass-card__head">
          <div>
            <h3 className="db-glass-card__title">Top Organizations</h3>
            <p className="db-glass-card__sub">Your most valuable client relationships</p>
          </div>
        </div>
        <div className="db-org-list">
          {data.orgActivity.map((o, i) => (
            <div key={o._id} className="db-org-item" style={{ '--i': i }}>
              <div className="db-org-item__rank">{i + 1}</div>
              <div className="db-org-item__info">
                <strong>{o._id}</strong>
                <span>{o.projects} project{o.projects > 1 ? 's' : ''}</span>
              </div>
              <strong className="db-org-item__amount">{fmtNPR(o.earnings)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function EarningsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardEarnings().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="db-panel__body"><div className="db-loading" /></div>;
  const w = data?.wallet;

  return (
    <div className="db-panel__body">
      <div className="db-stat-grid db-stat-grid--3">
        <StatCard label="Total Earnings" value={fmtNPR(w?.totalEarnings)} accent />
        <StatCard label="Available Balance" value={fmtNPR(w?.availableBalance)} />
        <StatCard label="Pending Payments" value={fmtNPR(w?.pendingPayments)} />
        <StatCard label="Withdrawn" value={fmtNPR(w?.withdrawnAmount)} />
        <StatCard label="Platform Fees" value={fmtNPR(w?.platformFees)} />
        <StatCard label="Net Earnings" value={fmtNPR(w?.netEarnings)} />
      </div>
      <section className="db-section">
        <h3 className="db-section__title">Monthly Breakdown</h3>
        {data?.monthlyBreakdown?.length ? (
          <BarChart data={data.monthlyBreakdown.map((m) => ({ month: `${m._id.m}/${m._id.y}`, amount: m.total }))} />
        ) : <Empty title="No earnings data yet" />}
      </section>
    </div>
  );
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAcceptedProjects().then((d) => setProjects(d.projects || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="db-panel__body"><div className="db-loading" /></div>;

  return (
    <div className="db-panel__body">
      {projects.length === 0 ? (
        <Empty title="No active accepted projects" desc="When your bids are accepted, they'll appear here." />
      ) : (
        <div className="db-project-grid">
          {projects.map((p) => (
            <article key={p._id} className="db-project-card">
              <div className="db-project-card__top">
                <span className={`db-status db-status--${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span>
                <span className="db-project-card__amount">{fmtNPR(p.paymentAmount)}</span>
              </div>
              <h3>{p.title}</h3>
              <p className="db-project-card__org">{p.organizationName}</p>
              <dl className="db-project-card__meta">
                <div><dt>Project ID</dt><dd>{p.projectRef}</dd></div>
                <div><dt>Org Ref</dt><dd>{p.organizationRef}</dd></div>
                <div><dt>Started</dt><dd>{p.startDate ? fmtDate(p.startDate).split(',')[0] : '-'}</dd></div>
                <div><dt>Expected</dt><dd>{p.expectedCompletionDate ? fmtDate(p.expectedCompletionDate).split(',')[0] : '-'}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function TransactionsPanel() {
  const [data, setData] = useState({ transactions: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getTransactions({ search, sort, page }).then(setData).finally(() => setLoading(false));
  }, [search, sort, page]);

  return (
    <div className="db-panel__body db-panel__body--flush">
      <div className="db-toolbar">
        <input className="db-search" placeholder="Search transactions…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="db-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Highest credit</option>
          <option value="amount_asc">Lowest credit</option>
        </select>
      </div>
      {loading ? <div className="db-loading db-loading--pad" /> : (
        <>
          <div className="db-table-wrap db-table-wrap--scroll">
            <table className="db-table db-table--transactions">
              <thead>
                <tr>
                  <th>Date & Time</th><th>Txn ID</th><th>Description</th><th>Org Ref</th>
                  <th>Project</th><th>Type</th><th>Dr.</th><th>Cr.</th><th>Balance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.transactionId}>
                    <td>{fmtDate(t.occurredAt)}</td>
                    <td className="db-mono">{t.transactionId}</td>
                    <td className="db-desc">{t.description}</td>
                    <td className="db-mono">{t.organizationRef || '-'}</td>
                    <td>{t.projectTitle || '-'}</td>
                    <td>{t.paymentType}</td>
                    <td className="db-amount--debit">{t.debit ? fmtNPR(t.debit) : '-'}</td>
                    <td className="db-amount--credit">{t.credit ? fmtNPR(t.credit) : '-'}</td>
                    <td>{fmtNPR(t.runningBalance)}</td>
                    <td><span className={`db-pill db-pill--${t.paymentStatus}`}>{t.paymentStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="db-pagination">
              <button type="button" className="mac-btn mac-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {data.pages}</span>
              <button type="button" className="mac-btn mac-btn--ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const EST_PRESETS = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'current_year', label: 'Current Year' },
  { value: 'previous_year', label: 'Previous Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function EStatementPanel({ freelancerId }) {
  const [preset, setPreset] = useState('last_3_months');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.getEStatement({ preset, from, to }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [preset]);

  return (
    <div className="db-panel__body db-estatement" id="estatement-print">
      <div className="db-toolbar db-toolbar--wrap">
        <select className="db-select" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {EST_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" className="db-select" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="db-select" value={to} onChange={(e) => setTo(e.target.value)} />
            <button type="button" className="mac-btn mac-btn--ghost" onClick={load}>Apply</button>
          </>
        )}
        <div className="db-toolbar__actions">
          <button type="button" className="mac-btn mac-btn--ghost" onClick={() => window.print()}>Print</button>
          <button type="button" className="mac-btn mac-btn--filled" onClick={() => {
            const url = getEStatementPdfUrl({ preset, from, to });
            const token = localStorage.getItem('opus_token');
            fetch(url, { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.blob())
              .then((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `OPUS-E-Statement-${freelancerId}.pdf`;
                a.click();
              });
          }}>Download PDF</button>
        </div>
      </div>

      {loading ? <div className="db-loading db-loading--pad" /> : data && (
        <>
          <div className="db-est-header">
            <div>
              <p className="db-est-header__brand">OPUS</p>
              <h3>Account E-Statement</h3>
              <p className="db-est-header__period">{data.period.label}</p>
            </div>
            <div className="db-est-header__account">
              <p><strong>{data.user.firstName} {data.user.lastName}</strong></p>
              <p>{data.user.email}</p>
              <p className="db-mono">{freelancerId}</p>
            </div>
          </div>
          <div className="db-est-summary">
            {[['Opening', data.summary.openingBalance], ['Credits', data.summary.totalCredits], ['Debits', data.summary.totalDebits], ['Closing', data.summary.closingBalance], ['Available', data.summary.availableBalance]].map(([l, v]) => (
              <div key={l} className="db-est-summary__item"><span>{l}</span><strong>{fmtNPR(v)}</strong></div>
            ))}
          </div>
          <div className="db-table-wrap">
            <table className="db-table db-table--estatement">
              <thead>
                <tr><th>Date & Time</th><th>Txn ID</th><th>Description</th><th>Org Ref</th><th>Proj Ref</th><th>Project</th><th>Dr.</th><th>Cr.</th><th>Balance</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((t, i) => (
                  <tr key={t.transactionId} className={i % 2 ? 'db-row--alt' : ''}>
                    <td>{fmtDate(t.occurredAt)}</td>
                    <td className="db-mono">{t.transactionId}</td>
                    <td className="db-desc">{t.description}</td>
                    <td className="db-mono">{t.organizationRef || '-'}</td>
                    <td className="db-mono">{t.projectRef || '-'}</td>
                    <td>{t.projectTitle || '-'}</td>
                    <td>{t.debit ? fmtNPR(t.debit) : '-'}</td>
                    <td>{t.credit ? fmtNPR(t.credit) : '-'}</td>
                    <td>{fmtNPR(t.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
