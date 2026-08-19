import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getProfileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { calculateProfileCompletion } from '../../utils/profileCompletion';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import { PROFILE_SECTIONS, getSectionComplete } from './profileSections';
import {
  PanelHeader,
  PersonalSection,
  ProfessionalSection,
  SkillsSection,
  CertificationsSection,
  ProjectsSection,
  PreferencesSection,
  PrivacySection,
  AccountSection,
  toDateInput,
} from './EditProfileSections';
import SectionActions from './SectionActions';
import {
  SECTION_SAVEABLE,
  buildSectionBaselines,
  buildSectionPayload,
  mergeSectionIntoForm,
  sectionSnapshot,
} from './profileSectionFields';
import './EditProfile.css';

const emptyCert = () => ({
  name: '', organization: '', issueDate: '', expirationDate: '', credentialId: '', credentialUrl: '', file: null,
});

const emptyProject = () => ({
  title: '', description: '', category: 'coding', technologies: '', completionDate: '',
  links: [{ type: 'github', url: '' }], thumbnail: null, screenshots: [], files: [],
});

export default function EditProfile() {
  const navigate = useNavigate();
  const { persistSession, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [meta, setMeta] = useState({});
  const [completion, setCompletion] = useState({ percentage: 0, incomplete: [] });
  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [pwd, setPwd] = useState({ current: '', newPass: '', confirm: '' });
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState(emptyCert());
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProject());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmText: '' });
  const [activeSection, setActiveSection] = useState('personal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const [sectionBaseline, setSectionBaseline] = useState({});
  const [savingSection, setSavingSection] = useState(null);
  const [badges, setBadges] = useState([]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProfile();
      const u = data.user;
      const f = {
        firstName: u.firstName || '', lastName: u.lastName || '', username: u.username || '',
        email: u.email, phone: u.phone || '', alternatePhone: u.alternatePhone || '',
        country: u.country || '', stateProvince: u.stateProvince || '', city: u.city || '',
        address: u.address || '', postalCode: u.postalCode || '', timezone: u.timezone || '',
        gender: u.gender || '', dateOfBirth: toDateInput(u.dateOfBirth),
        degree: u.degree || '', degreeName: u.degreeName || '', schoolName: u.schoolName || '',
        passoutYear: u.passoutYear || '', stillRunning: u.stillRunning || false,
        interests: u.interests || [], professionalSummary: u.professionalSummary || '', skills: u.skills || [],
        certifications: u.certifications || [], projects: u.projects || [],
        notificationPreferences: u.notificationPreferences || { emailUpdates: true, jobAlerts: true, forumReplies: true },
        privacySettings: u.privacySettings || { profileVisible: true, showEmail: false },
        language: u.language || 'en',
        emailReadOnly: u.emailReadOnly, hasPassword: u.hasPassword,
        profilePicture: u.profilePicture,
      };
      setForm(f);
      setInitial(JSON.stringify(f));
      setSectionBaseline(buildSectionBaselines(f));
      setCompletion(data.completion || calculateProfileCompletion(u));
      setMeta(data.meta || {});
      setPhotoPreview(getProfileUrl(u.profilePicture));
      setBadges(u.badges || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const isSectionDirty = useCallback((sectionId) => {
    if (!initial || !SECTION_SAVEABLE.includes(sectionId)) return false;
    if (sectionId === 'personal' && photoFile) return true;
    return sectionSnapshot(sectionId, form) !== sectionBaseline[sectionId];
  }, [form, initial, photoFile, sectionBaseline]);

  const activeMeta = PROFILE_SECTIONS.find((s) => s.id === activeSection);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const switchSection = (id) => {
    if (id === activeSection) {
      setSidebarOpen(false);
      return;
    }
    if (isSectionDirty(activeSection) && !window.confirm('You have unsaved changes in this section. Switch anyway?')) return;
    setActiveSection(id);
    setPanelKey((k) => k + 1);
    setSidebarOpen(false);
  };

  const applyUserToForm = (resUser, prevForm) => ({
    ...prevForm,
    firstName: resUser.firstName,
    lastName: resUser.lastName,
    username: resUser.username,
    phone: resUser.phone,
    alternatePhone: resUser.alternatePhone || '',
    country: resUser.country,
    stateProvince: resUser.stateProvince || '',
    city: resUser.city,
    address: resUser.address || '',
    postalCode: resUser.postalCode || '',
    timezone: resUser.timezone || '',
    gender: resUser.gender || '',
    dateOfBirth: toDateInput(resUser.dateOfBirth),
    degree: resUser.degree,
    degreeName: resUser.degreeName,
    schoolName: resUser.schoolName,
    passoutYear: resUser.passoutYear || '',
    stillRunning: resUser.stillRunning,
    interests: resUser.interests,
    professionalSummary: resUser.professionalSummary,
    skills: resUser.skills,
    notificationPreferences: resUser.notificationPreferences,
    privacySettings: resUser.privacySettings,
    language: resUser.language,
    profilePicture: resUser.profilePicture,
  });

  const handleSectionSave = async (sectionId) => {
    setSavingSection(sectionId);
    try {
      if (sectionId === 'personal' && photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        const photoRes = await api.uploadProfilePhoto(fd);
        persistSession(null, photoRes.user);
        setPhotoFile(null);
        setForm((prev) => ({ ...prev, profilePicture: photoRes.user.profilePicture }));
        setPhotoPreview(getProfileUrl(photoRes.user.profilePicture));
      }

      const payload = buildSectionPayload(sectionId, form);
      const res = await api.updateProfile(payload);
      const updated = applyUserToForm(res.user, form);
      persistSession(null, res.user);
      setForm(updated);
      setInitial(JSON.stringify(updated));
      setSectionBaseline(buildSectionBaselines(updated));
      setCompletion(res.completion);
      showToast(`${PROFILE_SECTIONS.find((s) => s.id === sectionId)?.label || 'Section'} saved`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSection(null);
    }
  };

  const handleSectionCancel = (sectionId) => {
    if (!isSectionDirty(sectionId)) return;
    const baseline = JSON.parse(initial);
    setForm((prev) => mergeSectionIntoForm(sectionId, baseline, prev));
    if (sectionId === 'personal') {
      setPhotoFile(null);
      setPhotoPreview(getProfileUrl(baseline.profilePicture));
    }
    setSectionBaseline((prev) => ({ ...prev, [sectionId]: sectionSnapshot(sectionId, baseline) }));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await api.changePassword({ currentPassword: pwd.current, newPassword: pwd.newPass, confirmPassword: pwd.confirm });
      setPwd({ current: '', newPass: '', confirm: '' });
      showToast('Password updated');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteCert = async (id) => {
    if (!window.confirm('Delete this certification?')) return;
    try {
      const res = await api.deleteCertification(id);
      setForm((prev) => ({ ...prev, certifications: res.user.certifications }));
      setCompletion(res.completion);
      persistSession(null, res.user);
      showToast('Certification removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      const res = await api.deleteProject(id);
      setForm((prev) => ({ ...prev, projects: res.user.projects }));
      setCompletion(res.completion);
      persistSession(null, res.user);
      showToast('Project removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitCert = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(certForm).forEach(([k, v]) => { if (k !== 'file' && v) fd.append(k, v); });
      if (certForm.file) fd.append('file', certForm.file);
      const res = await api.addCertification(fd);
      setForm((prev) => ({ ...prev, certifications: res.user.certifications }));
      setCompletion(res.completion);
      persistSession(null, res.user);
      setCertForm(emptyCert());
      setShowCertForm(false);
      showToast('Certification added');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitProject = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', projectForm.title);
      fd.append('description', projectForm.description);
      fd.append('category', projectForm.category);
      fd.append('technologies', JSON.stringify(projectForm.technologies.split(',').map((t) => t.trim()).filter(Boolean)));
      if (projectForm.completionDate) fd.append('completionDate', projectForm.completionDate);
      fd.append('links', JSON.stringify(projectForm.links.filter((l) => l.url.trim())));
      if (projectForm.thumbnail) fd.append('thumbnail', projectForm.thumbnail);
      projectForm.screenshots.forEach((f) => fd.append('screenshots', f));
      projectForm.files.forEach((f) => fd.append('files', f));
      const res = await api.addProject(fd);
      setForm((prev) => ({ ...prev, projects: res.user.projects }));
      setCompletion(res.completion);
      persistSession(null, res.user);
      setProjectForm(emptyProject());
      setShowProjectForm(false);
      showToast('Project added');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount(deleteForm);
      logout();
      navigate('/');
      showToast('Account deleted');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const renderPanel = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalSection form={form} set={set} meta={meta} photoPreview={photoPreview} onPhoto={handlePhoto} badges={badges} />;
      case 'professional':
        return <ProfessionalSection form={form} set={set} />;
      case 'skills':
        return <SkillsSection form={form} set={set} />;
      case 'certifications':
        return (
          <CertificationsSection
            form={form}
            certForm={certForm}
            setCertForm={setCertForm}
            showCertForm={showCertForm}
            setShowCertForm={setShowCertForm}
            submitCert={submitCert}
            onDelete={deleteCert}
          />
        );
      case 'projects':
        return (
          <ProjectsSection
            form={form}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            showProjectForm={showProjectForm}
            setShowProjectForm={setShowProjectForm}
            submitProject={submitProject}
            onDelete={deleteProject}
          />
        );
      case 'preferences':
        return <PreferencesSection form={form} set={set} />;
      case 'privacy':
        return (
          <PrivacySection
            form={form}
            set={set}
            pwd={pwd}
            setPwd={setPwd}
            onPasswordChange={handlePasswordChange}
            hasPassword={form.hasPassword}
          />
        );
      case 'account':
        return <AccountSection onDelete={() => setDeleteOpen(true)} />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="ep-page"><div className="route-loading"><div className="route-loading__spinner" /></div></div>;
  }

  return (
    <div className="ep-page">
      {toast && <div className={`ep-toast ep-toast--${toast.type}`} role="status">{toast.msg}</div>}

      <div className="ep-header">
        <div className="ep-header__inner">
          <div className="ep-header__left">
            <Link to="/" className="ep-back">← Back</Link>
            <h1 className="ep-title">Edit Profile</h1>
          </div>
          <div className="ep-header__actions">
            <button type="button" className="mac-btn mac-btn--ghost ep-mobile-nav-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sections">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{activeMeta?.label}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="ep-layout-wrap">
        <div className="ep-layout-top">
          <div className="ep-completion-compact" aria-label={`Profile ${completion.percentage}% complete`}>
            <div className="ep-completion-ring" style={{ '--progress': completion.percentage }}>
              <svg className="ep-completion-ring__svg" viewBox="0 0 44 44" aria-hidden="true">
                <circle className="ep-completion-ring__track" cx="22" cy="22" r="18" />
                <circle className="ep-completion-ring__fill" cx="22" cy="22" r="18" />
              </svg>
              <span className="ep-completion-ring__value">{completion.percentage}%</span>
            </div>
            <span className="ep-completion-compact__label">Complete</span>
          </div>
        </div>

        <div className="ep-layout">
          {sidebarOpen && <button type="button" className="ep-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

          <aside className={`ep-sidebar ${sidebarOpen ? 'ep-sidebar--open' : ''}`}>
            <div className="ep-shell ep-shell--nav">
              <p className="ep-shell__label">Sections</p>
              <nav className="ep-nav" aria-label="Profile sections">
              {PROFILE_SECTIONS.map((section) => {
                const Icon = section.Icon;
                const isActive = activeSection === section.id;
                const done = getSectionComplete(section.id, form);
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`ep-nav__item ${isActive ? 'ep-nav__item--active' : ''}`}
                    onClick={() => switchSection(section.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && <span className="ep-nav__indicator" aria-hidden="true" />}
                    <span className="ep-nav__icon"><Icon /></span>
                    <span className="ep-nav__text">
                      <span className="ep-nav__label">{section.label}</span>
                      <span className="ep-nav__sub">{section.subtitle}</span>
                    </span>
                    {!done && <span className="ep-nav__dot" title="Incomplete" />}
                  </button>
                );
              })}
              </nav>
            </div>
          </aside>

          <main className="ep-main">
            <div className="ep-shell ep-shell--panel" key={panelKey}>
              <PanelHeader title={activeMeta?.label} subtitle={activeMeta?.subtitle} icon={activeMeta?.Icon} />
              <div className="ep-shell__scroll">{renderPanel()}</div>
              <SectionActions
                visible={SECTION_SAVEABLE.includes(activeSection)}
                canSave={isSectionDirty(activeSection)}
                saving={savingSection === activeSection}
                onSave={() => handleSectionSave(activeSection)}
                onCancel={() => handleSectionCancel(activeSection)}
              />
            </div>
          </main>
        </div>
      </div>

      <div className="ep-mobile-tabs" role="tablist" aria-label="Profile sections">
        {PROFILE_SECTIONS.slice(0, 5).map((section) => {
          const Icon = section.Icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ep-mobile-tab ${isActive ? 'ep-mobile-tab--active' : ''}`}
              onClick={() => switchSection(section.id)}
              title={section.label}
            >
              <Icon />
            </button>
          );
        })}
        <button type="button" className="ep-mobile-tab" onClick={() => setSidebarOpen(true)} title="More sections">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="6" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="18" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {deleteOpen && (
        <div className="ep-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="ep-modal__backdrop" onClick={() => setDeleteOpen(false)} />
          <div className="ep-modal__panel">
            <h3 id="delete-title">Delete account?</h3>
            <p>This action is permanent. Type <strong>DELETE</strong> to confirm.</p>
            {form.hasPassword && (
              <PasswordInput id="del-pwd" label="Password" value={deleteForm.password} onChange={(e) => setDeleteForm({ ...deleteForm, password: e.target.value })} placeholder="Your password" />
            )}
            <div className="ep-field"><input value={deleteForm.confirmText} onChange={(e) => setDeleteForm({ ...deleteForm, confirmText: e.target.value })} placeholder="Type DELETE" /></div>
            <div className="ep-subform__actions">
              <button type="button" className="mac-btn mac-btn--ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="button" className="mac-btn mac-btn--filled ep-danger-confirm" onClick={handleDeleteAccount}>Delete forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
