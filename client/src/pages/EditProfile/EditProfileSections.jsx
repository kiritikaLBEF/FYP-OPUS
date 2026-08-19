import { getProfileUrl } from '../../services/api';
import { PROJECT_CATEGORIES, LINK_TYPES } from '../../utils/profileCompletion';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import TagInput from '../../components/profile/TagInput';
import {
  SettingsGroup,
  SettingsCard,
  SettingsRow,
  SettingsInput,
  SettingsSelect,
  SettingsTextarea,
  SettingsToggle,
  SettingsEmpty,
  SettingsAddButton,
  SubSectionCard,
  GENDER_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../../components/profile/SettingsUI';
import OpusBadge from '../../components/badges/OpusBadge';
import { downloadBadgeCertificate } from '../../components/badges/downloadBadgeCertificate';
import '../../components/badges/OpusBadge.css';

function CompactField({ label, hint, children }) {
  return (
    <div className="ep-field-compact">
      <label className="ep-field-compact__label">{label}</label>
      {hint && <span className="ep-field-compact__hint">{hint}</span>}
      {children}
    </div>
  );
}

export const toDateInput = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');

export function PanelHeader({ title, subtitle, icon: Icon }) {
  return (
    <header className="ep-panel__head">
      <div className="ep-panel__head-inner">
        {Icon && (
          <span className="ep-panel__head-icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        <div>
          <h2 className="ep-panel__title">{title}</h2>
          {subtitle && <p className="ep-panel__sub">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function PersonalSection({ form, set, meta, photoPreview, onPhoto, badges = [] }) {
  const showDegreeName = form.degree === 'Bachelor' || form.degree === 'Master';
  const avatar = photoPreview || `https://api.dicebear.com/7.x/avataaars/svg?seed=${form.username || 'opus'}`;

  return (
    <div className="ep-panel__body ep-panel__body--personal">
      <div className="ep-personal-grid">
        <SubSectionCard title="Identity" description="How you appear on OPUS">
          <div className="ep-identity-photo">
            <img src={avatar} alt="" className="ep-identity-photo__img" />
            <label className="ep-identity-photo__btn">
              <input type="file" accept="image/*" hidden onChange={onPhoto} />
              Change photo
            </label>
            {badges.length > 0 && (
              <div className="ep-identity-badges">
                {badges.map((badge) => (
                  <OpusBadge
                    key={badge.id}
                    badge={badge}
                    downloadable
                    recipientName={`${form.firstName || ''} ${form.lastName || ''}`.trim()}
                    onDownload={downloadBadgeCertificate}
                  />
                ))}
                <p className="ep-identity-badges__hint">Click a badge to save a certificate image</p>
              </div>
            )}
          </div>
          <div className="ep-field-stack">
            <CompactField label="First name">
              <SettingsInput value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="First name" />
            </CompactField>
            <CompactField label="Last name">
              <SettingsInput value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Last name" />
            </CompactField>
            <CompactField label="Username">
              <SettingsInput value={form.username} onChange={(e) => set('username', e.target.value.toLowerCase())} placeholder="your_username" />
            </CompactField>
            <CompactField label="Date of birth">
              <SettingsInput type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </CompactField>
            <CompactField label="Gender">
              <SettingsSelect value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SettingsSelect>
            </CompactField>
          </div>
        </SubSectionCard>

        <SubSectionCard title="Contact Information" description="How organizations can reach you">
          <div className="ep-field-stack">
            <CompactField label="Email" hint={form.emailReadOnly ? 'Managed by Google' : undefined}>
              <div className="ep-field-compact__row">
                <SettingsInput value={form.email} readOnly disabled />
                {form.emailReadOnly && <span className="ep-badge">Google</span>}
              </div>
            </CompactField>
            <CompactField label="Phone" hint="Include country code">
              <SettingsInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+977 98XXXXXXXX" />
            </CompactField>
            <CompactField label="Alternate contact">
              <SettingsInput value={form.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} placeholder="Optional" />
            </CompactField>
          </div>
        </SubSectionCard>

        <SubSectionCard title="Location" description="Where you're based">
          <div className="ep-field-stack">
            <CompactField label="Country">
              <SettingsInput value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Nepal" />
            </CompactField>
            <CompactField label="State / Province">
              <SettingsInput value={form.stateProvince} onChange={(e) => set('stateProvince', e.target.value)} placeholder="Bagmati" />
            </CompactField>
            <CompactField label="City">
              <SettingsInput value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Kathmandu" />
            </CompactField>
            <CompactField label="Address">
              <SettingsInput value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
            </CompactField>
            <CompactField label="Postal code">
              <SettingsInput value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="44600" />
            </CompactField>
            <CompactField label="Timezone">
              <SettingsSelect value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SettingsSelect>
            </CompactField>
          </div>
        </SubSectionCard>

        <SubSectionCard title="Education" description="Your academic background">
          <div className="ep-field-stack">
            <CompactField label="Institution">
              <SettingsInput value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} placeholder="School or college name" />
            </CompactField>
            <CompactField label="Degree">
              <SettingsSelect value={form.degree} onChange={(e) => set('degree', e.target.value)}>
                <option value="">Select degree</option>
                {(meta.degrees || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </SettingsSelect>
            </CompactField>
            {showDegreeName && (
              <CompactField label="Field of study">
                <SettingsInput value={form.degreeName} onChange={(e) => set('degreeName', e.target.value)} placeholder="e.g. BSc CSIT" />
              </CompactField>
            )}
            {!form.stillRunning && (
              <CompactField label="Graduation year">
                <SettingsSelect value={form.passoutYear} onChange={(e) => set('passoutYear', e.target.value)}>
                  <option value="">Select year</option>
                  {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </SettingsSelect>
              </CompactField>
            )}
            <label className="ep-inline-check">
              <input type="checkbox" checked={form.stillRunning} onChange={(e) => set('stillRunning', e.target.checked)} />
              <span>Currently studying</span>
            </label>
          </div>
        </SubSectionCard>
      </div>
    </div>
  );
}

export function ProfessionalSection({ form, set }) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup title="Professional summary" description="Highlight your experience, expertise, and what you bring to projects.">
        <SettingsCard>
          <div className="ep-settings-block">
            <SettingsTextarea
              value={form.professionalSummary}
              onChange={(e) => set('professionalSummary', e.target.value)}
              placeholder="Describe your experience, strengths, and areas of expertise."
              rows={5}
              maxLength={2000}
              hint="At least 20 characters recommended."
            />
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Interests & focus areas" description="Topics and domains you're passionate about.">
        <SettingsCard>
          <TagInput tags={form.interests} onChange={(v) => set('interests', v)} placeholder="Design, startups, open source…" />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

export function SkillsSection({ form, set }) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup title="Your skills" description="Technical abilities and tools that define your work. Employers use these to match you with gigs.">
        <SettingsCard>
          <TagInput tags={form.skills} onChange={(v) => set('skills', v)} placeholder="e.g. UI/UX, MERN Stack, Python, Figma" />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

export function CertificationsSection({
  form, certForm, setCertForm, showCertForm, setShowCertForm, submitCert, onDelete,
}) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup
        title="Credentials"
        description={`${form.certifications.length} certification${form.certifications.length !== 1 ? 's' : ''} on your profile.`}
      >
        {form.certifications.length === 0 && !showCertForm ? (
          <SettingsEmpty
            title="No certifications yet"
            description="Add credentials, courses, or licenses to strengthen your profile."
            action={<SettingsAddButton onClick={() => setShowCertForm(true)}>Add certification</SettingsAddButton>}
          />
        ) : (
          <div className="ep-cert-grid">
            {form.certifications.map((c) => (
              <article key={c._id} className="ep-cert-card">
                <div className="ep-cert-card__badge" aria-hidden="true">✓</div>
                <h3 className="ep-cert-card__name">{c.name}</h3>
                <p className="ep-cert-card__org">{c.organization}</p>
                {c.issueDate && <p className="ep-cert-card__date">Issued {toDateInput(c.issueDate)}</p>}
                <div className="ep-cert-card__actions">
                  {c.filePath && (
                    <a href={getProfileUrl(c.filePath)} target="_blank" rel="noreferrer" className="ep-cert-card__link">View file</a>
                  )}
                  <button type="button" className="ep-cert-card__remove" onClick={() => onDelete(c._id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SettingsGroup>

      {showCertForm ? (
        <SettingsGroup title="New certification">
          <form className="ep-form-sheet" onSubmit={submitCert}>
            <SettingsCard>
              <SettingsRow label="Name" hint="Required">
                <SettingsInput value={certForm.name} onChange={(e) => setCertForm({ ...certForm, name: e.target.value })} required />
              </SettingsRow>
              <SettingsRow label="Organization">
                <SettingsInput value={certForm.organization} onChange={(e) => setCertForm({ ...certForm, organization: e.target.value })} />
              </SettingsRow>
              <SettingsRow label="Issue date">
                <SettingsInput type="date" value={certForm.issueDate} onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })} />
              </SettingsRow>
              <SettingsRow label="Expiration date">
                <SettingsInput type="date" value={certForm.expirationDate} onChange={(e) => setCertForm({ ...certForm, expirationDate: e.target.value })} />
              </SettingsRow>
              <SettingsRow label="Credential ID">
                <SettingsInput value={certForm.credentialId} onChange={(e) => setCertForm({ ...certForm, credentialId: e.target.value })} />
              </SettingsRow>
              <SettingsRow label="Credential URL">
                <SettingsInput type="url" value={certForm.credentialUrl} onChange={(e) => setCertForm({ ...certForm, credentialUrl: e.target.value })} placeholder="https://" />
              </SettingsRow>
              <SettingsRow label="Certificate file" hint="PDF or image">
                <input className="ep-file-input" type="file" accept="image/*,.pdf" onChange={(e) => setCertForm({ ...certForm, file: e.target.files?.[0] })} />
              </SettingsRow>
            </SettingsCard>
            <div className="ep-form-sheet__actions">
              <button type="button" className="mac-btn mac-btn--ghost" onClick={() => setShowCertForm(false)}>Cancel</button>
              <button type="submit" className="mac-btn mac-btn--filled">Add certification</button>
            </div>
          </form>
        </SettingsGroup>
      ) : form.certifications.length > 0 && (
        <SettingsAddButton onClick={() => setShowCertForm(true)}>Add another certification</SettingsAddButton>
      )}
    </div>
  );
}

export function ProjectsSection({
  form, projectForm, setProjectForm, showProjectForm, setShowProjectForm, submitProject, onDelete,
}) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup
        title="Portfolio"
        description={`${form.projects.length} project${form.projects.length !== 1 ? 's' : ''} showcasing your work.`}
      >
        {form.projects.length === 0 && !showProjectForm ? (
          <SettingsEmpty
            title="Your portfolio is empty"
            description="Showcase coding projects, designs, research, and creative work."
            action={<SettingsAddButton onClick={() => setShowProjectForm(true)}>Add project</SettingsAddButton>}
          />
        ) : (
          <div className="ep-portfolio-grid">
            {form.projects.map((p) => (
              <article key={p._id} className="ep-portfolio-card">
                <div className="ep-portfolio-card__media">
                  {p.thumbnail ? (
                    <img src={getProfileUrl(p.thumbnail)} alt="" />
                  ) : (
                    <div className="ep-portfolio-card__placeholder">
                      <span>{PROJECT_CATEGORIES.find((c) => c.value === p.category)?.label?.[0] || 'P'}</span>
                    </div>
                  )}
                  <span className="ep-portfolio-card__cat">{PROJECT_CATEGORIES.find((c) => c.value === p.category)?.label || p.category}</span>
                </div>
                <div className="ep-portfolio-card__body">
                  <h3>{p.title}</h3>
                  <p>{p.description?.slice(0, 100)}{p.description?.length > 100 ? '…' : ''}</p>
                  {(p.technologies || []).length > 0 && (
                    <div className="ep-portfolio-card__tech">
                      {p.technologies.slice(0, 4).map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}
                  {p.links?.length > 0 && (
                    <div className="ep-portfolio-card__links">
                      {p.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noreferrer">{LINK_TYPES.find((x) => x.value === l.type)?.label || 'Link'}</a>
                      ))}
                    </div>
                  )}
                  <button type="button" className="ep-portfolio-card__remove" onClick={() => onDelete(p._id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SettingsGroup>

      {showProjectForm ? (
        <SettingsGroup title="New project">
          <form className="ep-form-sheet" onSubmit={submitProject}>
            <SettingsCard>
              <SettingsRow label="Title" hint="Required">
                <SettingsInput value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} required />
              </SettingsRow>
              <div className="ep-settings-block">
                <label className="ep-settings-block__label">Description</label>
                <SettingsTextarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} rows={3} />
              </div>
              <SettingsRow label="Category">
                <SettingsSelect value={projectForm.category} onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}>
                  {PROJECT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </SettingsSelect>
              </SettingsRow>
              <SettingsRow label="Completion date">
                <SettingsInput type="date" value={projectForm.completionDate} onChange={(e) => setProjectForm({ ...projectForm, completionDate: e.target.value })} />
              </SettingsRow>
              <SettingsRow label="Technologies" hint="Comma separated">
                <SettingsInput value={projectForm.technologies} onChange={(e) => setProjectForm({ ...projectForm, technologies: e.target.value })} placeholder="React, Node.js, Figma" />
              </SettingsRow>
              {projectForm.links.map((link, i) => (
                <SettingsRow key={i} label={`Link ${i + 1}`}>
                  <div className="ep-link-pair">
                    <SettingsSelect value={link.type} onChange={(e) => { const links = [...projectForm.links]; links[i].type = e.target.value; setProjectForm({ ...projectForm, links }); }}>
                      {LINK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </SettingsSelect>
                    <SettingsInput value={link.url} onChange={(e) => { const links = [...projectForm.links]; links[i].url = e.target.value; setProjectForm({ ...projectForm, links }); }} placeholder="https://" />
                  </div>
                </SettingsRow>
              ))}
              <button type="button" className="ep-text-btn" onClick={() => setProjectForm({ ...projectForm, links: [...projectForm.links, { type: 'other', url: '' }] })}>+ Add another link</button>
              <SettingsRow label="Thumbnail">
                <input className="ep-file-input" type="file" accept="image/*" onChange={(e) => setProjectForm({ ...projectForm, thumbnail: e.target.files?.[0] })} />
              </SettingsRow>
              <SettingsRow label="Screenshots">
                <input className="ep-file-input" type="file" accept="image/*" multiple onChange={(e) => setProjectForm({ ...projectForm, screenshots: [...e.target.files] })} />
              </SettingsRow>
              <SettingsRow label="Files">
                <input className="ep-file-input" type="file" multiple onChange={(e) => setProjectForm({ ...projectForm, files: [...e.target.files] })} />
              </SettingsRow>
            </SettingsCard>
            <div className="ep-form-sheet__actions">
              <button type="button" className="mac-btn mac-btn--ghost" onClick={() => setShowProjectForm(false)}>Cancel</button>
              <button type="submit" className="mac-btn mac-btn--filled">Add project</button>
            </div>
          </form>
        </SettingsGroup>
      ) : form.projects.length > 0 && (
        <SettingsAddButton onClick={() => setShowProjectForm(true)}>Add another project</SettingsAddButton>
      )}
    </div>
  );
}

export function PreferencesSection({ form, set }) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup title="Notifications" description="Choose how OPUS keeps you informed.">
        <SettingsCard>
          <SettingsToggle label="Email updates" hint="Product news and platform updates" checked={form.notificationPreferences?.emailUpdates} onChange={(e) => set('notificationPreferences', { ...form.notificationPreferences, emailUpdates: e.target.checked })} />
          <SettingsToggle label="Job alerts" hint="New gigs matching your skills" checked={form.notificationPreferences?.jobAlerts} onChange={(e) => set('notificationPreferences', { ...form.notificationPreferences, jobAlerts: e.target.checked })} />
          <SettingsToggle label="Forum replies" hint="When someone replies to your posts" checked={form.notificationPreferences?.forumReplies} onChange={(e) => set('notificationPreferences', { ...form.notificationPreferences, forumReplies: e.target.checked })} />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Regional" description="Language and localization preferences.">
        <SettingsCard>
          <SettingsRow label="Language">
            <SettingsSelect value={form.language} onChange={(e) => set('language', e.target.value)}>
              <option value="en">English</option>
              <option value="ne">Nepali</option>
            </SettingsSelect>
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

export function PrivacySection({ form, set, pwd, setPwd, onPasswordChange, hasPassword }) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup title="Visibility" description="Control who can see your profile information.">
        <SettingsCard>
          <SettingsToggle label="Profile visible to organizations" hint="Allow employers to discover your profile" checked={form.privacySettings?.profileVisible} onChange={(e) => set('privacySettings', { ...form.privacySettings, profileVisible: e.target.checked })} />
          <SettingsToggle label="Show email on public profile" hint="Display your email to organizations" checked={form.privacySettings?.showEmail} onChange={(e) => set('privacySettings', { ...form.privacySettings, showEmail: e.target.checked })} />
        </SettingsCard>
      </SettingsGroup>

      {hasPassword && (
        <SettingsGroup title="Password" description="Update your account password.">
          <form onSubmit={onPasswordChange}>
            <SettingsCard>
              <div className="ep-settings-block">
                <PasswordInput id="cur-pwd" label="Current password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} placeholder="Current password" autoComplete="current-password" />
              </div>
              <div className="ep-settings-block">
                <PasswordInput id="new-pwd" label="New password" value={pwd.newPass} onChange={(e) => setPwd({ ...pwd, newPass: e.target.value })} placeholder="New password" autoComplete="new-password" />
              </div>
              <div className="ep-settings-block">
                <PasswordInput id="conf-pwd" label="Confirm password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} placeholder="Confirm" autoComplete="new-password" />
              </div>
            </SettingsCard>
            <div className="ep-form-sheet__actions">
              <button type="submit" className="mac-btn mac-btn--filled">Update password</button>
            </div>
          </form>
        </SettingsGroup>
      )}
    </div>
  );
}

export function AccountSection({ onDelete }) {
  return (
    <div className="ep-panel__body">
      <SettingsGroup title="Danger zone" description="Irreversible actions for your account.">
        <SettingsCard className="ep-danger-zone">
          <div className="ep-danger-zone__content">
            <p className="ep-danger-zone__title">Delete account</p>
            <p className="ep-danger-zone__desc">Permanently remove your OPUS account and all associated data. This cannot be undone.</p>
          </div>
          <button type="button" className="ep-danger-btn" onClick={onDelete}>Delete account</button>
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
