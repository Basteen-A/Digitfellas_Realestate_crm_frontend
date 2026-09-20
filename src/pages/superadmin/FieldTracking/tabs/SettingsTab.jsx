import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import { inputStyle, labelStyle, btn, Spinner } from '../ui';

// ============================================================
// Module settings - the master switch, which roles are tracked, the Google
// keys, and how long raw GPS points are kept.
//
// Requires field_tracking:full, because this is where the Google keys and
// therefore the billing exposure live.
// ============================================================

const Section = ({ title, hint, children }) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
    {hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5, maxWidth: 620 }}>{hint}</div> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 780 }}>
      {children}
    </div>
  </div>
);

// The index for the hub below. Kept next to the component rather than in ui.jsx
// because these are THIS screen's tab keys, and a stale entry here is a dead
// button - it should break where it is read.
const SETTING_LINKS = [
  { tab: 'locations', label: 'Punch Locations', hint: 'Where staff may punch from, each with its own radius and whether it is valid for punch-in, punch-out or both.' },
  { tab: 'policies', label: 'Shift Policies', hint: 'Hours, late grace, half-day rule, week-offs, punch mode, mock-location blocking and photo evidence.' },
  { tab: 'config', label: "Who's Tracked", hint: 'Which roles and which individual people are tracked, and the locations each may use.' },
  { tab: 'holidays', label: 'Holidays', hint: 'Company holidays, so a closed day is not counted as an absence.' },
];

const SettingsTab = ({ config, onSaved, onGoToTab }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fieldTrackingApi.getSettings();
        setSettings(resp.data || null);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load settings'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const resp = await fieldTrackingApi.updateSettings({
        is_enabled: settings.is_enabled,
        enabled_roles: settings.enabled_roles || [],
        maps_browser_key: settings.maps_browser_key || null,
        road_matching_enabled: Boolean(settings.road_matching_enabled),
        road_snap_max_per_run: Number(settings.road_snap_max_per_run) || 0,
        geocoding_server_key: settings.geocoding_server_key || null,
        geocoding_enabled: settings.geocoding_enabled,
        geocode_max_per_run: Number(settings.geocode_max_per_run) || 50,
        point_retention_days: Number(settings.point_retention_days) || 0,
        max_batch_points: Number(settings.max_batch_points) || 500,
        max_speed_mps: Number(settings.max_speed_mps) || 41.67,
      });
      setSettings(resp.data || settings);
      toast.success('Settings saved');
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (code) => {
    const current = settings.enabled_roles || [];
    setSettings({
      ...settings,
      enabled_roles: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    });
  };

  if (loading) return <Spinner />;
  if (!settings) return null;

  return (
    <form onSubmit={save} style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button type="submit" style={btn('primary')} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      {/* ── Master switch ── */}
      <div style={{
        background: settings.is_enabled ? 'rgba(22,163,74,0.06)' : 'var(--bg-secondary)',
        border: `1px solid ${settings.is_enabled ? 'rgba(22,163,74,0.3)' : 'var(--border-primary)'}`,
        borderRadius: 12, padding: 16, marginBottom: 24,
      }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(settings.is_enabled)} onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Field tracking is {settings.is_enabled ? 'ON' : 'OFF'}
          </span>
        </label>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginLeft: 26, lineHeight: 1.55 }}>
          While this is off nothing records, no punch screen appears in the mobile app, and all the
          background jobs are no-ops. The existing telecaller check-in under <b>Attendance</b> is a
          separate module and is not affected either way.
        </div>
      </div>

      <Section
        title="Which roles are tracked"
        hint="Only the roles selected here get the punch screen and GPS tracking. Super Admin and Admin are deliberately absent - they operate this module rather than being subjects of it, and cannot be added."
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(config?.roles || []).map((r) => {
              const on = (settings.enabled_roles || []).includes(r.code);
              return (
                <button key={r.id} type="button" onClick={() => toggleRole(r.code)} style={{ ...btn(on ? 'primary' : 'default'), padding: '6px 13px', fontSize: 12 }}>
                  {r.name} <span style={{ opacity: 0.7 }}>({r.code})</span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        title="Google Maps"
        hint="Two separate keys. Restrict both in the Google Cloud console - the browser key by HTTP referrer, the server key by IP."
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={labelStyle}>Browser key (maps on these screens)</div>
          <input
            value={settings.maps_browser_key || ''}
            onChange={(e) => setSettings({ ...settings, maps_browser_key: e.target.value })}
            placeholder="AIza…"
            style={inputStyle}
            autoComplete="off"
          />
          <div style={{ fontSize: 11, color: '#d97706', marginTop: 5, lineHeight: 1.5, display: 'flex', gap: 6 }}>
            <ExclamationTriangleIcon style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
            <span>
              This key is sent to the browser and is visible to anyone who opens this page - that is
              how all web maps keys work. Restrict it by HTTP referrer so it cannot be used elsewhere.
              Changing it needs a page reload to take effect.
            </span>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <div style={labelStyle}>Server key (reverse geocoding)</div>
          <input
            type="password"
            value={settings.geocoding_server_key || ''}
            onChange={(e) => setSettings({ ...settings, geocoding_server_key: e.target.value })}
            placeholder="AIza…"
            style={inputStyle}
            autoComplete="new-password"
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            Never leaves the server. Used only to turn halt coordinates into street addresses.
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(settings.geocoding_enabled)} onChange={(e) => setSettings({ ...settings, geocoding_enabled: e.target.checked })} />
            Resolve halt addresses automatically
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, marginLeft: 22, lineHeight: 1.5 }}>
            Off by default because each new stop costs a paid Google Geocoding call. An address is
            bought <b>once per halt</b> and stored forever, so the bill tracks new stops, not how often
            anyone opens a timeline. Without this, stops still show a known site name or raw coordinates.
          </div>
        </div>

        <div>
          <div style={labelStyle}>Max geocodes per run</div>
          <input
            type="number" min={1} max={1000}
            value={settings.geocode_max_per_run}
            onChange={(e) => setSettings({ ...settings, geocode_max_per_run: e.target.value })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Ceiling per 30-minute pass, so a backlog cannot become a surprise bill in one sweep.
          </div>
        </div>
      </Section>

      <Section title="Road matching (route accuracy)">
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(settings.road_matching_enabled)}
              onChange={(e) => setSettings({ ...settings, road_matching_enabled: e.target.checked })}
            />
            Snap routes to the road network
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, marginLeft: 22, lineHeight: 1.6 }}>
            Without this, a route is drawn as straight lines between GPS fixes. That
            cuts corners, crosses buildings, and <b>always reads short against a car
            odometer</b>. With it on, the fixes are sent to Google&apos;s Roads API and
            come back snapped onto the road centreline with the gaps filled in, and the
            distance is measured along that line instead.
            <br />
            Uses the same <b>server key</b> as geocoding above &mdash; the Roads API
            just has to be enabled on it. Billed per request, which is why it is off by
            default.
          </div>
          {settings.road_matching_enabled && !settings.geocoding_server_key ? (
            <div style={{
              fontSize: 11, color: '#b45309', background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8,
              padding: '8px 11px', marginTop: 8, marginLeft: 22,
            }}
            >
              No server key is set, so nothing will be snapped. Routes will keep drawing
              as straight lines until you add one above.
            </div>
          ) : null}
        </div>

        <div>
          <div style={labelStyle}>Max snap calls per run</div>
          <input
            type="number" min={0} max={500}
            value={settings.road_snap_max_per_run ?? 20}
            onChange={(e) => setSettings({ ...settings, road_snap_max_per_run: e.target.value })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Shared across every session in one worker pass, not per person. A day needs
            roughly one call per 100 GPS fixes. Days not reached are snapped on a later
            pass, so a low number slows matching down rather than losing it.
          </div>
        </div>
      </Section>

      {/* Everything that configures this module, in one place. The tabs are
          where the work happens; this is the index, because an admin setting the
          module up for the first time has no way to know that "Who's Tracked"
          is where per-person rules live. */}
      <Section title="All field tracking settings">
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {SETTING_LINKS.map((l) => (
            <button
              key={l.tab}
              type="button"
              onClick={() => onGoToTab?.(l.tab)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '12px 14px',
                borderRadius: 10, border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{l.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{l.hint}</div>
            </button>
          ))}
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            border: '1px dashed var(--border-primary)', background: 'transparent',
          }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Per-user overrides</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
              Also editable on each person directly, under Admin &rsaquo; Users &mdash;
              the same setting, reached from whichever screen you are already on.
            </div>
          </div>
        </div>
      </Section>

      <Section title="Data retention and ingest limits">
        <div>
          <div style={labelStyle}>Keep raw GPS points for (days)</div>
          <input
            type="number" min={0} max={3650}
            value={settings.point_retention_days}
            onChange={(e) => setSettings({ ...settings, point_retention_days: e.target.value })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            0 keeps everything. Only the raw dots are purged - the daily attendance rows, distances
            and halts are kept permanently, so old reports never change.
          </div>
        </div>
        <div>
          <div style={labelStyle}>Max points per upload</div>
          <input
            type="number" min={10} max={5000}
            value={settings.max_batch_points}
            onChange={(e) => setSettings({ ...settings, max_batch_points: e.target.value })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            A phone offline all day still has to be able to drain its queue.
          </div>
        </div>
        <div>
          <div style={labelStyle}>Implausible speed above (m/s)</div>
          <input
            type="number" min={1} max={500} step="0.01"
            value={settings.max_speed_mps}
            onChange={(e) => setSettings({ ...settings, max_speed_mps: e.target.value })}
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {Math.round((Number(settings.max_speed_mps) || 0) * 3.6)} km/h. Points implying more are
            kept but excluded from distance - that is what stops one bad cell-tower fix adding
            kilometres to somebody&apos;s day.
          </div>
        </div>
      </Section>
    </form>
  );
};

export default SettingsTab;
