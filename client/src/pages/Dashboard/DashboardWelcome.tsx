import { type CSSProperties } from 'react';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardWelcome.css';

interface DashboardWelcomeProps {
  userName: string;
  greeting?: string;
  subtitle?: string;
}

export default function DashboardWelcome({
  userName,
  greeting = 'Welcome back',
  subtitle = 'Your freelance workspace for projects and analytics.',
}: DashboardWelcomeProps) {
  return (
    <section
      className="glass-surface dwelcome"
      style={{ '--glass-delay': '0ms' } as CSSProperties}
      aria-label="Welcome"
    >
      <div className="dwelcome__body">
        <div className="dwelcome__content">
          <p className="dwelcome__label">Dashboard</p>
          <h1 className="dwelcome__title">{greeting}, {userName}</h1>
          <p className="dwelcome__sub">
            {subtitle}
          </p>
        </div>
        <div className="dwelcome__orb" aria-hidden="true" />
      </div>
    </section>
  );
}
