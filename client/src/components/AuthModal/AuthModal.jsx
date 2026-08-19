import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { api } from '../../services/api';
import { getPostLoginPath } from '../../utils/postLoginPath';
import { triggerWelcome } from '../../utils/welcome';
import { IconClose } from '../icons/Icons';
import PasswordInput from '../PasswordInput/PasswordInput';
import GoogleAuthButton from './GoogleAuthButton';
import './AuthModal.css';

const emptyFreelancerSignUp = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
};

const emptyEmployerSignUp = {
  organizationName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
};

function ForgotPasswordFlow({ onBackToSignIn }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef([]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await api.forgotPassword({ email: email.trim() });
      setEmail(data.email || email.trim());
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setSuccess('We sent a 6-digit code to your email.');
    } catch (err) {
      if (err.data?.needsOtp) {
        setError('Your email is not verified yet. Sign in and complete email verification first.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const code = otp.join('');
      await api.verifyResetOtp({ email, otp: code });
      setVerifiedOtp(code);
      setStep('password');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      await api.resendResetOtp({ email });
      setSuccess('A new code was sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.resetPassword({
        email,
        otp: verifiedOtp,
        password,
        confirmPassword,
      });
      setSuccess('Password updated. You can sign in now.');
      setTimeout(() => onBackToSignIn(email), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="auth-modal__content">
        <h2 id="auth-modal-title" className="auth-modal__title">Enter reset code</h2>
        <p className="auth-modal__subtitle">Check your inbox for a 6-digit code</p>

        <form className="auth-modal__form" onSubmit={handleVerifyCode}>
          <p className="auth-modal__otp-hint">
            We sent a code to <strong>{email}</strong>
          </p>
          <div className="auth-modal__otp-grid">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="auth-modal__otp-box"
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {error && <p className="auth-modal__error">{error}</p>}
          {success && <p className="auth-modal__success">{success}</p>}

          <button
            type="submit"
            className="mac-btn mac-btn--filled auth-modal__submit"
            disabled={loading || otp.join('').length < 6}
          >
            {loading ? 'Verifying…' : 'Verify code'}
          </button>

          <button
            type="button"
            className="auth-modal__link-btn"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </form>

        <p className="auth-modal__switch">
          <button type="button" onClick={() => { setStep('email'); setError(''); setSuccess(''); }}>
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="auth-modal__content">
        <h2 id="auth-modal-title" className="auth-modal__title">Set new password</h2>
        <p className="auth-modal__subtitle">Choose a new password for {email}</p>

        <form className="auth-modal__form" onSubmit={handleResetPassword}>
          <PasswordInput
            id="reset-password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
          />
          <PasswordInput
            id="reset-confirm"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
          />

          {error && <p className="auth-modal__error">{error}</p>}
          {success && <p className="auth-modal__success">{success}</p>}

          <button type="submit" className="mac-btn mac-btn--filled auth-modal__submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-modal__content">
      <h2 id="auth-modal-title" className="auth-modal__title">Forgot password</h2>
      <p className="auth-modal__subtitle">We will email you a verification code</p>

      <form className="auth-modal__form" onSubmit={handleRequestCode}>
        <div className="auth-modal__field">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </div>

        {error && <p className="auth-modal__error">{error}</p>}
        {success && <p className="auth-modal__success">{success}</p>}

        <button type="submit" className="mac-btn mac-btn--filled auth-modal__submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send code'}
        </button>
      </form>

      <p className="auth-modal__switch">
        Remembered it?{' '}
        <button type="button" onClick={() => onBackToSignIn()}>Sign in</button>
      </p>
    </div>
  );
}

export default function AuthModal() {
  const { modal, closeModal, openSignIn, openSignUp, openForgotPassword, openOtp, openOnboarding } = useAuthModal();
  const { handleAuthResponse, setPendingEmail } = useAuth();
  const navigate = useNavigate();

  const [signUpRole, setSignUpRole] = useState('freelancer');
  const [email, setEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [freelancerForm, setFreelancerForm] = useState(emptyFreelancerSignUp);
  const [employerForm, setEmployerForm] = useState(emptyEmployerSignUp);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modal || modal === 'otp' || modal === 'onboarding' || modal === 'logout') {
      document.body.style.overflow = '';
      return undefined;
    }

    const handleKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [modal, closeModal]);

  useEffect(() => {
    if (modal === 'signin' || modal === 'forgot') {
      setError('');
      setLoading(false);
    }
  }, [modal]);

  if (!modal || modal === 'otp' || modal === 'onboarding' || modal === 'logout') return null;

  const isEmployerSignUp = signUpRole === 'employer';

  const handleFreelancerChange = (field) => (e) => {
    setFreelancerForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleEmployerChange = (field) => (e) => {
    setEmployerForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = isEmployerSignUp
        ? { ...employerForm, role: 'employer' }
        : { ...freelancerForm, role: 'freelancer' };
      await api.register(payload);
      setPendingEmail(payload.email);
      closeModal();
      openOtp();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login({ email, password: signInPassword });
      handleAuthResponse(data);
      closeModal();
      if (data.needsOnboarding) {
        openOnboarding();
      } else {
        triggerWelcome();
        navigate(getPostLoginPath(data.user));
      }
    } catch (err) {
      if (err.data?.needsOtp) {
        setPendingEmail(err.data.email || email);
        closeModal();
        openOtp();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const role = modal === 'signup' ? signUpRole : undefined;
      const data = await api.google({ credential: credentialResponse.credential, ...(role ? { role } : {}) });
      handleAuthResponse(data);
      closeModal();
      if (data.needsOnboarding) {
        openOnboarding();
      } else {
        triggerWelcome();
        navigate(getPostLoginPath(data.user));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleNotConfigured = () => {
    setError(
      'Google sign-in needs a Client ID. Add VITE_GOOGLE_CLIENT_ID to client/.env and GOOGLE_CLIENT_ID to server/.env, then restart both apps.',
    );
  };

  const handleBackToSignIn = (prefillEmail) => {
    if (prefillEmail) setEmail(prefillEmail);
    setSignInPassword('');
    openSignIn();
  };

  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="auth-modal__backdrop" onClick={closeModal} aria-hidden="true" />

      <div className="auth-modal__panel">
        <button type="button" className="auth-modal__close" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>

        {modal === 'forgot' ? (
          <ForgotPasswordFlow onBackToSignIn={handleBackToSignIn} />
        ) : modal === 'signin' ? (
          <div className="auth-modal__content">
            <h2 id="auth-modal-title" className="auth-modal__title">Welcome back</h2>
            <p className="auth-modal__subtitle">Sign in to continue to OPUS</p>

            <form className="auth-modal__form" onSubmit={handleSignInSubmit}>
              <div className="auth-modal__field">
                <label htmlFor="signin-email">Email or username</label>
                <input
                  id="signin-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                />
              </div>

              <PasswordInput
                id="signin-password"
                label="Password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />

              <div className="auth-modal__forgot-row">
                <button type="button" className="auth-modal__forgot-link" onClick={openForgotPassword}>
                  Forgot password?
                </button>
              </div>

              {error && <p className="auth-modal__error">{error}</p>}

              <button type="submit" className="mac-btn mac-btn--filled auth-modal__submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="auth-modal__divider"><span>or</span></div>

              <GoogleAuthButton
                mode="signin"
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed. Check your Google Client ID in client/.env')}
                onNotConfigured={handleGoogleNotConfigured}
              />
            </form>

            <p className="auth-modal__switch">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={openSignUp}>Sign up</button>
            </p>
          </div>
        ) : (
          <div className="auth-modal__content auth-modal__content--signup">
            <h2 id="auth-modal-title" className="auth-modal__title">Create account</h2>
            <p className="auth-modal__subtitle">
              {isEmployerSignUp ? 'Register your organization on OPUS' : 'Join OPUS as a freelancer or employer'}
            </p>

            <div className="auth-modal__segmented" role="tablist">
              {['freelancer', 'employer'].map((role) => (
                <button
                  key={role}
                  type="button"
                  role="tab"
                  aria-selected={signUpRole === role}
                  className={`auth-modal__segment ${signUpRole === role ? 'auth-modal__segment--active' : ''}`}
                  onClick={() => setSignUpRole(role)}
                >
                  {role === 'freelancer' ? 'Freelancer' : 'Employer'}
                </button>
              ))}
            </div>

            <form className="auth-modal__form" onSubmit={handleSignUpSubmit}>
              {isEmployerSignUp ? (
                <>
                  <div className="auth-modal__field">
                    <label htmlFor="signup-org">Organization name</label>
                    <input
                      id="signup-org"
                      type="text"
                      value={employerForm.organizationName}
                      onChange={handleEmployerChange('organizationName')}
                      placeholder="Your company or organization"
                      required
                    />
                  </div>

                  <div className="auth-modal__field">
                    <label htmlFor="signup-email-employer">Email</label>
                    <input
                      id="signup-email-employer"
                      type="email"
                      value={employerForm.email}
                      onChange={handleEmployerChange('email')}
                      placeholder="org@example.com"
                      required
                    />
                  </div>

                  <PasswordInput
                    id="signup-password-employer"
                    label="Password"
                    value={employerForm.password}
                    onChange={handleEmployerChange('password')}
                    placeholder="Password"
                    autoComplete="new-password"
                  />
                  <PasswordInput
                    id="signup-confirm-employer"
                    label="Confirm password"
                    value={employerForm.confirmPassword}
                    onChange={handleEmployerChange('confirmPassword')}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />

                  <div className="auth-modal__field">
                    <label htmlFor="signup-phone-employer">Phone number</label>
                    <input
                      id="signup-phone-employer"
                      type="tel"
                      value={employerForm.phone}
                      onChange={handleEmployerChange('phone')}
                      placeholder="+977 98XXXXXXXX"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="auth-modal__row">
                    <div className="auth-modal__field">
                      <label htmlFor="signup-first">First name</label>
                      <input id="signup-first" type="text" value={freelancerForm.firstName} onChange={handleFreelancerChange('firstName')} placeholder="First name" required />
                    </div>
                    <div className="auth-modal__field">
                      <label htmlFor="signup-last">Last name</label>
                      <input id="signup-last" type="text" value={freelancerForm.lastName} onChange={handleFreelancerChange('lastName')} placeholder="Last name" required />
                    </div>
                  </div>

                  <div className="auth-modal__field">
                    <label htmlFor="signup-email">Email</label>
                    <input id="signup-email" type="email" value={freelancerForm.email} onChange={handleFreelancerChange('email')} placeholder="name@example.com" required />
                  </div>

                  <PasswordInput id="signup-password" label="Password" value={freelancerForm.password} onChange={handleFreelancerChange('password')} placeholder="Password" autoComplete="new-password" />
                  <PasswordInput id="signup-confirm" label="Confirm password" value={freelancerForm.confirmPassword} onChange={handleFreelancerChange('confirmPassword')} placeholder="Confirm password" autoComplete="new-password" />

                  <div className="auth-modal__field">
                    <label htmlFor="signup-phone">Phone number</label>
                    <input id="signup-phone" type="tel" value={freelancerForm.phone} onChange={handleFreelancerChange('phone')} placeholder="+977 98XXXXXXXX" />
                  </div>
                </>
              )}

              {error && <p className="auth-modal__error">{error}</p>}

              <button type="submit" className="mac-btn mac-btn--filled auth-modal__submit" disabled={loading}>
                {loading ? 'Creating account…' : `Sign up as ${isEmployerSignUp ? 'Employer' : 'Freelancer'}`}
              </button>

              {!isEmployerSignUp && (
                <>
                  <div className="auth-modal__divider"><span>or</span></div>

                  <GoogleAuthButton
                    mode="signup"
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in failed. Check your Google Client ID in client/.env')}
                    onNotConfigured={handleGoogleNotConfigured}
                  />
                </>
              )}
            </form>

            <p className="auth-modal__switch">
              Already have an account?{' '}
              <button type="button" onClick={openSignIn}>Sign in</button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
