import { useMemo, type ReactNode, type CSSProperties } from 'react';
import ChartErrorBoundary from '../../components/ChartErrorBoundary';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardAnalytics.css';

export interface MonthlyWorkPoint {
  month: string;
  count: number;
}

export interface CompletionTrendPoint {
  month: string;
  count: number;
}

export interface BidStats {
  successRate: number;
  accepted: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface DashboardAnalyticsProps {
  monthlyWork: MonthlyWorkPoint[];
  completionTrend: CompletionTrendPoint[];
  bidStats: BidStats;
  loading?: boolean;
  theme?: 'dark' | 'light';
}

const CHART_ANIMATION_MS = 1000;

const TOKEN = {
  line1: '#0071e3',
  line2: '#34c759',
  gradientStart: 'rgba(0, 113, 227, 0.22)',
  gradientEnd: 'rgba(0, 113, 227, 0)',
  gradientStart2: 'rgba(52, 199, 89, 0.22)',
  gradientEnd2: 'rgba(52, 199, 89, 0)',
  textSecondary: '#6e6e73',
  textMuted: '#86868b',
  border: 'rgba(0, 0, 0, 0.06)',
  elevated: 'rgba(255, 255, 255, 0.95)',
  warning: '#ff9500',
  error: '#ff3b30',
};

function formatCount(value: number) {
  return `${value} project${value === 1 ? '' : 's'}`;
}

interface TooltipPayloadItem {
  value?: number;
  name?: string;
  payload?: { month: string };
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  valueFormatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dan-tooltip">
      <p className="dan-tooltip__label">{label ?? payload[0]?.payload?.month}</p>
      <p className="dan-tooltip__value">{valueFormatter(payload[0].value ?? 0)}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <article
      className="glass-surface glass-surface--interactive dan-card"
      style={{ '--glass-delay': `${delay}ms` } as CSSProperties}
    >
      <header className="dan-card__head">
        <h3 className="dan-card__title">{title}</h3>
        <p className="dan-card__sub">{subtitle}</p>
      </header>
      <div className="dan-card__chart">
        <ChartErrorBoundary>
          {children}
        </ChartErrorBoundary>
      </div>
    </article>
  );
}

export default function DashboardAnalytics({
  monthlyWork,
  completionTrend,
  bidStats,
  loading = false,
  theme = 'light',
}: DashboardAnalyticsProps) {
  const bidDonutData = useMemo(
    () => [
      { name: 'Accepted', value: bidStats.accepted, color: TOKEN.line2 },
      { name: 'Pending', value: bidStats.pending, color: TOKEN.warning },
      { name: 'Declined', value: bidStats.rejected, color: TOKEN.error },
    ].filter((d) => d.value > 0),
    [bidStats],
  );

  if (loading) {
    return (
      <section className="dashboard-token-scope dan" data-theme={theme} aria-label="Dashboard analytics">
        <div className="dan-loading" role="status" aria-label="Loading analytics" />
      </section>
    );
  }

  return (
    <section className="dashboard-token-scope dan" data-theme={theme} aria-label="Dashboard analytics">
      <header className="dan__section-head">
        <h2 className="glass-section-title">Charts</h2>
        <p className="glass-section-sub">Work started, deliveries, and bid performance</p>
      </header>
      <div className="dan-grid">
        <ChartCard
          title="Work started"
          subtitle="Projects that moved into your workspace"
          delay={0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyWork} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="danEarningsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKEN.gradientStart} />
                  <stop offset="100%" stopColor={TOKEN.gradientEnd} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={TOKEN.border} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: TOKEN.textMuted, fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: TOKEN.textMuted, fontSize: 12 }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={(
                  <ChartTooltip
                    valueFormatter={formatCount}
                  />
                )}
                cursor={{ stroke: TOKEN.line1, strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={TOKEN.line1}
                strokeWidth={2}
                fill="url(#danEarningsFill)"
                dot={{ r: 4, fill: TOKEN.line1, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: TOKEN.line1, stroke: TOKEN.elevated, strokeWidth: 2 }}
                isAnimationActive
                animationDuration={CHART_ANIMATION_MS}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Project Completions"
          subtitle="Projects delivered each month"
          delay={100}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={completionTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="danCompletionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOKEN.gradientStart2} />
                  <stop offset="100%" stopColor={TOKEN.gradientEnd2} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={TOKEN.border} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: TOKEN.textMuted, fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: TOKEN.textMuted, fontSize: 12 }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={(
                  <ChartTooltip
                    valueFormatter={(v) => `${v} project${v === 1 ? '' : 's'}`}
                  />
                )}
                cursor={{ stroke: TOKEN.line2, strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={TOKEN.line2}
                strokeWidth={2}
                fill="url(#danCompletionFill)"
                dot={{ r: 4, fill: TOKEN.line2, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: TOKEN.line2, stroke: TOKEN.elevated, strokeWidth: 2 }}
                isAnimationActive
                animationDuration={CHART_ANIMATION_MS}
                animationBegin={100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Bid Acceptance Rate"
          subtitle="How often your proposals win"
          delay={200}
        >
          <div className="dan-donut-wrap">
            <div className="dan-donut-chart">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={bidDonutData.length ? bidDonutData : [{ name: 'Empty', value: 1, color: TOKEN.textMuted }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive
                    animationDuration={CHART_ANIMATION_MS}
                    animationBegin={200}
                    animationEasing="ease-out"
                  >
                    {(bidDonutData.length ? bidDonutData : [{ name: 'Empty', value: 1, color: TOKEN.textMuted }]).map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0];
                      return (
                        <div className="dan-tooltip">
                          <p className="dan-tooltip__label">{item.name}</p>
                          <p className="dan-tooltip__value">{item.value} bids</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="dan-donut-center" aria-hidden="true">
                <strong>{bidStats.successRate}%</strong>
                <span>success</span>
              </div>
            </div>
            <ul className="dan-legend">
              <li><span className="dan-legend__dot dan-legend__dot--accepted" />Accepted · {bidStats.accepted}</li>
              <li><span className="dan-legend__dot dan-legend__dot--pending" />Pending · {bidStats.pending}</li>
              <li><span className="dan-legend__dot dan-legend__dot--declined" />Declined · {bidStats.rejected}</li>
            </ul>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}
