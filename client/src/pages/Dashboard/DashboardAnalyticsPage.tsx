import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import DashboardAnalytics from './DashboardAnalytics';
import './dashboard-tokens.css';
import './DashboardHome.css';

export default function DashboardAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [monthlyEarnings, setMonthlyEarnings] = useState([]);
  const [completionTrend, setCompletionTrend] = useState([]);
  const [bidStats, setBidStats] = useState({
    successRate: 0,
    accepted: 0,
    pending: 0,
    rejected: 0,
    total: 0,
  });

  useEffect(() => {
    api.getDashboardAnalytics()
      .then((data) => {
        setMonthlyEarnings(data.monthlyEarnings || []);
        setCompletionTrend(data.completionTrend || []);
        setBidStats({
          successRate: data.bidStats?.successRate ?? 0,
          accepted: data.bidStats?.accepted ?? 0,
          pending: data.bidStats?.pending ?? 0,
          rejected: data.bidStats?.rejected ?? 0,
          total: data.bidStats?.total ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard-token-scope dash-home dash-home--solo">
      <DashboardAnalytics
        monthlyEarnings={monthlyEarnings}
        completionTrend={completionTrend}
        bidStats={bidStats}
        loading={loading}
        theme="light"
      />
    </div>
  );
}
