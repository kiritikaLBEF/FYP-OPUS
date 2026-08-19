import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout/AdminLayout.css';

function MetricCard({ label, value, hint }) {
  return (
    <div className="admin-stat admin-stat--glass">
      <div className="admin-stat__label">{label}</div>
      <div className="admin-stat__value">{value}</div>
      {hint && <div className="admin-muted" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isSuper = user?.adminTier === 'super_admin';

  useEffect(() => {
    if (!isSuper) return;
    Promise.all([
      api.getAdminAnalytics(),
      api.getAdminAuditLogs().catch(() => ({ logs: [] })),
    ])
      .then(([analytics, audit]) => {
        setData(analytics);
        setLogs(audit.logs || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load analytics');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [isSuper]);

  if (!isSuper) {
    return <Navigate to="/admin/overview" replace />;
  }

  const ops = data?.operations;

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-subtitle">Super Admin: financial overview and platform metrics</p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-status-board">
        <MetricCard label="Active freelancers" value={loading ? '-' : ops?.activeUsers ?? 0} />
        <MetricCard label="Active employers" value={loading ? '-' : ops?.activeEmployers ?? 0} />
        <MetricCard label="Verification queue" value={loading ? '-' : ops?.verificationQueueSize ?? 0} />
        <MetricCard label="Active gigs" value={loading ? '-' : ops?.activeGigs ?? 0} />
        <MetricCard label="Completion rate" value={loading ? '-' : `${ops?.completionRate ?? 0}%`} />
        <MetricCard label="Flagged users" value={loading ? '-' : ops?.flaggedUsers ?? 0} />
        <MetricCard label="Flags (30 days)" value={loading ? '-' : ops?.flagTrend30d ?? 0} />
        <MetricCard label="Job post removals" value={loading ? '-' : ops?.jobPostRemovals ?? 0} />
      </div>

      {data?.financial && (
        <div className="admin-panel" style={{ marginBottom: 16 }}>
          <div className="admin-panel__head">Financial overview</div>
          <div className="admin-panel__body admin-status-board" style={{ marginBottom: 0, padding: '16px' }}>
            <MetricCard label="Transaction volume" value={`NPR ${data.financial.totalTransactionVolume?.toLocaleString() ?? 0}`} />
            <MetricCard label="Platform revenue" value={`NPR ${data.financial.platformRevenue?.toLocaleString() ?? 0}`} />
            <MetricCard label="Payout totals" value={`NPR ${data.financial.payoutTotals?.toLocaleString() ?? 0}`} />
          </div>
        </div>
      )}

      <div className="admin-panel">
        <div className="admin-panel__head">Recent audit log</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="admin-muted">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="admin-muted">No audit entries yet.</td></tr>
              ) : (
                logs.slice(0, 25).map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.occurredAt).toLocaleString()}</td>
                    <td>{log.adminName || log.adminEmail}</td>
                    <td className="admin-mono">{log.action}</td>
                    <td>{log.summary || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
