import DashboardHome from './DashboardHome';
import './Dashboard.css';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './dashboard-theme.css';

export default function Dashboard() {
  return (
    <div className="db-page db-page--single">
      <div className="db-ambient" aria-hidden="true">
        <div className="db-ambient__blob db-ambient__blob--1" />
        <div className="db-ambient__blob db-ambient__blob--2" />
        <div className="db-ambient__blob db-ambient__blob--3" />
      </div>

      <main className="db-single-main">
        <DashboardHome />
      </main>
    </div>
  );
}
