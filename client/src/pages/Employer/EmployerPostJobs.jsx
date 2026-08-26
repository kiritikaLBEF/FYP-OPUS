import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { JOB_CATEGORIES, fmtBudget, fmtDeadline } from '../../utils/jobUtils';
import EmployerLockedGate from './EmployerLockedGate';
import JobDetailModal, { JobCover, JobPreviewCard } from '../../components/jobs/JobDetailModal';
import ImageCropModal from '../../components/jobs/ImageCropModal';
import { IconClose, IconEye } from '../../components/icons/Icons';
import './EmployerPostJob.css';
import '../../components/Layout/EmployerLayout.css';

function Field({ label, hint, children }) {
  return (
    <div className="emp-post-field">
      <span className="emp-post-field__label">{label}</span>
      {hint ? <p className="emp-post-hint">{hint}</p> : null}
      {children}
    </div>
  );
}

function Seg({ active, onClick, children }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  );
}

export default function EmployerPostJobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgName = user?.organizationName || 'Your organization';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(JOB_CATEGORIES[0].value);
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState([]);
  const [conditionInput, setConditionInput] = useState('');
  const [budgetType, setBudgetType] = useState('fixed');
  const [amount, setAmount] = useState('');
  const [hourly, setHourly] = useState('');
  const [deadline, setDeadline] = useState('');
  const [location, setLocation] = useState('Remote, Nepal');
  const [coverMode, setCoverMode] = useState('image');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverText, setCoverText] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [projectMode, setProjectMode] = useState('single');
  const [multiBidMode, setMultiBidMode] = useState('both');
  const [roles, setRoles] = useState([
    { key: 'r1', name: '', description: '', budgetPercent: 50 },
    { key: 'r2', name: '', description: '', budgetPercent: 50 },
  ]);
  const [published, setPublished] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef(null);

  const categoryLabel = JOB_CATEGORIES.find((c) => c.value === category)?.label || category;

  const previewJob = {
    title,
    description,
    category,
    categoryLabel,
    location,
    budgetType,
    budget: Number(amount) || 0,
    hourlyRate: Number(hourly) || 0,
    skillsRequired: skills,
    conditions,
    coverMode: coverMode === 'image' && coverPreview ? 'image' : coverMode === 'text' ? 'text' : 'none',
    coverPreview,
    coverText,
    applicationDeadline: deadline || null,
    organizationName: orgName,
    projectMode,
    multiBidMode: projectMode === 'multi' ? multiBidMode : null,
    roles: projectMode === 'multi'
      ? roles.map((r) => ({
          roleKey: r.key,
          name: r.name,
          description: r.description,
          budgetPercent: Number(r.budgetPercent) || 0,
          budgetAmount: Math.round((Number(amount) || 0) * (Number(r.budgetPercent) || 0) / 100),
          status: 'open',
        }))
      : [],
    isMulti: projectMode === 'multi',
    allowRoleBids: projectMode === 'multi' && ['role', 'both'].includes(multiBidMode),
    allowSquadBids: projectMode === 'multi' && ['squad', 'both'].includes(multiBidMode),
  };

  const rolePctSum = roles.reduce((s, r) => s + (Number(r.budgetPercent) || 0), 0);

  const addCondition = () => {
    const v = conditionInput.trim();
    if (!v) return;
    setConditions([...conditions, v]);
    setConditionInput('');
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || skills.includes(v)) return;
    setSkills([...skills, v]);
    setSkillInput('');
  };

  const handleRawFile = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => setCropSrc(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleCropped = (file, preview) => {
    setCoverFile(file);
    setCoverPreview(preview);
    setCropSrc('');
  };

  const buildFormData = (publishStatus) => {
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('category', category);
    fd.append('budgetType', budgetType);
    fd.append('budget', amount || '0');
    fd.append('hourlyRate', hourly || '0');
    fd.append('location', location.trim());
    fd.append('skillsRequired', JSON.stringify(skills));
    fd.append('conditions', JSON.stringify(conditions));
    if (deadline) fd.append('applicationDeadline', deadline);
    fd.append('coverMode', coverMode);
    fd.append('coverText', coverText.trim());
    fd.append('publishStatus', publishStatus);
    fd.append('projectMode', projectMode);
    fd.append('multiBidMode', multiBidMode);
    if (projectMode === 'multi') {
      fd.append(
        'roles',
        JSON.stringify(
          roles.map((r) => ({
            name: r.name.trim(),
            description: r.description.trim(),
            budgetPercent: Number(r.budgetPercent) || 0,
          })),
        ),
      );
    }
    if (coverMode === 'image' && coverFile) fd.append('coverImage', coverFile);
    return fd;
  };

  const validateMulti = () => {
    if (projectMode !== 'multi') return true;
    if (roles.some((r) => !r.name.trim())) {
      setError('Give every role a name.');
      return false;
    }
    if (Math.round(rolePctSum) !== 100) {
      setError('Role budget percentages must add up to 100%.');
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Multi-freelancer jobs need a fixed total budget to split across roles.');
      return false;
    }
    return true;
  };

  const submit = async (publishStatus) => {
    setError('');
    setSuccess('');
    if (!title.trim()) {
      setError('Add a job title before saving.');
      return;
    }
    if (!validateMulti()) return;
    setLoading(true);
    try {
      const res = await api.createEmployerJob(buildFormData(publishStatus));
      const isDraft = publishStatus === 'draft';
      setPublished(!isDraft);
      if (isDraft) {
        setSuccess(res.message || 'Draft saved.');
      } else {
        setConfirmOpen(false);
        setShowSuccess(true);
        setTimeout(() => navigate('/employer/check-status'), 2200);
      }
    } catch (err) {
      setError(err.message || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  const openPublishConfirm = () => {
    setError('');
    if (!title.trim()) {
      setError('Add a job title before publishing.');
      return;
    }
    if (!validateMulti()) return;
    setConfirmOpen(true);
  };

  const updateRole = (key, patch) => {
    setRoles((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRole = () => {
    setRoles((prev) => [
      ...prev,
      { key: `r${Date.now()}`, name: '', description: '', budgetPercent: 0 },
    ]);
  };

  const removeRole = (key) => {
    setRoles((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  return (
    <EmployerLockedGate feature="Post Jobs">
      <div className="emp-post-page">
        <header className="emp-page-header">
          <div>
            <h1>Post a job</h1>
            <p>{orgName}</p>
          </div>
        </header>

        <div className="emp-post-layout">
          <div className="emp-post-form">
            {error && <p className="emp-post-error">{error}</p>}
            {success && <p className="emp-post-success">{success}</p>}

            <section className="emp-post-section">
              <h2>Who will do the work</h2>
              <Field label="Project type">
                <div className="emp-post-mode-cards">
                  <button
                    type="button"
                    className={`emp-post-mode-card ${projectMode === 'single' ? 'is-selected' : ''}`}
                    onClick={() => setProjectMode('single')}
                  >
                    <strong>One freelancer</strong>
                    <span>A single person completes the job.</span>
                  </button>
                  <button
                    type="button"
                    className={`emp-post-mode-card ${projectMode === 'multi' ? 'is-selected' : ''}`}
                    onClick={() => {
                      setProjectMode('multi');
                      setBudgetType('fixed');
                    }}
                  >
                    <strong>Several freelancers</strong>
                    <span>Split the job into roles.</span>
                  </button>
                </div>
              </Field>

              {projectMode === 'multi' && (
                <Field label="How people apply">
                  <div className="emp-post-mode-cards emp-post-mode-cards--3">
                    {[
                      { id: 'role', title: 'By role', desc: 'Bid on one role.' },
                      { id: 'squad', title: 'As a squad', desc: 'A team covers all roles.' },
                      { id: 'both', title: 'Either', desc: 'Role or squad bids.' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`emp-post-mode-card ${multiBidMode === opt.id ? 'is-selected' : ''}`}
                        onClick={() => setMultiBidMode(opt.id)}
                      >
                        <strong>{opt.title}</strong>
                        <span>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </section>

            <section className="emp-post-section">
              <h2>Listing</h2>
              <Field label="Job title">
                <input className="emp-post-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend developer for a campus marketplace" />
              </Field>

              <div className="emp-post-grid-2">
                <Field label="Category">
                  <select className="emp-post-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {JOB_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Location">
                  <input className="emp-post-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, Kathmandu" />
                </Field>
              </div>

              <Field label="Description">
                <textarea className="emp-post-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deliverables, timeline, and what a strong applicant looks like." />
              </Field>

              <Field label="Requirements" hint="Press Enter to add each one.">
                <div className="emp-post-list-box">
                  {conditions.map((c, i) => (
                    <div key={`${c}-${i}`} className="emp-post-list-row">
                      <p>{c}</p>
                      <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} aria-label="Remove requirement"><IconClose size={14} /></button>
                    </div>
                  ))}
                  <div className="emp-post-list-add">
                    <input value={conditionInput} onChange={(e) => setConditionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCondition())} placeholder="Add a requirement" />
                    <button type="button" onClick={addCondition}>Add</button>
                  </div>
                </div>
              </Field>

              <Field label="Skills" hint="Press Enter after each skill.">
                <div className="emp-post-skills">
                  {skills.map((s) => (
                    <span key={s} className="emp-post-skill">{s}<button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}><IconClose size={12} /></button></span>
                  ))}
                  <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} placeholder="Add a skill" />
                </div>
              </Field>
            </section>

            {projectMode === 'multi' && (
              <section className="emp-post-section">
                <h2>Roles</h2>
                <Field label="Work split" hint="Percentages must add up to 100% of the total budget.">
                  <div className="emp-post-roles">
                    {roles.map((r) => {
                      const amt = Math.round((Number(amount) || 0) * (Number(r.budgetPercent) || 0) / 100);
                      return (
                        <div key={r.key} className="emp-post-role-row">
                          <input
                            className="emp-post-input"
                            placeholder="Role name"
                            value={r.name}
                            onChange={(e) => updateRole(r.key, { name: e.target.value })}
                          />
                          <input
                            className="emp-post-input"
                            placeholder="What this role does"
                            value={r.description}
                            onChange={(e) => updateRole(r.key, { description: e.target.value })}
                          />
                          <input
                            className="emp-post-input emp-post-role-pct"
                            type="number"
                            min={0}
                            max={100}
                            value={r.budgetPercent}
                            onChange={(e) => updateRole(r.key, { budgetPercent: e.target.value })}
                            aria-label="Budget percent"
                          />
                          <span className="emp-post-role-amt">NPR {amt.toLocaleString('en-NP')}</span>
                          <button type="button" className="emp-post-role-remove" onClick={() => removeRole(r.key)} aria-label="Remove role">Remove</button>
                        </div>
                      );
                    })}
                    <button type="button" className="emp-post-add-role" onClick={addRole}>Add role</button>
                    <div className={`emp-post-budget-sum ${Math.round(rolePctSum) === 100 ? 'is-ok' : 'is-warn'}`}>
                      {Math.round(rolePctSum)}% allocated
                    </div>
                  </div>
                </Field>
              </section>
            )}

            <section className="emp-post-section">
              <h2>Pay and deadline</h2>
              <div className="emp-post-grid-2">
                <Field label="Budget">
                  {projectMode === 'single' && (
                    <div className="emp-post-seg">
                      <Seg active={budgetType === 'fixed'} onClick={() => setBudgetType('fixed')}>Fixed</Seg>
                      <Seg active={budgetType === 'hourly'} onClick={() => setBudgetType('hourly')}>Hourly</Seg>
                    </div>
                  )}
                  <div className="emp-post-input-wrap">
                    <span className="emp-post-input-prefix">NPR</span>
                    <input className="emp-post-input" value={budgetType === 'fixed' ? amount : hourly} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (budgetType === 'fixed') setAmount(v); else setHourly(v); }} placeholder={budgetType === 'fixed' ? '25000' : '800'} />
                  </div>
                </Field>
                <Field label="Application deadline">
                  <input type="date" className="emp-post-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="emp-post-section">
              <h2>Cover</h2>
              <Field label="Cover style">
                <div className="emp-post-seg">
                  <Seg active={coverMode === 'image'} onClick={() => setCoverMode('image')}>Image</Seg>
                  <Seg active={coverMode === 'text'} onClick={() => setCoverMode('text')}>Headline</Seg>
                </div>
                {coverMode === 'image' ? (
                  coverPreview ? (
                    <>
                      <div className="emp-post-cover-preview">
                        <img src={coverPreview} alt="Cover preview" />
                        <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(''); }} aria-label="Remove image"><IconClose size={14} /></button>
                      </div>
                      <div className="emp-post-cover-edit">
                        <button type="button" onClick={() => setCropSrc(coverPreview)}>Edit crop</button>
                        <button type="button" onClick={() => fileRef.current?.click()}>Replace</button>
                      </div>
                    </>
                  ) : (
                    <div className="emp-post-cover-drop" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleRawFile(e.dataTransfer.files[0]); }}>
                      <p>Drop an image or <span>browse</span></p>
                      <p className="emp-post-cover-drop__hint">PNG or JPG, up to 5MB</p>
                    </div>
                  )
                ) : (
                  <div>
                    <input className="emp-post-input emp-post-input--spaced" value={coverText} onChange={(e) => setCoverText(e.target.value)} placeholder="Cover headline (uses the job title if empty)" />
                    <JobCover job={previewJob} className="emp-post-cover-preview" textSize="job-cover__text--lg" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleRawFile(e.target.files?.[0])} />
              </Field>
            </section>
          </div>

          <aside className="emp-post-preview-pane">
            <div className="emp-post-preview-label"><IconEye size={13} /> Preview</div>
            <JobPreviewCard job={previewJob} organizationName={orgName} onClick={() => setPreviewOpen(true)} />
            <p className="emp-post-preview-hint">Click to see the applicant view.</p>
            <p className="emp-post-preview-meta">{[location, deadline ? `Closes ${fmtDeadline(deadline)}` : ''].filter(Boolean).join(' · ')}</p>
          </aside>
        </div>

        <div className="emp-post-footer">
          <p>{published ? 'Published on Explore jobs' : 'Drafts stay private until you publish'}</p>
          <div className="emp-post-footer__actions">
            <button type="button" className="emp-post-btn" disabled={loading} onClick={() => submit('draft')}>Save draft</button>
            <button type="button" className="emp-post-btn emp-post-btn--primary" disabled={loading} onClick={openPublishConfirm}>
              {loading ? 'Saving...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && <JobDetailModal job={previewJob} organizationName={orgName} onClose={() => setPreviewOpen(false)} previewOnly showApply={false} />}

      {confirmOpen && (
        <div className="confirm-publish-modal" role="presentation">
          <div className="confirm-publish-dialog" role="dialog" aria-modal="true">
            <h2>Ready to publish?</h2>
            <p>Review your listing before it goes live on the explore feed.</p>
            <div className="confirm-publish-preview">
              <h3>{title || 'Untitled role'}</h3>
              <p>{[categoryLabel, location, fmtBudget(previewJob)].filter(Boolean).join(' · ')}</p>
              <p className="confirm-publish-preview__desc">{description || 'No description added.'}</p>
            </div>
            <div className="confirm-publish-actions">
              <button type="button" className="emp-post-btn" onClick={() => setConfirmOpen(false)} disabled={loading}>Go back</button>
              <button type="button" className="emp-post-btn emp-post-btn--primary" onClick={() => submit('published')} disabled={loading}>
                {loading ? 'Publishing...' : 'Publish now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropSrc && (
        <ImageCropModal imageSrc={cropSrc} onCancel={() => setCropSrc('')} onSave={handleCropped} />
      )}

      {showSuccess && (
        <div className="publish-success-overlay">
          <div className="publish-success-card">
            <div className="publish-success-card__ring">✓</div>
            <h2>Job published!</h2>
            <p>Taking you to Check Status.</p>
          </div>
        </div>
      )}
    </EmployerLockedGate>
  );
}
