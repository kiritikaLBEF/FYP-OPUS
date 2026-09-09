import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './EmployerEditProfile.css';

const BUSINESS_TYPES = [
  { value: 'it', label: 'IT' },
  { value: 'government', label: 'Government' },
  { value: 'ngo_ingo', label: 'NGO / INGO' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'consulting', label: 'Consulting Company' },
  { value: 'other', label: 'Others' },
];

const EMPTY = {
  organizationName: '',
  bio: '',
  website: '',
  socialHandle: '',
  publicEmail: '',
  city: '',
  stateProvince: '',
  country: '',
  businessType: '',
  businessTypeOther: '',
};

export default function EmployerEditProfile() {
  const { persistSession } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getProfile()
      .then((data) => {
        if (cancelled) return;
        const u = data.user || {};
        setForm({
          organizationName: u.organizationName || '',
          bio: u.bio || '',
          website: u.website || '',
          socialHandle: u.socialHandle || '',
          publicEmail: u.publicEmail || '',
          city: u.city || '',
          stateProvince: u.stateProvince || '',
          country: u.country || '',
          businessType: u.businessType || '',
          businessTypeOther: u.businessTypeOther || '',
        });
        if (u?.id) persistSession(null, u);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [persistSession]);

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await api.updateProfile({
        organizationName: form.organizationName,
        bio: form.bio,
        website: form.website,
        socialHandle: form.socialHandle,
        publicEmail: form.publicEmail,
        city: form.city,
        stateProvince: form.stateProvince,
        country: form.country,
        businessType: form.businessType,
        businessTypeOther: form.businessTypeOther,
      });
      if (data.user) persistSession(null, data.user);
      setMessage('Profile saved');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="eep"><p className="eep__status">Loading profile…</p></div>;
  }

  return (
    <div className="eep">
      <header className="eep__head">
        <div>
          <h1 className="eep__title">Edit organization profile</h1>
          <p className="eep__sub">
            Bio, contact, and location shown on your public employer profile.
          </p>
        </div>
      </header>

      {error && <p className="eep__error">{error}</p>}
      {message && <p className="eep__ok">{message}</p>}

      <form className="eep__form" onSubmit={onSubmit}>
        <label className="eep__field">
          <span>Organization name</span>
          <input
            value={form.organizationName}
            onChange={onChange('organizationName')}
            maxLength={120}
            required
          />
        </label>

        <label className="eep__field">
          <span>Bio</span>
          <textarea
            value={form.bio}
            onChange={onChange('bio')}
            rows={5}
            maxLength={2000}
            placeholder="Describe your organization and the kinds of gigs you post."
          />
        </label>

        <div className="eep__row">
          <label className="eep__field">
            <span>Website</span>
            <input
              value={form.website}
              onChange={onChange('website')}
              placeholder="nexusorg.com"
              maxLength={200}
            />
          </label>
          <label className="eep__field">
            <span>Social</span>
            <input
              value={form.socialHandle}
              onChange={onChange('socialHandle')}
              placeholder="@nexusorg"
              maxLength={80}
            />
          </label>
        </div>

        <label className="eep__field">
          <span>Public contact email</span>
          <input
            type="email"
            value={form.publicEmail}
            onChange={onChange('publicEmail')}
            placeholder="hello@company.com"
            maxLength={120}
          />
          <em className="eep__hint">Shown on your public profile. This is separate from your login email.</em>
        </label>

        <div className="eep__row">
          <label className="eep__field">
            <span>City</span>
            <input value={form.city} onChange={onChange('city')} maxLength={80} />
          </label>
          <label className="eep__field">
            <span>Province / state</span>
            <input value={form.stateProvince} onChange={onChange('stateProvince')} maxLength={80} />
          </label>
        </div>

        <label className="eep__field">
          <span>Country</span>
          <input value={form.country} onChange={onChange('country')} maxLength={80} />
        </label>

        <div className="eep__row">
          <label className="eep__field">
            <span>Organization type</span>
            <select value={form.businessType} onChange={onChange('businessType')}>
              <option value="">Select type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {form.businessType === 'other' && (
            <label className="eep__field">
              <span>Other type</span>
              <input
                value={form.businessTypeOther}
                onChange={onChange('businessTypeOther')}
                maxLength={80}
              />
            </label>
          )}
        </div>

        <div className="eep__actions">
          <button type="submit" className="eep__save" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
