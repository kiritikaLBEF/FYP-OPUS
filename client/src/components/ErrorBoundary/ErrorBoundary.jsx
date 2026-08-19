import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('OPUS render error:', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f5f5f7',
          color: '#1d1d1f',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
        >
          <div style={{ maxWidth: '520px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Something went wrong</h1>
            <p style={{ color: '#6e6e73', marginBottom: '16px', lineHeight: 1.5 }}>
              The page failed to load. Try a hard refresh (Ctrl+Shift+R). If it keeps happening, sign out and back in.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '10px 18px',
                background: '#0071e3',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
