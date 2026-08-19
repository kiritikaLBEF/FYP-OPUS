import { useEffect, useState } from 'react';
import { consumeWelcome } from '../../utils/welcome';
import './WelcomeOverlay.css';

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => {
      if (consumeWelcome()) setVisible(true);
    };
    show();
    window.addEventListener('opus-welcome', show);
    return () => window.removeEventListener('opus-welcome', show);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="opus-welcome-overlay" role="status" aria-live="polite">
      <div className="opus-welcome-overlay__card">
        <div className="opus-welcome-overlay__orb" aria-hidden="true" />
        <h2>Welcome to OPUS</h2>
        <p>Your freelance workspace is ready.</p>
      </div>
    </div>
  );
}
