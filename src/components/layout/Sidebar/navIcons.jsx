// ============================================================
// SIDEBAR NAV ICONS — admin / super-admin
//
// Inline SVGs lifted verbatim from the approved IA mockup
// (`sidebar-final-structure (2).html`). That mockup ships its own 24×24 outline
// set at stroke-width 1.7 — a Tabler-flavoured look the Heroicons used elsewhere
// in the app do not match — so the sidebar renders the exact glyphs that were
// signed off rather than a near-miss substitute.
//
// Sizing comes from the `sidebar-icon*` CSS classes exactly as it does for a
// Heroicon, so these drop straight into `<MenuIcon icon={...} />` with no other
// change. Only the icons the admin menu actually uses are defined here; the
// other role portals keep their Heroicons.
// ============================================================
import React from 'react';

/** Shared frame — every icon is the same box, stroke and join as the mockup. */
const Svg = ({ className = 'sidebar-icon', children, ...props }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

// ── Section / group icons ──
export const NavHome = (props) => (
  <Svg {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11h14V9" />
    <path d="M9.5 20v-6h5v6" />
  </Svg>
);

export const NavUsers = (props) => (
  <Svg {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M15 14.3c2.6.4 4.5 2.4 4.5 5.7" />
  </Svg>
);

export const NavSettings = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
  </Svg>
);

// ── Item icons ──
export const NavLayoutGrid = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.2" />
  </Svg>
);

export const NavClipboardList = (props) => (
  <Svg {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <rect x="9" y="2.5" width="6" height="3" rx="1" />
    <path d="M8 10h8M8 14h8M8 18h5" />
  </Svg>
);

export const NavCalendar = (props) => (
  <Svg {...props}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
);

export const NavFileText = (props) => (
  <Svg {...props}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 15.5h6M9 8.5h2" />
  </Svg>
);

export const NavBuildingWarehouse = (props) => (
  <Svg {...props}>
    <path d="M3 21V10l9-6 9 6v11" />
    <path d="M3 21h18" />
    <path d="M9 21v-6h6v6" />
  </Svg>
);

export const NavBuilding = (props) => (
  <Svg {...props}>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    <path d="M10 21v-4h4v4" />
  </Svg>
);

export const NavMapPin = (props) => (
  <Svg {...props}>
    <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </Svg>
);

export const NavWallet = (props) => (
  <Svg {...props}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
    <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
    <path d="M15.5 13.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />
  </Svg>
);

export const NavCreditCard = (props) => (
  <Svg {...props}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <path d="M7 14.5h4" />
  </Svg>
);

export const NavChartBar = (props) => (
  <Svg {...props}>
    <path d="M4 21V10M11 21V4M18 21v-7" />
    <path d="M2.5 21h19" />
  </Svg>
);

export const NavTrophy = (props) => (
  <Svg {...props}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
    <path d="M6 5H4a2 2 0 0 0 2 4M18 5h2a2 2 0 0 1-2 4" />
    <path d="M10 15v2M14 15v2M8 21h8M9 17h6l1 4H8z" />
  </Svg>
);

export const NavSpeakerphone = (props) => (
  <Svg {...props}>
    <path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M14 9a3 3 0 0 1 0 6M16.5 6.5a6.5 6.5 0 0 1 0 11" />
  </Svg>
);

export const NavPhone = (props) => (
  <Svg {...props}>
    <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V17a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.2 2 2 0 0 1 5 4Z" />
  </Svg>
);

export const NavArrowsExchange = (props) => (
  <Svg {...props}>
    <path d="M4 8h13l-3-3M4 8l3 3" />
    <path d="M20 16H7l3 3M20 16l-3 3" />
  </Svg>
);

export const NavRefresh = (props) => (
  <Svg {...props}>
    <path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2" />
    <path d="M18 3.5V7h-3.5M6 20.5V17h3.5" />
  </Svg>
);

export const NavShield = (props) => (
  <Svg {...props}>
    <path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6Z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

export const NavAdjustments = (props) => (
  <Svg {...props}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M20 18h0" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
);

export const NavRoute = (props) => (
  <Svg {...props}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="M5 8v3a3 3 0 0 0 3 3h8a3 3 0 0 1 3 3" />
  </Svg>
);

export const NavHistory = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 1.5" />
    <path d="M4.5 5 3 8l3 .5" />
  </Svg>
);

export const NavBolt = (props) => (
  <Svg {...props}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
  </Svg>
);

export const NavPlug = (props) => (
  <Svg {...props}>
    <path d="M9 3v6M15 3v6" />
    <path d="M6 9h12v3a6 6 0 0 1-12 0Z" />
    <path d="M12 18v3" />
  </Svg>
);

export const NavDots = (props) => (
  <Svg {...props}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </Svg>
);
