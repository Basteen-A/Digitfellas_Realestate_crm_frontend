import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  CalendarDaysIcon, SignalIcon, MapIcon, MapPinIcon, ClockIcon,
  UserGroupIcon, ChartBarIcon, Cog6ToothIcon, SunIcon, UserPlusIcon,
  Squares2X2Icon, TableCellsIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../utils/helpers';
import { hasModule } from '../../../utils/modulePermissions';
import { Spinner } from './ui';
import DashboardTab from './tabs/DashboardTab';
import DayViewTab from './tabs/DayViewTab';
import AttendanceGridTab from './tabs/AttendanceGridTab';
import PlansTab from './tabs/PlansTab';
import LiveTab from './tabs/LiveTab';
import TimelineTab from './tabs/TimelineTab';
import LocationsTab from './tabs/LocationsTab';
import PoliciesTab from './tabs/PoliciesTab';
import ConfigTab from './tabs/ConfigTab';
import HolidaysTab from './tabs/HolidaysTab';
import VisitsTab from './tabs/VisitsTab';
import ReportsTab from './tabs/ReportsTab';
import SettingsTab from './tabs/SettingsTab';

// ============================================================
// Attendance & Field Tracking - the admin surface for the whole module.
//
// Separate from the Attendance page (/super-admin/attendance), which is the
// telecaller check-in gate that controls lead allocation. This screen is about
// where field staff went and how long they worked. Nothing is shared.
// ============================================================

const TABS = [
  // Dashboard first: it is the screen that answers "how is today going", and
  // the other monitoring tabs are the drill-downs behind it.
  { key: 'dashboard', label: 'Dashboard', icon: Squares2X2Icon, level: 'read' },
  { key: 'day', label: 'Day View', icon: CalendarDaysIcon, level: 'read' },
  { key: 'grid', label: 'Attendance Grid', icon: TableCellsIcon, level: 'read' },
  { key: 'live', label: 'Live Map', icon: SignalIcon, level: 'read' },
  { key: 'timeline', label: 'Route Timeline', icon: MapIcon, level: 'read' },
  { key: 'visits', label: 'Customer Visits', icon: UserPlusIcon, level: 'read' },
  { key: 'plan', label: 'Beat Plan', icon: ClipboardDocumentListIcon, level: 'read' },
  { key: 'reports', label: 'Reports', icon: ChartBarIcon, level: 'read' },
  { key: 'locations', label: 'Locations', icon: MapPinIcon, level: 'read' },
  { key: 'policies', label: 'Shift Policies', icon: ClockIcon, level: 'read' },
  { key: 'config', label: "Who's Tracked", icon: UserGroupIcon, level: 'read' },
  { key: 'holidays', label: 'Holidays', icon: SunIcon, level: 'read' },
  { key: 'settings', label: 'Settings', icon: Cog6ToothIcon, level: 'full' },
];

const FieldTrackingPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [tab, setTab] = useState('dashboard');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  // Handed from Day View / Live to the Timeline tab when Route is clicked.
  const [selected, setSelected] = useState(null);

  const canWrite = hasModule(user, 'field_tracking', 'write', false);
  const canDelete = hasModule(user, 'field_tracking', 'full', false);
  const canSettings = hasModule(user, 'field_tracking', 'full', false);

  const loadConfig = useCallback(async () => {
    try {
      const resp = await fieldTrackingApi.getConfig();
      setConfig(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the tracking configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const openTimeline = (u, date) => {
    setSelected({ user: u, date });
    setTab('timeline');
  };

  const visibleTabs = TABS.filter((t) => (t.level === 'full' ? canSettings : true));

  if (loading) return <Spinner label="Loading field tracking…" />;

  return (
    <div style={{ padding: '20px 24px 40px' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 6 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Attendance &amp; Field Tracking
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Punch in / punch out, GPS route timelines, halts, distance and attendance reports for field staff.
        </div>
      </div>

      {/* ── Module-off banner ── */}
      {!config?.isEnabled ? (
        <div style={{
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)',
          borderRadius: 10, padding: '12px 16px', margin: '16px 0', fontSize: 13, color: '#b45309',
        }}
        >
          <b>Field tracking is switched off.</b>{' '}
          {canSettings
            ? 'Nothing is being recorded and the punch screen does not appear in the mobile app. Turn it on under the Settings tab and choose which roles it applies to.'
            : 'Nothing is being recorded. A Super Admin can turn it on from the Settings tab.'}
        </div>
      ) : null}

      {config?.isEnabled && !(config?.enabledRoles || []).length ? (
        <div style={{
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)',
          borderRadius: 10, padding: '12px 16px', margin: '16px 0', fontSize: 13, color: '#b45309',
        }}
        >
          <b>No roles are selected.</b> The module is on, but until at least one role is chosen under
          Settings nobody sees the punch screen.
        </div>
      ) : null}

      {!config?.mapsBrowserKey ? (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 10, padding: '12px 16px', margin: '16px 0', fontSize: 12, color: 'var(--text-muted)',
        }}
        >
          No Google Maps key is configured, so maps will not render. Everything else - punching,
          distance, halts and reports - works without one.
          {canSettings ? ' Add a browser key under Settings.' : ''}
        </div>
      ) : null}

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 2, marginTop: 18, marginBottom: 20,
        borderBottom: '1px solid var(--border-primary)', overflowX: 'auto',
      }}
      >
        {visibleTabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 14px',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent-primary, #625afa)' : 'transparent'}`,
                background: 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}
            >
              <t.icon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Panels ── */}
      {tab === 'dashboard' ? <DashboardTab config={config} onOpenTimeline={openTimeline} /> : null}
      {tab === 'day' ? <DayViewTab config={config} onOpenTimeline={openTimeline} /> : null}
      {tab === 'grid' ? <AttendanceGridTab config={config} /> : null}
      {tab === 'plan' ? <PlansTab config={config} /> : null}
      {tab === 'live' ? <LiveTab config={config} onOpenTimeline={openTimeline} /> : null}
      {tab === 'timeline' ? <TimelineTab config={config} selected={selected} onClearSelection={() => setSelected(null)} /> : null}
      {tab === 'visits' ? <VisitsTab config={config} onOpenTimeline={openTimeline} /> : null}
      {tab === 'reports' ? <ReportsTab config={config} /> : null}
      {tab === 'locations' ? <LocationsTab config={config} canWrite={canWrite} canDelete={canDelete} /> : null}
      {tab === 'policies' ? <PoliciesTab canWrite={canWrite} canDelete={canDelete} /> : null}
      {tab === 'config' ? <ConfigTab config={config} canWrite={canWrite} /> : null}
      {tab === 'holidays' ? <HolidaysTab config={config} canWrite={canWrite} canDelete={canDelete} /> : null}
      {tab === 'settings' && canSettings ? <SettingsTab config={config} onSaved={loadConfig} /> : null}
    </div>
  );
};

export default FieldTrackingPage;
