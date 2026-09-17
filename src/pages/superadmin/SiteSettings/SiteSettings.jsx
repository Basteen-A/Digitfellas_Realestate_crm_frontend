import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import siteSettingsApi from '../../../api/siteSettingsApi';
import { useSiteSettings } from '../../../contexts/SiteSettingsContext';
import './SiteSettings.css';

// Logos are stored inline as base64, so keep the source files small.
const MAX_FILE_BYTES = 400 * 1024; // 400 KB

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const LOGO_FIELDS = [
  {
    key: 'logo_full',
    label: 'Expanded logo (wordmark)',
    hint: 'Shown when the sidebar is expanded and on the login screen. Wide logo works best.',
    preview: 'wide',
  },
  {
    key: 'logo_mark',
    label: 'Collapsed icon (square mark)',
    hint: 'Shown on the collapsed sidebar rail. Use a small square icon / favicon.',
    preview: 'square',
  },
  {
    key: 'favicon',
    label: 'Browser favicon (optional)',
    hint: 'Shown on the browser tab. Square PNG/ICO recommended.',
    preview: 'square',
  },
];

const SiteSettings = () => {
  const { refresh } = useSiteSettings();

  const [form, setForm] = useState({
    site_name: '', logo_full: '', logo_mark: '', favicon: '',
    mobile_password_login: false, web_login_identifier: 'email',
    mobile_latest_version: '', mobile_min_version: '', mobile_apk_url: '', mobile_update_notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputs = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const resp = await siteSettingsApi.get();
      const s = resp?.data || {};
      setForm({
        site_name: s.site_name || '',
        logo_full: s.logo_full || '',
        logo_mark: s.logo_mark || '',
        favicon: s.favicon || '',
        mobile_password_login: s.mobile_password_login === true,
        web_login_identifier: s.web_login_identifier || 'email',
        mobile_latest_version: s.mobile_latest_version || '',
        mobile_min_version: s.mobile_min_version || '',
        mobile_apk_url: s.mobile_apk_url || '',
        mobile_update_notes: s.mobile_update_notes || '',
      });
    } catch (err) {
      toast.error('Failed to load site settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFile = async (key, file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Image too large - keep it under 400 KB');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((p) => ({ ...p, [key]: dataUrl }));
    } catch {
      toast.error('Could not read that image');
    }
  };

  const clearLogo = (key) => {
    setForm((p) => ({ ...p, [key]: '' }));
    if (fileInputs.current[key]) fileInputs.current[key].value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Send empty string to clear a logo (server maps it to null → default).
      await siteSettingsApi.update({
        site_name: form.site_name.trim(),
        logo_full: form.logo_full || '',
        logo_mark: form.logo_mark || '',
        favicon: form.favicon || '',
        mobile_password_login: form.mobile_password_login === true,
        web_login_identifier: form.web_login_identifier || 'email',
        mobile_latest_version: (form.mobile_latest_version || '').trim(),
        mobile_min_version: (form.mobile_min_version || '').trim(),
        mobile_apk_url: (form.mobile_apk_url || '').trim(),
        mobile_update_notes: (form.mobile_update_notes || '').trim(),
      });
      toast.success('Site settings saved');
      await refresh(); // re-brands sidebars / topbar / login instantly
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save site settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="site-settings">
        <div className="site-settings__loading">Loading site settings…</div>
      </section>
    );
  }

  return (
    <section className="site-settings">
      <header className="site-settings__header">
        <div>
          <h1>Site Settings</h1>
          <p>Brand the whole CRM - name and logos here update every sidebar, the page header and the login screen for all users.</p>
        </div>
      </header>

      <form className="site-settings__form" onSubmit={handleSave}>
        {/* Site name */}
        <div className="site-settings__card">
          <label className="site-settings__label" htmlFor="site-name">Site name <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b7280)' }}>(optional)</span></label>
          <input
            id="site-name"
            type="text"
            className="site-settings__input"
            value={form.site_name}
            maxLength={120}
            placeholder="e.g. Sujatha Realty CRM"
            onChange={(e) => setForm((p) => ({ ...p, site_name: e.target.value }))}
          />
          <div className="site-settings__hint">Appears in the top bar, under the sidebar logo, and on the browser tab. Leave blank to show the logo only.</div>
        </div>

        {/* Web login identity */}
        <div className="site-settings__card">
          <div className="site-settings__label">Web login</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {[
              { value: 'email', label: 'Email address only', hint: 'Users sign in with their email - the default.' },
              { value: 'username', label: 'Login ID only', hint: 'Users sign in with their Login ID (e.g. ramesh.TC), the same one the mobile app uses.' },
              { value: 'both', label: 'Either one', hint: 'A single field that accepts an email address or a Login ID.' },
            ].map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '9px 11px', borderRadius: 9, fontSize: 14,
                  border: `1px solid ${form.web_login_identifier === opt.value ? 'var(--accent-blue, #4f46e5)' : 'var(--border-primary, #e5e7eb)'}`,
                  background: form.web_login_identifier === opt.value ? 'var(--bg-accent-soft, #eef2ff)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="web_login_identifier"
                  value={opt.value}
                  checked={form.web_login_identifier === opt.value}
                  onChange={() => setForm((p) => ({ ...p, web_login_identifier: opt.value }))}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="site-settings__hint">
            Sets what the sign-in field on the web login page accepts, and how it is labelled.
            The password is always required. Login ID options are refused while any active user
            still has no Login ID, so nobody can be locked out.
          </div>
        </div>

        {/* Mobile app login fallback */}
        <div className="site-settings__card">
          <div className="site-settings__label">Mobile app login</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={form.mobile_password_login}
              onChange={(e) => setForm((p) => ({ ...p, mobile_password_login: e.target.checked }))}
            />
            Allow password login in the mobile app
          </label>
          <div className="site-settings__hint">
            The app signs users in with a WhatsApp OTP sent to their registered phone (Login ID like
            ramesh.TC). Turn this on only if OTPs cannot be delivered - it adds a "Login with password"
            option on the app's login screen.
          </div>
        </div>

        {/* Mobile app update prompt */}
        <div className="site-settings__card">
          <div className="site-settings__label">Mobile app update</div>
          <div className="site-settings__hint" style={{ marginTop: 0, marginBottom: 10 }}>
            The app has no store to update from, so it checks these on launch and tells people itself.
            Leave both versions blank and it never prompts.
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className="site-settings__label" htmlFor="mobile-latest" style={{ fontSize: 13 }}>Latest version</label>
              <input
                id="mobile-latest"
                type="text"
                className="site-settings__input"
                placeholder="0.4"
                value={form.mobile_latest_version}
                onChange={(e) => setForm((p) => ({ ...p, mobile_latest_version: e.target.value }))}
              />
              <div className="site-settings__hint">Shows a prompt people can dismiss.</div>
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="site-settings__label" htmlFor="mobile-min" style={{ fontSize: 13 }}>Minimum version</label>
              <input
                id="mobile-min"
                type="text"
                className="site-settings__input"
                placeholder="blank = no block"
                value={form.mobile_min_version}
                onChange={(e) => setForm((p) => ({ ...p, mobile_min_version: e.target.value }))}
              />
              <div className="site-settings__hint">Anything older is BLOCKED out of the app.</div>
            </div>
          </div>

          <label className="site-settings__label" htmlFor="mobile-apk" style={{ fontSize: 13, marginTop: 12, display: 'block' }}>APK link</label>
          <input
            id="mobile-apk"
            type="url"
            className="site-settings__input"
            placeholder="https://..."
            value={form.mobile_apk_url}
            onChange={(e) => setForm((p) => ({ ...p, mobile_apk_url: e.target.value }))}
          />
          <div className="site-settings__hint">Where the Update button sends them - the EAS build link, or your own hosted APK.</div>

          <label className="site-settings__label" htmlFor="mobile-notes" style={{ fontSize: 13, marginTop: 12, display: 'block' }}>What&apos;s new <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b7280)' }}>(optional)</span></label>
          <input
            id="mobile-notes"
            type="text"
            className="site-settings__input"
            maxLength={500}
            placeholder="Faster reports, call recording fixes"
            value={form.mobile_update_notes}
            onChange={(e) => setForm((p) => ({ ...p, mobile_update_notes: e.target.value }))}
          />
          <div className="site-settings__hint">
            Set the minimum only when an old build genuinely must stop working - it locks those users
            out until they install the new APK.
          </div>
        </div>

        {/* Logos */}
        <div className="site-settings__logos">
          {LOGO_FIELDS.map((f) => (
            <div key={f.key} className="site-settings__card">
              <div className="site-settings__label">{f.label}</div>
              <div className={`site-settings__preview site-settings__preview--${f.preview}`}>
                {form[f.key]
                  ? <img src={form[f.key]} alt={f.label} />
                  : <span className="site-settings__preview-empty">Using default</span>}
              </div>
              <div className="site-settings__file-row">
                <input
                  ref={(el) => { fileInputs.current[f.key] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon"
                  onChange={(e) => handleFile(f.key, e.target.files?.[0])}
                />
                {form[f.key] && (
                  <button type="button" className="site-settings__clear" onClick={() => clearLogo(f.key)}>
                    Clear
                  </button>
                )}
              </div>
              <div className="site-settings__hint">{f.hint}</div>
            </div>
          ))}
        </div>

        <div className="site-settings__actions">
          <button type="button" className="site-settings__btn site-settings__btn--ghost" onClick={load} disabled={saving}>
            Reset
          </button>
          <button type="submit" className="site-settings__btn site-settings__btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default SiteSettings;
