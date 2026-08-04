import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSidebarMenuForRole, getTaskMenuItem, SECTION_ICONS } from './menuConfig';
import { getRoleCode } from '../../../utils/permissions';
import { XMarkIcon, ChevronRightIcon, ChevronDownIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useSiteSettings } from '../../../contexts/SiteSettingsContext';
import './Sidebar.css';

const MOBILE_BREAKPOINT = 768;

/** Renders a menu icon — accepts a Heroicon component or falls back to a dot */
const MenuIcon = ({ icon, className = 'sidebar-icon' }) => {
  if (!icon) return <span className={className}>•</span>;
  if (typeof icon === 'function' || typeof icon === 'object') {
    const Icon = icon;
    return <Icon className={className} />;
  }
  return <span className={className}>{icon}</span>;
};

/**
 * Splits a flat menu into its `{ section }` buckets:
 *   [{ label, icon, collapsedByDefault, items: [...] }, ...]
 * Items that appear before the first section divider land in an unnamed bucket.
 * This drives both renderings: the collapsed rail shows one icon per section
 * instead of one per link (7 icons rather than 25+ on the admin menu), and the
 * expanded sidebar renders each bucket under a collapsible header.
 */
const buildSections = (menu) => {
  const out = [];
  let current = null;
  menu.forEach((item) => {
    if (item.section) {
      current = {
        label: item.section,
        icon: item.icon || SECTION_ICONS[item.section],
        collapsedByDefault: !!item.collapsed,
        items: [],
      };
      out.push(current);
      return;
    }
    if (!current) {
      current = { label: 'Menu', icon: null, unnamed: true, items: [] };
      out.push(current);
    }
    current.items.push(item);
  });
  return out.filter((section) => section.items.length);
};

const Sidebar = ({ isMobileOpen, onMobileClose }) => {
  const { sidebarCollapsed } = useSelector((state) => state.ui);
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);
  const location = useLocation();
  const { siteTitle, logoFull, logoMark } = useSiteSettings();

  // Determine which group contains the current path so it auto-opens
  const menu = React.useMemo(() => {
    const base = getSidebarMenuForRole(roleCode, user);
    // SA/ADM now have Tasks + Departments/Sub-Departments directly in their admin
    // sidebar (and the task dashboard embedded on their main Dashboard), so no
    // standalone-portal link for them. Standard Executive still uses /task-portal.
    if (roleCode === 'SE') {
      return [...base, getTaskMenuItem(roleCode)];
    }
    return base;
  }, [roleCode, user]);

  const sections = React.useMemo(() => buildSections(menu), [menu]);
  // A flat portal menu (telecaller, sales manager, …) declares no `{ section }`
  // markers, so it keeps rendering as one plain list with no group headers.
  const isSectioned = React.useMemo(() => menu.some((item) => item.section), [menu]);

  const isPathActive = useCallback(
    (path) => !!path && (location.pathname === path || location.pathname.startsWith(path + '/')),
    [location.pathname],
  );
  const isItemActive = useCallback(
    (item) => (item.children?.length
      ? item.children.some((child) => isPathActive(child.path))
      : isPathActive(item.path)),
    [isPathActive],
  );

  const getInitialOpenGroups = useCallback(() => {
    const initial = {};
    menu.forEach((item) => {
      if (item.children?.length) {
        const isActive = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));
        initial[item.label] = isActive;
      }
    });
    return initial;
  }, [menu, location.pathname]);

  const [openGroups, setOpenGroups] = useState(() => getInitialOpenGroups());
  // Section headers are collapsible too. This map holds only the sections the
  // user (or the auto-open effect) has actually touched — an absent key falls
  // back to the section's own default, so the menu arriving late (the role menu
  // is rebuilt once `user` loads) can never leave every group folded shut.
  const [openSections, setOpenSections] = useState({});
  const isSectionOpen = useCallback(
    (section) => (section.label in openSections
      ? openSections[section.label]
      : !section.collapsedByDefault),
    [openSections],
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  // Which section's flyout panel is open on the collapsed rail (null = none)
  const [flyout, setFlyout] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutRef = useRef(null);
  const railRef = useRef(null);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setFlyout(null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-expand group containing the active route when location changes
  React.useEffect(() => {
    menu.forEach((item) => {
      if (item.children?.length) {
        const isActive = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));
        if (isActive) {
          setOpenGroups((prev) => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [location.pathname, menu]);

  // Same for the section that owns the active route — navigating into a
  // collapsed section (SETTINGS) opens it so the current page is never hidden.
  // Only writes when the section is actually shut, so an already-open section
  // costs no render.
  React.useEffect(() => {
    sections.forEach((section) => {
      if (!section.items.some(isItemActive)) return;
      setOpenSections((prev) => {
        const open = section.label in prev ? prev[section.label] : !section.collapsedByDefault;
        return open ? prev : { ...prev, [section.label]: true };
      });
    });
  }, [sections, isItemActive]);

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section.label]: !isSectionOpen(section) }));
  };

  const handleLinkClick = () => {
    setFlyout(null);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const isCollapsed = !isMobile && sidebarCollapsed;
  // The category rail only makes sense for a sectioned menu (admin/super admin
  // and the matrix-driven roles). A flat 3-item portal menu keeps the plain
  // icon rail it already had.
  const isRail = isCollapsed && sections.length >= 2;

  // Leaving rail mode (expanded, or dropped to mobile) discards the flyout.
  useEffect(() => {
    if (!isRail) setFlyout(null);
  }, [isRail]);

  // Dismiss on outside click / Escape. Clicks on the rail itself are ignored so
  // the button's own onClick can toggle the panel.
  useEffect(() => {
    if (!flyout) return undefined;
    const handlePointerDown = (e) => {
      if (flyoutRef.current?.contains(e.target)) return;
      if (railRef.current?.contains(e.target)) return;
      setFlyout(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFlyout(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [flyout]);

  // Keep the panel inside the viewport — it opens level with its icon, then
  // slides up if it would run off the bottom. Re-runs when a group inside the
  // panel opens/closes and changes its height.
  useLayoutEffect(() => {
    if (!flyout || !flyoutRef.current) return;
    const height = flyoutRef.current.offsetHeight;
    setFlyoutTop(Math.max(12, Math.min(flyout.anchor, window.innerHeight - 12 - height)));
  }, [flyout, openGroups]);

  /** Icon for a section header/rail button, with the same fallback chain in both
      the rail and the flyout title so they never disagree. */
  const sectionIcon = (section) => section.icon || section.items[0]?.icon || EllipsisHorizontalIcon;

  const toggleFlyout = (section, button) => {
    const { top } = button.getBoundingClientRect();
    const anchor = top - 8;
    setFlyoutTop(anchor);
    setFlyout((prev) => (prev?.label === section.label
      ? null
      : { label: section.label, icon: sectionIcon(section), items: section.items, anchor }));
  };

  /** One menu entry — icon + label, and a chevron when it has children. Used by
      both the expanded sidebar and the collapsed rail's flyout panel, so the two
      read identically; the flyout used to drop the icon column, which left the
      whole collapsed state icon-less once you opened a group. */
  const renderMenuItem = (item) => {
    if (item.children?.length) {
      const isOpen = !!openGroups[item.label];
      const hasActiveChild = item.children.some((child) => isPathActive(child.path));

      return (
        <div key={item.label} className={`app-sidebar__group ${hasActiveChild ? 'has-active-child' : ''}`}>
          <button type="button" className={`app-sidebar__group-button ${isOpen ? 'is-open' : ''}`} onClick={() => toggleGroup(item.label)} title={item.label}>
            <MenuIcon icon={item.icon} />
            <span className="app-sidebar__link-label">{item.label}</span>
            <span className={`app-sidebar__chevron ${isOpen ? 'open' : ''}`}><ChevronRightIcon className="sidebar-icon sidebar-icon--xs" /></span>
          </button>
          {isOpen && (
            <div className="app-sidebar__subnav">
              {item.children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `app-sidebar__link app-sidebar__link--child ${isActive ? 'is-active' : ''}`
                  }
                >
                  <span className="app-sidebar__link-label">{child.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={handleLinkClick}
        className={({ isActive }) => `app-sidebar__link ${isActive ? 'is-active' : ''}`}
        title={item.label}
      >
        <MenuIcon icon={item.icon} />
        <span className="app-sidebar__link-label">{item.label}</span>
      </NavLink>
    );
  };

  /** One `{ section }` bucket: a clickable uppercase header that folds its links
      away, plus the links themselves. Items that came before any section marker
      render bare, with no header. */
  const renderSection = (section) => {
    if (section.unnamed) {
      return (
        <React.Fragment key="__unnamed__">
          {section.items.map((item) => renderMenuItem(item))}
        </React.Fragment>
      );
    }
    const isOpen = isSectionOpen(section);
    const hasActive = section.items.some(isItemActive);

    return (
      <div
        key={section.label}
        className={`app-sidebar__section ${isOpen ? 'is-open' : 'is-collapsed'} ${hasActive ? 'has-active' : ''}`}
      >
        <button
          type="button"
          className="app-sidebar__section-toggle"
          onClick={() => toggleSection(section)}
          aria-expanded={isOpen}
          title={section.label}
        >
          <span className="app-sidebar__section-label">{section.label}</span>
          <ChevronDownIcon className="sidebar-icon sidebar-icon--xs app-sidebar__section-chevron" />
        </button>
        {isOpen && (
          <div className="app-sidebar__section-items">
            {section.items.map((item) => renderMenuItem(item))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[450] md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside className={`app-sidebar ${isCollapsed ? 'app-sidebar--collapsed' : ''} ${isRail ? 'app-sidebar--rail' : ''} ${isMobile ? 'fixed left-0 top-0 z-[460] w-64 transform transition-transform duration-300' : ''} ${isMobile && !isMobileOpen ? '-translate-x-full' : ''} ${isMobile ? 'md:relative md:translate-x-0 md:z-auto' : ''}`}>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="app-sidebar__close"
            aria-label="Close sidebar"
          >
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        )}
      {/* Brand — same as the portal sidebar: full logo when expanded, square
          mark on the collapsed rail. No extra text. */}
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">
          <img src={logoFull} alt={siteTitle} className="sidebar-logo sidebar-logo--full" />
          <img src={logoMark} alt={siteTitle} className="sidebar-logo sidebar-logo--mark" />
        </div>
      </div>

      {/* Navigation. Three renderings:
            • collapsed + sectioned → an icon rail of section categories, each
              opening a flyout panel;
            • expanded + sectioned  → collapsible section headers (admin/SA);
            • flat portal menu      → one plain list, no headers.
          Labels/chevrons always render; CSS hides them on the collapsed rail. */}
      <nav className={`app-sidebar__nav ${isRail ? 'app-sidebar__nav--rail' : ''}`} ref={railRef}>
        {isRail
          ? sections.map((section) => {
            const isOpen = flyout?.label === section.label;
            const hasActive = section.items.some(isItemActive);
            return (
              <button
                key={section.label}
                type="button"
                className={`app-sidebar__rail-button ${hasActive ? 'is-active' : ''} ${isOpen ? 'is-open' : ''}`}
                onClick={(e) => toggleFlyout(section, e.currentTarget)}
                title={section.label}
                aria-label={section.label}
                aria-expanded={isOpen}
              >
                <MenuIcon icon={sectionIcon(section)} className="sidebar-icon sidebar-icon--rail" />
              </button>
            );
          })
          : isSectioned
            ? sections.map((section) => renderSection(section))
            : menu.map((item) => renderMenuItem(item))}
      </nav>

      {/* No profile/logout footer here — the header user menu is the single place
          for profile and logout, and carrying both duplicated the same controls. */}

    </aside>

    {/* Flyout panel for the collapsed rail. Rendered outside <aside> because the
        sidebar clips its overflow; it is fixed-positioned against the rail. */}
    {isRail && flyout && (
      <nav
        className="app-sidebar__flyout"
        ref={flyoutRef}
        style={{ top: flyoutTop }}
        aria-label={flyout.label}
      >
        <div className="app-sidebar__flyout-title">
          <MenuIcon icon={flyout.icon} className="sidebar-icon sidebar-icon--xs" />
          <span>{flyout.label}</span>
        </div>
        {flyout.items.map((item) => renderMenuItem(item))}
      </nav>
    )}
    </>
  );
};

export default Sidebar;
