import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostLoginPath } from '../../utils/postLoginPath';
import { triggerWelcome } from '../../utils/welcome';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { api } from '../../services/api';
import PasswordInput from '../PasswordInput/PasswordInput';
import { IconClose } from '../icons/Icons';
import './OnboardingModal.css';

function ModalShell({ title, subtitle, onClose, children, wide, hideClose }) {
  return (
    <div className="onboard-modal" role="dialog" aria-modal="true">
      <div className="onboard-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`onboard-modal__panel ${wide ? 'onboard-modal__panel--wide' : ''}`}>
        {!hideClose && (
          <button type="button" className="onboard-modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        )}
        {title && <h2 className="onboard-modal__title">{title}</h2>}
        {subtitle && <p className="onboard-modal__subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function OtpStep({ email, onVerified }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const inputsRef = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const code = otp.join('');
      const data = await api.verifyOtp({ email, otp: code });
      onVerified(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendMsg('');
    setResending(true);
    try {
      await api.resendOtp({ email });
      setResendMsg('A new code was sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <p className="onboard-otp-hint">We sent a 6-digit code to <strong>{email}</strong></p>
      <div className="onboard-otp-grid">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="onboard-otp-box"
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {error && <p className="onboard-error">{error}</p>}
      {resendMsg && <p className="onboard-success">{resendMsg}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading || otp.join('').length < 6}>
        {loading ? 'Verifying…' : 'Verify Email'}
      </button>
      <button
        type="button"
        className="onboard-link-btn"
        onClick={handleResend}
        disabled={resending}
      >
        {resending ? 'Sending…' : 'Resend code'}
      </button>
    </form>
  );
}

function PasswordStep({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.setPassword({ password, confirmPassword: confirm });
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <p className="onboard-otp-hint">Set a password to sign in directly next time without Google.</p>
      <PasswordInput id="ob-password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password" autoComplete="new-password" />
      <PasswordInput id="ob-confirm" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" />
      {error && <p className="onboard-error">{error}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading}>Continue</button>
    </form>
  );
}

function DocumentUploadField({ id, label, hint, file, preview, onFile }) {
  return (
    <div className="onboard-doc-field">
      <label htmlFor={id} className="onboard-doc-field__label">{label}</label>
      <p className="onboard-doc-field__hint">{hint}</p>
      <div className="onboard-doc-field__preview">
        {preview ? (
          <img src={preview} alt={`${label} preview`} />
        ) : (
          <span className="onboard-doc-field__placeholder">No image selected</span>
        )}
      </div>
      <label htmlFor={id} className="mac-btn mac-btn--ghost onboard-upload-btn">
        {file ? 'Change image' : 'Upload image'}
        <input id={id} type="file" accept="image/*" hidden onChange={onFile} />
      </label>
    </div>
  );
}

function EmployerDocumentsStep({ onDone }) {
  const [panFile, setPanFile] = useState(null);
  const [panPreview, setPanPreview] = useState('');
  const [regFile, setRegFile] = useState(null);
  const [regPreview, setRegPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePan = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPanFile(f);
    setPanPreview(URL.createObjectURL(f));
  };

  const handleReg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRegFile(f);
    setRegPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!panFile || !regFile) {
      setError('Please upload both documents');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('panCard', panFile);
      formData.append('businessRegistration', regFile);
      const data = await api.saveEmployerDocuments(formData);
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <DocumentUploadField
        id="pan-card"
        label="PAN Card"
        hint="Upload a clear photo of your organization PAN card"
        file={panFile}
        preview={panPreview}
        onFile={handlePan}
      />
      <DocumentUploadField
        id="business-reg"
        label="Business Registration"
        hint="Upload your business registration certificate"
        file={regFile}
        preview={regPreview}
        onFile={handleReg}
      />
      {error && <p className="onboard-error">{error}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading}>
        {loading ? 'Uploading…' : 'Continue'}
      </button>
    </form>
  );
}

function EmployerBusinessTypeStep({ meta, onDone }) {
  const [businessType, setBusinessType] = useState('');
  const [otherType, setOtherType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessType) {
      setError('Please select a business type');
      return;
    }
    if (businessType === 'other' && !otherType.trim()) {
      setError('Please specify your business type');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.saveEmployerBusinessType({
        businessType,
        businessTypeOther: businessType === 'other' ? otherType.trim() : '',
      });
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <div className="onboard-biz-types">
        {(meta?.businessTypes || []).map((type) => (
          <button
            key={type.value}
            type="button"
            className={`onboard-biz-type ${businessType === type.value ? 'onboard-biz-type--active' : ''}`}
            onClick={() => setBusinessType(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>
      {businessType === 'other' && (
        <div className="onboard-field">
          <label htmlFor="biz-other">Specify business type</label>
          <input
            id="biz-other"
            value={otherType}
            onChange={(e) => setOtherType(e.target.value)}
            placeholder="Enter your business type"
            required
          />
        </div>
      )}
      {error && <p className="onboard-error">{error}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading}>
        {loading ? 'Finishing…' : 'Complete signup'}
      </button>
    </form>
  );
}

function WelcomeStep({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="onboard-welcome" role="status" aria-live="polite">
      <div className="onboard-welcome__glow" aria-hidden="true" />
      <h2 className="onboard-welcome__title">Welcome to OPUS</h2>
    </div>
  );
}

function DegreeStep({ meta, onDone }) {
  const [degree, setDegree] = useState('');
  const [degreeName, setDegreeName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [passoutYear, setPassoutYear] = useState('');
  const [stillRunning, setStillRunning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showDegreeName = degree === 'Bachelor' || degree === 'Master';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.saveDegree({
        degree,
        degreeName: showDegreeName ? degreeName : '',
        schoolName,
        passoutYear: stillRunning ? null : passoutYear,
        stillRunning,
      });
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <div className="onboard-field">
        <label htmlFor="degree">Degree</label>
        <select id="degree" value={degree} onChange={(e) => setDegree(e.target.value)} required>
          <option value="">Select degree</option>
          {(meta?.degrees || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="onboard-field">
        <label htmlFor="schoolName">School / College Name</label>
        <input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Tribhuvan University" required />
      </div>
      {showDegreeName && (
        <div className="onboard-field">
          <label htmlFor="degreeName">Degree Name</label>
          <input id="degreeName" value={degreeName} onChange={(e) => setDegreeName(e.target.value)} placeholder="e.g. BSc CSIT" required />
        </div>
      )}
      {!stillRunning && (
        <div className="onboard-field">
          <label htmlFor="passoutYear">Passout Year</label>
          <select id="passoutYear" value={passoutYear} onChange={(e) => setPassoutYear(e.target.value)} required={!stillRunning}>
            <option value="">Select year</option>
            {(meta?.passoutYears || []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      <label className="onboard-check">
        <input type="checkbox" checked={stillRunning} onChange={(e) => setStillRunning(e.target.checked)} />
        <span>Still Running</span>
      </label>
      {error && <p className="onboard-error">{error}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading}>Continue</button>
    </form>
  );
}

function SkillsStep({ meta, onDone }) {
  const [selected, setSelected] = useState([]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggle = (skill) => {
    setSelected((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (trimmed && !selected.includes(trimmed)) {
      setSelected((prev) => [...prev, trimmed]);
      setCustom('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.saveSkills({ skills: selected });
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={handleSubmit}>
      <div className="onboard-skills">
        {(meta?.skills || []).map((skill) => (
          <button
            key={skill}
            type="button"
            className={`onboard-skill ${selected.includes(skill) ? 'onboard-skill--active' : ''}`}
            onClick={() => toggle(skill)}
          >
            {skill}
          </button>
        ))}
      </div>
      <div className="onboard-custom-skill">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own skill" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
        <button type="button" className="mac-btn mac-btn--ghost" onClick={addCustom}>Add</button>
      </div>
      {error && <p className="onboard-error">{error}</p>}
      <button type="submit" className="mac-btn mac-btn--filled onboard-submit" disabled={loading || selected.length === 0}>Continue</button>
    </form>
  );
}

function ProfileStep({ meta, onDone }) {
  const [avatarId, setAvatarId] = useState('');
  const [preview, setPreview] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setAvatarId('');
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (skip = false) => {
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      if (file) formData.append('photo', file);
      if (avatarId) formData.append('avatarId', avatarId);
      if (skip) formData.append('skip', 'true');
      const data = await api.saveProfile(formData);
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboard-form">
      <div className="onboard-profile-preview">
        {preview ? (
          <img src={preview} alt="Preview" />
        ) : (
          <div className="onboard-profile-placeholder">Photo</div>
        )}
      </div>
      <label className="mac-btn mac-btn--ghost onboard-upload-btn">
        Upload photo
        <input type="file" accept="image/*" hidden onChange={handleFile} />
      </label>
      <p className="onboard-otp-hint">Or choose an avatar</p>
      <div className="onboard-avatars">
        {(meta?.avatars || []).map((a) => (
          <button
            key={a.id}
            type="button"
            className={`onboard-avatar ${avatarId === a.id ? 'onboard-avatar--active' : ''}`}
            onClick={() => { setAvatarId(a.id); setFile(null); setPreview(a.url); }}
          >
            <img src={a.url} alt="" />
          </button>
        ))}
      </div>
      {error && <p className="onboard-error">{error}</p>}
      <button type="button" className="mac-btn mac-btn--filled onboard-submit" disabled={loading} onClick={() => submit(false)}>
        {loading ? 'Saving…' : 'Finish'}
      </button>
      <button type="button" className="onboard-link-btn" disabled={loading} onClick={() => submit(true)}>Skip for now</button>
    </div>
  );
}

const STEP_TITLES = {
  otp: ['Verify your email', 'Enter the 6-digit code we sent to your Gmail'],
  password: ['Create a password', 'Use this to sign in without Google next time'],
  documents: ['Document verification', 'Upload PAN card and business registration documents'],
  business_type: ['Business type', 'What type of organization are you?'],
  degree: ['Your education', 'Tell us about your academic background'],
  skills: ['Your skills', 'Select skills that describe what you do best'],
  profile: ['Profile photo', 'Upload a photo or pick an avatar. You can skip'],
};

export default function OnboardingModal() {
  const { modal, closeModal, openOnboarding } = useAuthModal();
  const { user, onboardingStep, pendingEmail, handleAuthResponse, persistSession, setOnboardingStep, setPendingEmail } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (modal === 'otp' || modal === 'onboarding') {
      api.getMeta().then(setMeta).catch(() => {});
    }
  }, [modal]);

  useEffect(() => {
    if (modal !== 'onboarding') return;
    const active = new Set(['password', 'degree', 'skills', 'profile', 'documents', 'business_type']);
    if (onboardingStep && !active.has(onboardingStep)) {
      closeModal();
    }
  }, [modal, onboardingStep, closeModal]);

  useEffect(() => {
    if (!modal) {
      document.body.style.overflow = '';
      return undefined;
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  if (modal !== 'otp' && modal !== 'onboarding') return null;

  const isEmployer = user?.role === 'employer';
  const step = modal === 'otp' ? 'otp' : onboardingStep;
  const [title, subtitle] = STEP_TITLES[step] || ['Continue', ''];

  const advance = (data) => {
    const completed = data.onboardingStep === 'complete' || data.user?.onboardingComplete;
    const nextUser = data.user || user;

    if (data.token) {
      handleAuthResponse(data);
    } else if (data.user) {
      persistSession(localStorage.getItem('opus_token'), data.user);
      setOnboardingStep(data.onboardingStep);
    }

    if (completed) {
      closeModal();
      triggerWelcome();
      navigate(getPostLoginPath(nextUser));
      return;
    }

    if (modal === 'otp') {
      setPendingEmail('');
      openOnboarding();
    }
  };

  const onClose = () => {
    if (step === 'otp') closeModal();
  };

  const wide = step === 'skills' || step === 'profile' || step === 'documents' || step === 'business_type';

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose} wide={wide}>
      {step === 'otp' && <OtpStep email={pendingEmail} onVerified={advance} />}
      {step === 'password' && <PasswordStep onDone={advance} />}
      {isEmployer && step === 'documents' && <EmployerDocumentsStep onDone={advance} />}
      {isEmployer && step === 'business_type' && <EmployerBusinessTypeStep meta={meta} onDone={advance} />}
      {!isEmployer && step === 'degree' && <DegreeStep meta={meta} onDone={advance} />}
      {!isEmployer && step === 'skills' && <SkillsStep meta={meta} onDone={advance} />}
      {!isEmployer && step === 'profile' && <ProfileStep meta={meta} onDone={advance} />}
    </ModalShell>
  );
}
