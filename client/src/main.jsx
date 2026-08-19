import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AuthModalProvider } from './context/AuthModalContext';
import { MessagingProvider } from './features/messaging/MessagingProvider';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import './index.css';
import App from './App.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || 'not-configured.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider>
        <AuthProvider>
          <AuthModalProvider>
            <MessagingProvider>
              <App />
            </MessagingProvider>
          </AuthModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </ErrorBoundary>,
);
